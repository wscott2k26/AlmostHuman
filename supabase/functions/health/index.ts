import { createClient } from 'npm:@supabase/supabase-js@2';
import { serve } from '../_shared/cors.ts';
import { neuralVoiceConfiguration } from '../_shared/neuralVoice.ts';

serve(async (_req) => {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const publishable = runtimeKey('publishable');
  const secret = runtimeKey('secret');
  let database = false;
  let schema = 'unknown';
  if (url && secret) {
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.from('profiles').select('id', { count: 'exact', head: true });
    database = !error;
    schema = error ? 'missing_or_unreachable' : 'ready';
  }
  const voice = neuralVoiceConfiguration();
  return Response.json({
    ok: true,
    product: 'Almost Human',
    backend: 'supabase',
    database,
    database_configured: Boolean(url && publishable),
    schema,
    ai_configured: Boolean(Deno.env.get('OPENAI_API_KEY')),
    voice_configured: voice.configured,
    neural_voice_configured: voice.configured,
    neural_voice_provider: voice.provider,
    elevenlabs_configured: voice.elevenConfigured,
    chat_stream_configured: Boolean(Deno.env.get('OPENAI_API_KEY')),
    transcription_configured: Boolean(Deno.env.get('OPENAI_API_KEY')),
    account_deletion_configured: Boolean(secret),
    checked_at: new Date().toISOString(),
  });
});


function runtimeKey(kind: 'publishable' | 'secret'): string {
  const direct = kind === 'publishable'
    ? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')
    : Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (direct) return direct;
  const dictionaryName = kind === 'publishable' ? 'SUPABASE_PUBLISHABLE_KEYS' : 'SUPABASE_SECRET_KEYS';
  try {
    const dictionary = JSON.parse(Deno.env.get(dictionaryName) || '{}') as Record<string, string>;
    return dictionary.default || Object.values(dictionary).find(Boolean) || '';
  } catch {
    return '';
  }
}
