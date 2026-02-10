// Job Orchestrator Edge Function
// Coordinates the pipeline: Rules -> Enrichment -> AI

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient, logActivity } from '../_shared/supabase.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();
    const authHeader = req.headers.get('Authorization');
    const supabase = createSupabaseClient(authHeader || undefined);

    // Get job status
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('status, current_step')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobError?.message}`);
    }

    await logActivity(supabase, jobId, `Orchestrator keeping job moving. Current status: ${job.status}`, 'INFO');

    // State Machine logic
    switch (job.status) {
      case 'PENDING':
      case 'PARSING':
        // This shouldn't happen if orchestrator is called after parse-csv
        return new Response(JSON.stringify({ message: 'Job is still parsing' }), { headers: corsHeaders });

      case 'RULES':
        // Trigger rules classification
        await logActivity(supabase, jobId, 'Triggering rules classification...', 'INFO');
        const { data: rulesData, error: rulesError } = await supabase.functions.invoke('classify-rules', {
          body: { jobId }
        });
        
        if (rulesError) throw rulesError;
        
        // After rules, orchestrate again to pick up the next status (ENRICHING or COMPLETED)
        return await invokeSelf(jobId, authHeader);

      case 'ENRICHING':
        // Trigger enrichment
        await logActivity(supabase, jobId, 'Triggering contact enrichment...', 'INFO');
        const { data: enrichData, error: enrichError } = await supabase.functions.invoke('enrich-contacts', {
          body: { jobId }
        });

        if (enrichError) throw enrichError;

        // After enrichment, orchestrate again to pick up the next status (AI_CLASSIFYING)
        return await invokeSelf(jobId, authHeader);

      case 'AI_CLASSIFYING':
        // Trigger AI classification
        await logActivity(supabase, jobId, 'Triggering AI classification...', 'INFO');
        const { data: aiData, error: aiError } = await supabase.functions.invoke('classify-ai', {
          body: { jobId }
        });

        if (aiError) throw aiError;

        // After AI, orchestrate again to see if we are done
        return await invokeSelf(jobId, authHeader);

      case 'COMPLETED':
        await logActivity(supabase, jobId, 'Job pipeline completed successfully.', 'SUCCESS');
        return new Response(JSON.stringify({ success: true, status: 'COMPLETED' }), { headers: corsHeaders });

      case 'FAILED':
        return new Response(JSON.stringify({ success: false, status: 'FAILED' }), { headers: corsHeaders });

      default:
        throw new Error(`Unknown job status: ${job.status}`);
    }

  } catch (error) {
    console.error('Orchestrator error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

async function invokeSelf(jobId: string, authHeader: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Non-blocking call to continue orchestration (to avoid long-running chain timeouts)
  // In a real production app, we'd use a background worker/queue
  // Here we just return and expect the state machine to be called again if needed
  // or we do a fetch without awaiting (fire and forget)
  
  fetch(`${supabaseUrl}/functions/v1/orchestrate-job`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jobId }),
  }).catch(err => console.error('Self-invocation error:', err));

  return new Response(JSON.stringify({ success: true, message: 'Orchestration continuing in background' }), { headers: corsHeaders });
}
