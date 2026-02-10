// Enrich Contacts Edge Function
// Performs web enrichment on uncertain rows with staged depth and caching

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient, logActivity } from '../_shared/supabase.ts';
import { enrichContact } from '../_shared/enrichment.ts';
import { NormalizedContact, createCacheKey } from '../_shared/types.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { jobId, depth = 1 } = await req.json();

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

    // Check budget caps
    const MAX_SEARCH_CALLS = parseInt(Deno.env.get('MAX_SEARCH_CALLS_PER_JOB') || '500');
    
    if (job.search_calls_count >= MAX_SEARCH_CALLS) {
      await logActivity(
        supabase,
        jobId,
        `Search budget cap reached (${MAX_SEARCH_CALLS} calls). Skipping enrichment.`,
        'WARNING'
      );
      
      return new Response(
        JSON.stringify({ success: true, enrichedCount: 0, budgetCapReached: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await logActivity(supabase, jobId, `Starting enrichment (depth ${depth})`, 'INFO');

    // Update job status
    await supabase
      .from('jobs')
      .update({ status: 'ENRICHING', current_step: 'Enriching contacts' })
      .eq('id', jobId);

    // Get pending rows that need enrichment (not classified by rules or low confidence)
    const { data: rows, error: rowsError } = await supabase
      .from('job_rows')
      .select('*')
      .eq('job_id', jobId)
      .or('row_status.eq.PENDING,and(row_status.eq.COMPLETED,confidence.lt.80)')
      .is('enrichment_json', null)
      .limit(100); // Process in batches

    if (rowsError) {
      throw new Error(`Failed to fetch rows: ${rowsError.message}`);
    }

    if (!rows || rows.length === 0) {
      await logActivity(supabase, jobId, 'No rows need enrichment', 'INFO');
      return new Response(
        JSON.stringify({ success: true, enrichedCount: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let enrichedCount = 0;
    let cacheHits = 0;
    let searchCalls = 0;

    for (const row of rows) {
      if (searchCalls >= MAX_SEARCH_CALLS - job.search_calls_count) {
        await logActivity(
          supabase,
          jobId,
          `Reached search budget cap. Processed ${enrichedCount} rows.`,
          'WARNING'
        );
        break;
      }

      const normalized = row.normalized_json as NormalizedContact;
      const cacheKey = createCacheKey(normalized);

      // Check cache first
      const { data: cached } = await supabase
        .from('enrichment_cache')
        .select('enrichment_data')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      let enrichmentData;

      if (cached) {
        enrichmentData = cached.enrichment_data;
        cacheHits++;
      } else {
        // Perform enrichment
        enrichmentData = await enrichContact(normalized, depth);
        searchCalls++;

        // Cache the result
        if (enrichmentData) {
          const CACHE_TTL_DAYS = parseInt(Deno.env.get('ENRICHMENT_CACHE_TTL_DAYS') || '30');
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

          await supabase.from('enrichment_cache').upsert({
            cache_key: cacheKey,
            enrichment_data: enrichmentData,
            expires_at: expiresAt.toISOString(),
          });
        }
      }

      // Update row with enrichment data
      if (enrichmentData) {
        await supabase
          .from('job_rows')
          .update({
            enrichment_json: enrichmentData,
            enrichment_status: 'DONE',
            enrichment_attempts: row.enrichment_attempts + 1,
            last_processing_step: 'ENRICH',
          })
          .eq('id', row.id);

        enrichedCount++;
      } else {
        await supabase
          .from('job_rows')
          .update({
            enrichment_status: 'FAILED',
            enrichment_attempts: row.enrichment_attempts + 1,
          })
          .eq('id', row.id);
      }
    }

    // Update job search calls count
    await supabase
      .from('jobs')
      .update({
        search_calls_count: job.search_calls_count + searchCalls,
      })
      .eq('id', jobId);

    await logActivity(
      supabase,
      jobId,
      `Enrichment completed. Enriched: ${enrichedCount}, Cache hits: ${cacheHits}, Search calls: ${searchCalls}`,
      'SUCCESS',
      { enrichedCount, cacheHits, searchCalls }
    );

    // Update job status to AI_CLASSIFYING
    await supabase
      .from('jobs')
      .update({
        status: 'AI_CLASSIFYING',
        current_step: 'Ready for AI classification',
      })
      .eq('id', jobId);

    return new Response(
      JSON.stringify({ success: true, enrichedCount, cacheHits, searchCalls }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Enrich contacts error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
