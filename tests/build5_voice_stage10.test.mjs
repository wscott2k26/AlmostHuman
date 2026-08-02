import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const helper = await readFile(new URL('../supabase/functions/_shared/voiceStage10.ts', import.meta.url), 'utf8');
const service = await readFile(new URL('../supabase/functions/voice-service/index.ts', import.meta.url), 'utf8');

test('voice stage helper preserves every developmental stage boundary', () => {
  for (const fragment of [
    "maxAge: 0.2, label: 'Newborn'",
    "maxAge: 1, label: 'Infant'",
    "maxAge: 3, label: 'Toddler'",
    "maxAge: 6, label: 'Early Child'",
    "maxAge: 10, label: 'Child'",
    "maxAge: 13, label: 'Preteen'",
    "maxAge: 18, label: 'Teen'",
    "maxAge: 25, label: 'Young Adult'",
    "maxAge: Number.POSITIVE_INFINITY, label: 'Adult'",
  ]) assert.match(helper, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('voice stage helper clamps aging speed and invalid timestamps safely', () => {
  assert.match(helper, /Math\.max\(1, Math\.min\(365/);
  assert.match(helper, /Number\.isFinite\(birthday\)/);
  assert.match(helper, /Math\.max\(0, elapsedDays/);
});

test('voice service imports only the focused voice stage contract', () => {
  assert.match(service, /voiceStage10\.ts/);
  assert.doesNotMatch(service, /developmentalStages\.ts/);
  assert.match(service, /computeVoiceAge10/);
  assert.match(service, /voiceStageLabel10/);
  assert.match(service, /clampVoiceDaysPerYear10/);
});
