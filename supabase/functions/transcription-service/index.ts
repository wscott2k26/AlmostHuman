import { createAppContext, safeError, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';

const MAX_AUDIO_BYTES = 3_000_000;
const MIME_EXTENSIONS: Record<string, string> = {
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
};

serve(async (req) => {
  try {
    await createAppContext(req);
    const body = await req.json().catch(() => ({}));
    const audioBase64 = String(body.audio_base64 || '');
    const mimeType = String(body.mime_type || 'audio/m4a').toLowerCase();
    const language = String(body.language || 'en').slice(0, 8);
    if (!audioBase64) return Response.json({ error: 'audio_base64 required' }, { status: 400 });
    const binary = Uint8Array.from(atob(audioBase64), (char) => char.charCodeAt(0));
    if (!binary.length || binary.length > MAX_AUDIO_BYTES) {
      return Response.json({ error: 'Recording must be shorter than 3 MB.' }, { status: 413 });
    }
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return Response.json({ error: 'Transcription provider is not configured' }, { status: 503 });

    const extension = MIME_EXTENSIONS[mimeType] || 'm4a';
    const form = new FormData();
    form.append('file', new Blob([binary], { type: mimeType }), `almost-human-message.${extension}`);
    form.append('model', Deno.env.get('OPENAI_TRANSCRIBE_MODEL') || 'gpt-4o-mini-transcribe');
    form.append('language', language.split('-')[0]);
    form.append('response_format', 'json');
    form.append('prompt', 'A natural personal conversation with an AI companion. Preserve names and everyday phrasing.');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Transcription failed (${response.status}): ${String(result?.error?.message || result?.error || '').slice(0, 220)}`);
    const text = String(result?.text || '').trim();
    return Response.json({ data: { text, mode: 'secure-transcription' } }, { status: 200 });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: statusOf(error) });
  }
});
