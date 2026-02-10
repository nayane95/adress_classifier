// Supabase client helper for Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export function createSupabaseClient(authHeader?: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = authHeader
    ? authHeader.replace('Bearer ', '')
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function logActivity(
  supabase: ReturnType<typeof createSupabaseClient>,
  jobId: string,
  message: string,
  messageType: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO',
  metadata?: Record<string, unknown>
) {
  await supabase.from('activity_feed').insert({
    job_id: jobId,
    message,
    message_type: messageType,
    metadata,
  });
}
