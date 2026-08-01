export const VOICE_TONES_10 = [
  'calm', 'playful', 'thoughtful', 'confident', 'gentle', 'mysterious',
] as const;

export const VOICE_PROVIDER_PREFERENCES_10 = [
  'auto', 'elevenlabs', 'openai',
] as const;

export type VoiceTone10 = typeof VOICE_TONES_10[number];
export type VoiceProviderPreference10 = typeof VOICE_PROVIDER_PREFERENCES_10[number];
export type ResolvedVoiceProvider10 = 'elevenlabs' | 'openai';

export type VoiceProfile10 = {
  tone: VoiceTone10;
  providerPreference: VoiceProviderPreference10;
  rate: number;
};

export function normalizeVoiceTone10(value: unknown): VoiceTone10 {
  const raw = String(value || 'calm');
  return (VOICE_TONES_10 as readonly string[]).includes(raw) ? raw as VoiceTone10 : 'calm';
}

export function normalizeVoiceProviderPreference10(value: unknown): VoiceProviderPreference10 {
  const raw = String(value || 'auto');
  return (VOICE_PROVIDER_PREFERENCES_10 as readonly string[]).includes(raw)
    ? raw as VoiceProviderPreference10
    : 'auto';
}

export function normalizeVoiceRate10(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.96;
  return Math.min(1.18, Math.max(0.72, number));
}

export function normalizeServerVoiceProfile10(value: unknown): VoiceProfile10 {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    tone: normalizeVoiceTone10(input.tone),
    providerPreference: normalizeVoiceProviderPreference10(input.providerPreference ?? input.provider_preference),
    rate: normalizeVoiceRate10(input.rate),
  };
}

export function resolveVoiceProvider10(
  preference: VoiceProviderPreference10,
  configuration: { elevenConfigured: boolean; openaiConfigured: boolean },
): ResolvedVoiceProvider10 {
  if (preference === 'elevenlabs') {
    if (configuration.elevenConfigured) return 'elevenlabs';
    throw providerUnavailable10('elevenlabs');
  }
  if (preference === 'openai') {
    if (configuration.openaiConfigured) return 'openai';
    throw providerUnavailable10('openai');
  }
  if (configuration.elevenConfigured) return 'elevenlabs';
  if (configuration.openaiConfigured) return 'openai';
  throw providerUnavailable10('auto');
}

export function toneDirections10(tone: VoiceTone10): string {
  return ({
    calm: 'Speak with even pacing, grounded warmth, and restrained emotion.',
    playful: 'Speak with light energy, a subtle smile, and natural variation without becoming cartoonish.',
    thoughtful: 'Speak reflectively with measured pauses and quiet curiosity.',
    confident: 'Speak clearly and directly with steady energy, never aggressive or domineering.',
    gentle: 'Speak softly with patient warmth and reassuring pacing, never whispering excessively.',
    mysterious: 'Speak with subtle atmosphere and deliberate pacing, while remaining clear and natural.',
  } satisfies Record<VoiceTone10, string>)[tone];
}

export function toneVoiceSettings10(tone: VoiceTone10, rate: number) {
  const base = ({
    calm: { stability: 0.58, similarity_boost: 0.72, style: 0.12 },
    playful: { stability: 0.39, similarity_boost: 0.70, style: 0.34 },
    thoughtful: { stability: 0.60, similarity_boost: 0.73, style: 0.16 },
    confident: { stability: 0.52, similarity_boost: 0.76, style: 0.24 },
    gentle: { stability: 0.64, similarity_boost: 0.71, style: 0.10 },
    mysterious: { stability: 0.55, similarity_boost: 0.70, style: 0.28 },
  } satisfies Record<VoiceTone10, { stability: number; similarity_boost: number; style: number }>)[tone];
  return {
    ...base,
    use_speaker_boost: true,
    speed: normalizeVoiceRate10(rate),
  };
}

function providerUnavailable10(preference: VoiceProviderPreference10) {
  const error = new Error(
    preference === 'auto'
      ? 'Neural voice is not configured.'
      : `The selected ${preference} voice provider is not configured.`,
  );
  return Object.assign(error, { status: 503, code: 'VOICE_PROVIDER_UNAVAILABLE', providerPreference: preference });
}
