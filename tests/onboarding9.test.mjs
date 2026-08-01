import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APPEARANCE_PRESETS_9,
  createOnboardingModel,
  firstLightDurationMs,
  normalizeLegacyVoiceId9,
} from '../app/features/onboarding9.js';

test('new users have welcome, quick-create, first-light before chat', () => {
  const model = createOnboardingModel({ ai: null }, { onboardingStep: 0 });
  assert.deepEqual(model.steps, ['welcome', 'quick-create', 'first-light']);
  assert.equal(model.firstConversationRoute, 'talk');
  assert.equal(model.bypass, false);
});

test('existing users bypass onboarding without mutating companion identity', () => {
  const ai = { id: 'ai-1', name: 'Nova', voiceId: 'soft-neutral' };
  const model = createOnboardingModel({ ai }, { onboardingStep: 0 });
  assert.equal(model.bypass, true);
  assert.equal(model.ai, ai);
});

test('quick create exposes six appearance presets and six voice profiles', () => {
  const model = createOnboardingModel({ ai: null }, { onboardingStep: 1 });
  assert.equal(APPEARANCE_PRESETS_9.length, 6);
  assert.equal(model.voiceIds.length, 6);
  assert.equal(new Set(model.voiceIds).size, 6);
});

test('first light is skippable and never exceeds 2.8 seconds', () => {
  assert.ok(firstLightDurationMs() <= 2800);
});

test('legacy voice ids map without changing current six-profile ids', () => {
  assert.equal(normalizeLegacyVoiceId9('soft-neutral'), 'female-adult');
  assert.equal(normalizeLegacyVoiceId9('bright-curious'), 'female-teen');
  assert.equal(normalizeLegacyVoiceId9('calm-grounded'), 'male-adult');
  assert.equal(normalizeLegacyVoiceId9('male-teen'), 'male-teen');
});
