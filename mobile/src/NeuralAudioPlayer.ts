const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/aac',
  'audio/wav',
]);

export type NeuralAudioPayload = {
  id: string;
  url?: string;
  base64?: string;
  mimeType?: string;
};

export function neuralAudioSource(payload: NeuralAudioPayload): { uri: string } {
  const id = String(payload?.id || '').trim();
  if (!id) throw new Error('Audio id is required.');
  const url = String(payload?.url || '').trim();
  if (url && /^https:\/\//i.test(url)) return { uri: url };
  const base64 = String(payload?.base64 || '').trim();
  const mimeType = String(payload?.mimeType || 'audio/mpeg').toLowerCase();
  if (!base64 || base64.length > 6_000_000) throw new Error('Audio payload is missing or too large.');
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new Error('Audio format is not supported.');
  return { uri: `data:${mimeType};base64,${base64}` };
}
