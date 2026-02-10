// Classify Rules Edge Function
// Applies weighted rules engine to classify contacts without AI

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient, logActivity } from '../_shared/supabase.ts';
import { classifyByRules, applyFieldHeuristics } from '../_shared/rules-engine.ts';
import { NormalizedContact } from '../_shared/types.ts';
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

    await logActivity(supabase, jobId, 'Starting rules-based classification', 'INFO');

    // Update job status
    await supabase
      .from('jobs')
      .update({ status: 'RULES', current_step: 'Applying rules engine' })
      .eq('id', jobId);

    // Get all pending rows
    const { data: rows, error: rowsError } = await supabase
      .from('job_rows')
      .select('*')
      .eq('job_id', jobId)
      .eq('row_status', 'PENDING');

    if (rowsError) {
      throw new Error(`Failed to fetch rows: ${rowsError.message}`);
    }

    if (!rows || rows.length === 0) {
      await logActivity(supabase, jobId, 'No pending rows to classify', 'INFO');
      return new Response(
        JSON.stringify({ success: true, classifiedCount: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let classifiedCount = 0;
    let uncertainCount = 0;

    // Process rows in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        const normalized = row.normalized_json as NormalizedContact;

        // Try field heuristics first
        const heuristic = applyFieldHeuristics(normalized);
        
        // Try rules classification
        const result = classifyByRules(normalized, job.language);

        if (result) {
          // Rules classified successfully
          await supabase
            .from('job_rows')
            .update({
              final_category: result.final_category,
              confidence: result.confidence,
              [job.language === 'fr' ? 'reason_fr' : 'reason_en']: result.reason,
              [job.language === 'fr' ? 'public_signals_fr' : 'public_signals_en']: result.public_signals_used,
              needs_review: result.needs_review,
              classification_method: 'RULES',
              ai_used: false,
              row_status: 'COMPLETED',
              last_processing_step: 'RULES',
            })
            .eq('id', row.id);

          classifiedCount++;
        } else if (heuristic) {
          // Heuristic match but low confidence - mark for enrichment
          await supabase
            .from('job_rows')
            .update({
              final_category: heuristic.category,
              confidence: 60, // Medium confidence from heuristics
              [job.language === 'fr' ? 'public_signals_fr' : 'public_signals_en']: heuristic.signals?.join('; '),
              needs_review: true,
              classification_method: 'RULES',
              ai_used: false,
              row_status: 'PENDING', // Keep pending for potential enrichment
              last_processing_step: 'RULES',
            })
            .eq('id', row.id);

          uncertainCount++;
        } else {
          // No match - mark for enrichment/AI
          uncertainCount++;
        }
      }

      // Update progress
      await supabase
        .from('jobs')
        .update({
          current_step: `Rules classification: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`,
          current_batch_index: Math.floor(i / BATCH_SIZE),
        })
        .eq('id', jobId);
    }

    await logActivity(
      supabase,
      jobId,
      `Rules classification completed. Classified: ${classifiedCount}, Uncertain: ${uncertainCount}`,
      'SUCCESS',
      { classifiedCount, uncertainCount }
    );

    // Update job status to ENRICHING if there are uncertain rows
    if (uncertainCount > 0) {
      await supabase
        .from('jobs')
        .update({
          status: 'ENRICHING',
          current_step: 'Ready for enrichment',
        })
        .eq('id', jobId);
    } else {
      await supabase
        .from('jobs')
        .update({
          status: 'COMPLETED',
          current_step: 'All rows classified by rules',
        })
        .eq('id', jobId);
    }

    return new Response(
      JSON.stringify({ success: true, classifiedCount, uncertainCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Classify rules error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
