// Parse CSV Edge Function
// Validates schema, normalizes data, creates job and job_rows

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { parse } from 'https://deno.land/std@0.168.0/encoding/csv.ts';
import { createSupabaseClient, logActivity } from '../_shared/supabase.ts';
import { EXPECTED_COLUMNS, COLUMN_COUNT, normalizeContact } from '../_shared/types.ts';

serve(async (req) => {
  try {
    const { fileContent, filename, userId, language = 'en' } = await req.json();

    const supabase = createSupabaseClient(req.headers.get('Authorization') || undefined);

    // Parse CSV
    const rows = parse(fileContent, {
      skipFirstRow: true,
      columns: EXPECTED_COLUMNS as unknown as string[],
    });

    // Validate schema
    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Empty CSV file' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate column count from first row
    const firstRow = rows[0] as Record<string, string>;
    const columnCount = Object.keys(firstRow).length;
    
    if (columnCount !== COLUMN_COUNT) {
      return new Response(
        JSON.stringify({
          error: `Invalid CSV schema. Expected ${COLUMN_COUNT} columns, got ${columnCount}`,
          expected: EXPECTED_COLUMNS,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        user_id: userId,
        filename,
        file_path: `csv-uploads/${userId}/${filename}`,
        status: 'PARSING',
        total_rows: rows.length,
        language,
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error(`Failed to create job: ${jobError?.message}`);
    }

    await logActivity(supabase, job.id, `Started parsing ${filename} (${rows.length} rows)`, 'INFO');

    // Create job_rows in batches
    const BATCH_SIZE = 100;
    let processedCount = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const jobRows = batch.map((row, index) => {
        const rawRow = row as Record<string, string>;
        const normalized = normalizeContact(rawRow);

        return {
          job_id: job.id,
          row_index: i + index,
          raw_json: rawRow,
          normalized_json: normalized,
          row_status: 'PENDING',
          last_processing_step: 'PARSE',
        };
      });

      const { error: insertError } = await supabase
        .from('job_rows')
        .insert(jobRows);

      if (insertError) {
        throw new Error(`Failed to insert job rows: ${insertError.message}`);
      }

      processedCount += batch.length;

      // Update job progress
      await supabase
        .from('jobs')
        .update({
          processed_rows: processedCount,
          current_step: 'Parsing CSV',
        })
        .eq('id', job.id);
    }

    // Update job status to RULES (ready for rules classification)
    await supabase
      .from('jobs')
      .update({
        status: 'RULES',
        current_step: 'Ready for rules classification',
      })
      .eq('id', job.id);

    await logActivity(
      supabase,
      job.id,
      `Parsing completed. ${rows.length} rows ready for classification.`,
      'SUCCESS'
    );

    return new Response(
      JSON.stringify({ success: true, jobId: job.id, totalRows: rows.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Parse CSV error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
