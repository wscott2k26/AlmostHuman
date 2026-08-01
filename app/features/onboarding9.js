export const VOICE_IDS_9 = Object.freeze([
  'female-child',
  'female-teen',
  'female-adult',
  'male-child',
  'male-teen',
  'male-adult',
]);

export const APPEARANCE_PRESETS_9 = Object.freeze([
  Object.freeze({ id: 'ember-waves', skinTone: 'warm', hairStyle: 'waves', hairColor: 'midnight', eyeColor: 'brown' }),
  Object.freeze({ id: 'golden-short', skinTone: 'golden', hairStyle: 'short', hairColor: 'brown', eyeColor: 'green' }),
  Object.freeze({ id: 'deep-locs', skinTone: 'deep', hairStyle: 'locs', hairColor: 'midnight', eyeColor: 'brown' }),
  Object.freeze({ id: 'light-curls', skinTone: 'light', hairStyle: 'curls', hairColor: 'auburn', eyeColor: 'blue' }),
  Object.freeze({ id: 'warm-curls', skinTone: 'warm', hairStyle: 'curls', hairColor: 'brown', eyeColor: 'violet' }),
  Object.freeze({ id: 'golden-waves', skinTone: 'golden', hairStyle: 'waves', hairColor: 'silver', eyeColor: 'blue' }),
]);

const LEGACY_VOICE_IDS_9 = Object.freeze({
  'soft-neutral': 'female-adult',
  'bright-curious': 'female-teen',
  'calm-grounded': 'male-adult',
});

const FIRST_LIGHT_DURATION_MS = 2400;

export function normalizeLegacyVoiceId9(value) {
  const raw = String(value || 'female-adult');
  if (LEGACY_VOICE_IDS_9[raw]) return LEGACY_VOICE_IDS_9[raw];
  return VOICE_IDS_9.includes(raw) ? raw : 'female-adult';
}

export function firstLightDurationMs() {
  return FIRST_LIGHT_DURATION_MS;
}

export function createOnboardingModel(state = {}, ui = {}) {
  const ai = state?.ai && !state.ai.archived ? state.ai : null;
  return Object.freeze({
    steps: Object.freeze(['welcome', 'quick-create', 'first-light']),
    stepIndex: Math.max(0, Math.min(2, Number(ui.onboardingStep) || 0)),
    firstConversationRoute: 'talk',
    bypass: Boolean(ai),
    ai,
    appearancePresets: APPEARANCE_PRESETS_9,
    voiceIds: VOICE_IDS_9,
    firstLightDurationMs: FIRST_LIGHT_DURATION_MS,
    skippable: true,
  });
}

export function quickCreateDefaults(existing = {}) {
  const preset = APPEARANCE_PRESETS_9.find((item) => item.id === existing.appearancePresetId) || APPEARANCE_PRESETS_9[0];
  return {
    caregiverName: String(existing.caregiverName || ''),
    name: String(existing.name || ''),
    pronouns: ['they/them', 'she/her', 'he/him'].includes(existing.pronouns) ? existing.pronouns : 'they/them',
    appearancePresetId: preset.id,
    appearance: { skinTone: preset.skinTone, hairStyle: preset.hairStyle, hairColor: preset.hairColor, eyeColor: preset.eyeColor },
    voiceId: normalizeLegacyVoiceId9(existing.voiceId),
  };
}
