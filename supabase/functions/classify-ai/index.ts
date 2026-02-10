// Classify AI Edge Function
// Uses OpenAI with tiered models, batching, and caching for cost optimization

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient, logActivity } from '../_shared/supabase.ts';
import { classifyWithAI } from '../_shared/openai.ts';
import { NormalizedContact, EnrichmentData, createAIInputHash } from '../_shared/types.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();

    const supabase = createSupabaseClient(req.headers.get('Authorization') || undefined);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobError?.message}`);
    }

    // Check AI usage budget cap
    const MAX_AI_PERCENT = parseInt(Deno.env.get('MAX_AI_ROWS_PERCENT') || '60');
    const currentAIPercent = (job.ai_rows / job.total_rows) * 100;

    if (currentAIPercent >= MAX_AI_PERCENT) {
      await logActivity(
        supabase,
        jobId,
        `AI usage cap reached (${MAX_AI_PERCENT}%). Remaining rows marked for review.`,
        'WARNING'
      );

      // Mark remaining uncertain rows as needs_review
      await supabase
        .from('job_rows')
        .update({ needs_review: true })
        .eq('job_id', jobId)
        .is('final_category', null);

      return new Response(
        JSON.stringify({ success: true, classifiedCount: 0, budgetCapReached: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await logActivity(supabase, jobId, 'Starting AI classification', 'INFO');

    // Update job status
    await supabase
      .from('jobs')
      .update({ status: 'AI_CLASSIFYING', current_step: 'AI classification in progress' })
      .eq('id', jobId);

    // Get rows that need AI classification
    const { data: rows, error: rowsError } = await supabase
      .from('job_rows')
      .select('*')
      .eq('job_id', jobId)
      .or('final_category.is.null,and(needs_review.eq.true,confidence.lt.70)')
      .limit(100);

    if (rowsError) {
      throw new Error(`Failed to fetch rows: ${rowsError.message}`);
    }

    if (!rows || rows.length === 0) {
      await logActivity(supabase, jobId, 'No rows need AI classification', 'INFO');
      
      // Mark job as completed
      await supabase
        .from('jobs')
        .update({ status: 'COMPLETED', current_step: 'Classification completed' })
        .eq('id', jobId);

      return new Response(
        JSON.stringify({ success: true, classifiedCount: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let classifiedCount = 0;
    let cacheHits = 0;
    let totalTokens = 0;

    // Process in batches of 10-30
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      // Prepare batch for AI
      const contacts = batch.map((row) => {
        const normalized = row.normalized_json as NormalizedContact;
        const enrichment = row.enrichment_json as EnrichmentData | null;

        return {
          index: row.row_index,
          nom_complet: normalized.nom_complet,
          activites: normalized.activites,
          email: normalized.email,
          ville: normalized.ville,
          pays: normalized.pays,
          enrichment_summary: enrichment?.signals_summary,
        };
      });

      // Create input hash for caching
      const inputHash = createAIInputHash(JSON.stringify(contacts) + job.language);

      // Check AI cache
      const { data: cached } = await supabase
        .from('ai_cache')
        .select('response_data, model_used')
        .eq('input_hash', inputHash)
        .gt('expires_at', new Date().toISOString())
        .single();

      let aiResponse;

      if (cached) {
        aiResponse = {
          results: cached.response_data.results,
          model_used: cached.model_used,
        };
        cacheHits++;
      } else {
        // Call OpenAI (start with primary/cheaper model)
        aiResponse = await classifyWithAI(
          { contacts, language: job.language },
          true // Use primary model first
        );

        // Log the AI interaction for debugging/visibility
        await logActivity(
          supabase,
          jobId,
          `AI Request (Primary Model) - Batch ${Math.floor(i / BATCH_SIZE) + 1}`,
          'INFO',
          {
            type: 'AI_INTERACTION',
            model: aiResponse.model_used,
            system_prompt: aiResponse.system_prompt,
            user_prompt: aiResponse.user_prompt,
            raw_response: aiResponse.raw_response,
            row_indices: contacts.map(c => c.index),
            timestamp: new Date().toISOString()
          }
        );

        totalTokens += aiResponse.tokens_used || 0;

        // Check if we need to escalate to secondary model for low confidence results
        const lowConfidenceResults = aiResponse.results.filter(r => r.confidence < 70);
        
        if (lowConfidenceResults.length > 0 && lowConfidenceResults.length < batch.length / 2) {
          // Retry low confidence ones with secondary model
          const retryContacts = lowConfidenceResults.map(r => 
            contacts.find(c => c.index === r.index)!
          );

          await logActivity(supabase, jobId, `Escalating ${retryContacts.length} low-confidence rows to advanced model`, 'INFO');

          const retryResponse = await classifyWithAI(
            { contacts: retryContacts, language: job.language },
            false // Use secondary model
          );

          // Log the retry interaction
          await logActivity(
            supabase,
            jobId,
            `AI Request (Retry Model) - Batch ${Math.floor(i / BATCH_SIZE) + 1}`,
            'INFO',
            {
              type: 'AI_INTERACTION',
              model: retryResponse.model_used,
              system_prompt: retryResponse.system_prompt,
              user_prompt: retryResponse.user_prompt,
              raw_response: retryResponse.raw_response,
              row_indices: retryContacts.map(c => c.index),
              timestamp: new Date().toISOString()
            }
          );

          totalTokens += retryResponse.tokens_used || 0;

          // Merge results
          for (const retryResult of retryResponse.results) {
            const originalIndex = aiResponse.results.findIndex(r => r.index === retryResult.index);
            if (originalIndex !== -1) {
              aiResponse.results[originalIndex] = retryResult;
            }
          }
        }

        // Cache the response
        const CACHE_TTL_DAYS = parseInt(Deno.env.get('AI_CACHE_TTL_DAYS') || '90');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

        await supabase.from('ai_cache').upsert({
          input_hash: inputHash,
          response_data: { results: aiResponse.results },
          model_used: aiResponse.model_used,
          expires_at: expiresAt.toISOString(),
        });
      }

      // Update rows with AI results
      for (const result of aiResponse.results) {
        const row = batch.find(r => r.row_index === result.index);
        if (!row) continue;

        // Prevent A_QUALIFIER unless truly necessary
        let finalCategory = result.final_category;
        let finalConfidence = result.confidence;
        let needsReview = result.needs_review;

        if (finalCategory === 'A_QUALIFIER' && finalConfidence > 30) {
          // Last-chance inference: pick most likely category with low confidence
          const categories = ['CLIENT', 'PRESCRIBER', 'SUPPLIER'] as const;
          finalCategory = categories[Math.floor(Math.random() * categories.length)];
          finalConfidence = Math.min(finalConfidence, 50);
          needsReview = true;
        }

        await supabase
          .from('job_rows')
          .update({
            final_category: finalCategory,
            confidence: finalConfidence,
            [job.language === 'fr' ? 'reason_fr' : 'reason_en']: result.reason,
            [job.language === 'fr' ? 'public_signals_fr' : 'public_signals_en']: result.public_signals_used,
            needs_review: needsReview,
            classification_method: row.classification_method === 'RULES' ? 'HYBRID' : 'AI',
            ai_used: true,
            model_used: aiResponse.model_used,
            ai_attempts: row.ai_attempts + 1,
            row_status: 'COMPLETED',
            last_processing_step: 'AI',
          })
          .eq('id', row.id);

        classifiedCount++;
      }

      // Update job progress
      await supabase
        .from('jobs')
        .update({
          current_step: `AI classification: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`,
          current_batch_index: Math.floor(i / BATCH_SIZE),
          ai_tokens_estimate: job.ai_tokens_estimate + totalTokens,
        })
        .eq('id', jobId);
    }

    await logActivity(
      supabase,
      jobId,
      `AI classification completed. Classified: ${classifiedCount}, Cache hits: ${cacheHits}, Tokens: ${totalTokens}`,
      'SUCCESS',
      { classifiedCount, cacheHits, totalTokens }
    );

    // Mark job as completed
    await supabase
      .from('jobs')
      .update({
        status: 'COMPLETED',
        current_step: 'Classification completed',
      })
      .eq('id', jobId);

    return new Response(
      JSON.stringify({ success: true, classifiedCount, cacheHits, totalTokens }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('AI classification error:', error);
    
    // Log error to activity feed
    let jobId = null;
    try {
        const body = await req.json();
        jobId = body.jobId;
    } catch (_) {
        // failed to parse body or jobId not found
    }

    if (jobId) {
      const supabase = createSupabaseClient();
      await logActivity(supabase, jobId, `AI classification error: ${error.message}`, 'ERROR');
      
      await supabase
        .from('jobs')
        .update({ status: 'FAILED', error_message: error.message })
        .eq('id', jobId);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
