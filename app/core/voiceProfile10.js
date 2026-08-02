export const PUBLIC_VOICE_IDS_10 = Object.freeze([
  'female-child','female-teen','female-adult','male-child','male-teen','male-adult',
]);
export const VOICE_TONES_10 = Object.freeze(['calm','playful','thoughtful','confident','gentle','mysterious']);
export const VOICE_PROVIDER_PREFERENCES_10 = Object.freeze(['auto','elevenlabs','openai']);

const LEGACY_VOICE_IDS_10 = Object.freeze({
  'soft-neutral': 'female-adult',
  'bright-curious': 'female-teen',
  'calm-grounded': 'male-adult',
});

export function normalizePublicVoiceId10(value) {
  const raw = String(value || 'female-adult');
  const mapped = LEGACY_VOICE_IDS_10[raw] || raw;
  return PUBLIC_VOICE_IDS_10.includes(mapped) ? mapped : 'female-adult';
}

export function normalizeVoiceProfile10(value, fallbackVoiceId = 'female-adult') {
  const input = value && typeof value === 'object' ? value : {};
  return {
    voiceId: normalizePublicVoiceId10(input.voiceId || fallbackVoiceId),
    tone: VOICE_TONES_10.includes(input.tone) ? input.tone : 'calm',
    providerPreference: VOICE_PROVIDER_PREFERENCES_10.includes(input.providerPreference) ? input.providerPreference : 'auto',
    rate: clamp(input.rate, 0.72, 1.18, 0.96),
    previewVersion: positiveInteger(input.previewVersion, 1),
  };
}

export function voicePreviewRequest10(value, text = '') {
  const profile = normalizeVoiceProfile10(value, value?.voiceId);
  return {
    preview: true,
    text: String(text || '').trim().slice(0, 320),
    voice_id: profile.voiceId,
    tone: profile.tone,
    provider_preference: profile.providerPreference,
    rate: profile.rate,
    preview_version: profile.previewVersion,
  };
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}
