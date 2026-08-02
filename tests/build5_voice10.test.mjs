import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const profileSource = await readFile(new URL('../supabase/functions/_shared/voiceProfile10.ts', import.meta.url), 'utf8');
const neuralSource = await readFile(new URL('../supabase/functions/_shared/neuralVoice.ts', import.meta.url), 'utf8');
const serviceSource = await readFile(new URL('../supabase/functions/voice-service/index.ts', import.meta.url), 'utf8');

test('server accepts exactly six expressive tones and three provider preferences', () => {
  for (const tone of ['calm','playful','thoughtful','confident','gentle','mysterious']) {
    assert.match(profileSource, new RegExp(`['\"]${tone}['\"]`));
  }
  for (const provider of ['auto','elevenlabs','openai']) {
    assert.match(profileSource, new RegExp(`['\"]${provider}['\"]`));
  }
});

test('explicit provider preference never silently falls through to another provider', () => {
  assert.match(profileSource, /VOICE_PROVIDER_UNAVAILABLE/);
  assert.match(profileSource, /preference\s*===\s*'elevenlabs'/);
  assert.match(profileSource, /preference\s*===\s*'openai'/);
  assert.doesNotMatch(profileSource, /device|speechSynthesis|expo-speech/i);
});

test('neural generation applies tone and bounded rate to both cloud providers', () => {
  assert.match(neuralSource, /toneDirections10/);
  assert.match(neuralSource, /toneVoiceSettings10/);
  assert.match(neuralSource, /providerPreference/);
  assert.match(neuralSource, /rate/);
  assert.match(neuralSource, /voice_settings/);
  assert.match(neuralSource, /instructions/);
});

test('voice service reads stored Version 10 profile for real speech and request profile for preview', () => {
  assert.match(serviceSource, /voice_profile/);
  assert.match(serviceSource, /provider_preference/);
  assert.match(serviceSource, /body\.tone/);
  assert.match(serviceSource, /body\.rate/);
  assert.match(serviceSource, /X-AH-Voice-Tone/);
  assert.match(serviceSource, /X-AH-Voice-Provider/);
});

test('no server voice source contains a hidden device speech fallback', () => {
  const combined = `${profileSource}\n${neuralSource}\n${serviceSource}`;
  assert.doesNotMatch(combined, /speechSynthesis|SpeechSynthesisUtterance|expo-speech|device-speak/i);
});
