import {
  normalizeVoiceProviderPreference10,
  normalizeVoiceRate10,
  normalizeVoiceTone10,
  resolveVoiceProvider10,
  toneDirections10,
  toneVoiceSettings10,
  type VoiceProviderPreference10,
  type VoiceTone10,
} from './voiceProfile10.ts';

export const PUBLIC_VOICE_IDS = [
  'female-child', 'female-teen', 'female-adult', 'male-child', 'male-teen', 'male-adult',
] as const;

export type PublicVoiceId = typeof PUBLIC_VOICE_IDS[number];

const LEGACY: Record<string, PublicVoiceId> = {
  'soft-neutral': 'female-adult',
  'bright-curious': 'female-teen',
  'calm-grounded': 'male-adult',
};

const ELEVEN_SECRET_NAMES: Record<PublicVoiceId, string> = {
  'female-child': 'ELEVENLABS_VOICE_FEMALE_CHILD',
  'female-teen': 'ELEVENLABS_VOICE_FEMALE_TEEN',
  'female-adult': 'ELEVENLABS_VOICE_FEMALE_ADULT',
  'male-child': 'ELEVENLABS_VOICE_MALE_CHILD',
  'male-teen': 'ELEVENLABS_VOICE_MALE_TEEN',
  'male-adult': 'ELEVENLABS_VOICE_MALE_ADULT',
};

const OPENAI_VOICES: Record<PublicVoiceId, string> = {
  'female-child': 'coral',
  'female-teen': 'nova',
  'female-adult': 'marin',
  'male-child': 'ash',
  'male-teen': 'sage',
  'male-adult': 'cedar',
};

const DIRECTIONS: Record<PublicVoiceId, string> = {
  'female-child': 'Use a bright, youthful feminine synthetic style with natural pacing. Never imitate a real child or person. Avoid exaggerated pitch.',
  'female-teen': 'Use a relaxed feminine teen-style synthetic voice with natural expression. Never imitate a real person or force slang.',
  'female-adult': 'Use an adult feminine synthetic voice with warm, natural pacing and subtle emotion. Avoid theatrical delivery.',
  'male-child': 'Use a friendly, youthful masculine synthetic style with natural pacing. Never imitate a real child or person. Avoid exaggerated pitch.',
  'male-teen': 'Use a relaxed masculine teen-style synthetic voice with natural expression. Never imitate a real person or force slang.',
  'male-adult': 'Use an adult masculine synthetic voice with calm, natural pacing and quiet emotional range. Avoid monotone delivery.',
};

export function normalizePublicVoiceId(value: unknown): PublicVoiceId {
  const raw = String(value || 'female-adult');
  if (LEGACY[raw]) return LEGACY[raw];
  return (PUBLIC_VOICE_IDS as readonly string[]).includes(raw) ? raw as PublicVoiceId : 'female-adult';
}

export function neuralVoiceConfiguration() {
  const elevenKey = Deno.env.get('ELEVENLABS_API_KEY') || '';
  const elevenVoices = Object.fromEntries(
    PUBLIC_VOICE_IDS.map((id) => [id, Deno.env.get(ELEVEN_SECRET_NAMES[id]) || '']),
  ) as Record<PublicVoiceId, string>;
  const allElevenMapped = PUBLIC_VOICE_IDS.every((id) => Boolean(elevenVoices[id]));
  const openaiConfigured = Boolean(Deno.env.get('OPENAI_API_KEY'));
  const elevenConfigured = Boolean(elevenKey && allElevenMapped);
  return {
    provider: elevenConfigured ? 'elevenlabs' : openaiConfigured ? 'openai' : 'none',
    configured: Boolean(elevenConfigured || openaiConfigured),
    elevenConfigured,
    openaiConfigured,
    elevenVoices,
  };
}

export async function generateNeuralSpeech({
  text,
  voiceId,
  stageLabel = 'Adult',
  requestId = '',
  tone = 'calm',
  providerPreference = 'auto',
  rate = 0.96,
}: {
  text: string;
  voiceId: PublicVoiceId;
  stageLabel?: string;
  requestId?: string;
  tone?: VoiceTone10;
  providerPreference?: VoiceProviderPreference10;
  rate?: number;
}) {
  const input = String(text || '').trim().slice(0, 4096);
  if (!input) throw Object.assign(new Error('Speech text required'), { status: 400, code: 'EMPTY_SPEECH' });

  const safeTone = normalizeVoiceTone10(tone);
  const safePreference = normalizeVoiceProviderPreference10(providerPreference);
  const safeRate = normalizeVoiceRate10(rate);
  const config = neuralVoiceConfiguration();
  const provider = resolveVoiceProvider10(safePreference, config);

  if (provider === 'elevenlabs') {
    const providerVoiceId = config.elevenVoices[voiceId];
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(providerVoiceId)}/stream?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY') || '',
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
          'x-request-id': requestId,
        },
        body: JSON.stringify({
          text: input,
          model_id: Deno.env.get('ELEVENLABS_TTS_MODEL') || 'eleven_flash_v2_5',
          language_code: 'en',
          apply_text_normalization: 'auto',
          voice_settings: toneVoiceSettings10(safeTone, safeRate),
        }),
      },
    );
    if (!response.ok || !response.body) {
      const detail = await response.text();
      throw Object.assign(
        new Error(`ElevenLabs speech failed (${response.status}): ${detail.slice(0, 220)}`),
        { status: 502, code: 'ELEVENLABS_FAILED' },
      );
    }
    return {
      body: response.body,
      provider: 'elevenlabs' as const,
      tone: safeTone,
      contentType: response.headers.get('Content-Type') || 'audio/mpeg',
    };
  }

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
      'x-request-id': requestId,
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_TTS_MODEL') || 'gpt-4o-mini-tts',
      voice: OPENAI_VOICES[voiceId],
      input,
      response_format: 'mp3',
      speed: safeRate,
      instructions: `${DIRECTIONS[voiceId]} ${toneDirections10(safeTone)} The character is in the ${stageLabel.toLowerCase()} developmental stage; vocabulary changes, not audio quality.`,
    }),
  });
  if (!response.ok || !response.body) {
    const detail = await response.text();
    throw Object.assign(
      new Error(`OpenAI speech failed (${response.status}): ${detail.slice(0, 220)}`),
      { status: 502, code: 'OPENAI_TTS_FAILED' },
    );
  }
  return {
    body: response.body,
    provider: 'openai' as const,
    tone: safeTone,
    contentType: response.headers.get('Content-Type') || 'audio/mpeg',
  };
}
