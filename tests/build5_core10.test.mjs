import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APPEARANCE_FIELDS_10,
  APPEARANCE_OPTIONS_10,
  APPEARANCE_PRESETS_10,
  compareAppearance10,
  createVisualSnapshot10,
  normalizeAppearance10,
} from '../app/core/appearance10.js';
import {
  FIRST_LIGHT_PHASES_10,
  createFirstLightMachine10,
  normalizeOrigin10,
} from '../app/core/origin10.js';
import {
  PUBLIC_VOICE_IDS_10,
  VOICE_TONES_10,
  normalizeVoiceProfile10,
  voicePreviewRequest10,
} from '../app/core/voiceProfile10.js';
import {
  EVOLUTION_WEIGHTS_10,
  applyEvolutionTransition10,
  computeEvolution10,
  evolutionEventKey10,
} from '../app/core/evolution10.js';
import { DATA_VERSION, migrateState } from '../app/core/store.js';
import {
  CREATOR_STEPS_10,
  applyCreatorAction10,
  createCreatorState10,
} from '../app/features/creator10.js';
import {
  rollbackVisualIdentity10,
  saveVisualIdentity10,
} from '../app/features/identityStudio10.js';

test('appearance schema exposes every approved editable category and six local presets', () => {
  assert.deepEqual(APPEARANCE_FIELDS_10, [
    'skinTone','skinUndertone','faceShape','eyeShape','eyeColor',
    'browShape','browWeight','hairStyle','hairTexture','hairColor',
    'facialHair','bodySilhouette','styleDirection',
  ]);
  assert.equal(APPEARANCE_PRESETS_10.length, 6);
  for (const field of APPEARANCE_FIELDS_10) {
    assert.ok(APPEARANCE_OPTIONS_10[field].length >= 3, `${field} needs meaningful choices`);
  }
  const normalized = normalizeAppearance10({ skinTone: 'invalid', hairStyle: 'locs' });
  assert.equal(normalized.skinTone, 'warm');
  assert.equal(normalized.hairTexture, 'locs');
  assert.deepEqual(compareAppearance10(normalized, { ...normalized, eyeColor: 'violet' }), ['eyeColor']);
});

test('First Light is ordered, cinematic, interrupt-safe, and accessible', () => {
  const full = createFirstLightMachine10({ startedAt: 10 });
  const reduced = createFirstLightMachine10({ reducedMotion: true, startedAt: 10 });
  assert.deepEqual(full.phases, FIRST_LIGHT_PHASES_10);
  assert.ok(full.durationMs >= 6000 && full.durationMs <= 8000);
  assert.ok(reduced.durationMs <= 1200);
  assert.equal(full.phaseAt(-100).key, 'stabilize');
  assert.equal(full.phaseAt(full.durationMs).key, 'haven');
  assert.equal(full.phaseAt(full.durationMs).complete, true);
  assert.equal(normalizeOrigin10({ materialFamily: 'unknown' }).materialFamily, 'luminous-resin');
});

test('voice profiles preserve six public identities and six expressive tones without secrets', () => {
  assert.equal(PUBLIC_VOICE_IDS_10.length, 6);
  assert.equal(new Set(PUBLIC_VOICE_IDS_10).size, 6);
  assert.equal(VOICE_TONES_10.length, 6);
  const profile = normalizeVoiceProfile10({ voiceId: 'male-teen', tone: 'mysterious', rate: 9, providerPreference: 'openai' });
  assert.equal(profile.rate, 1.18);
  const request = voicePreviewRequest10(profile, 'x'.repeat(500));
  assert.equal(request.text.length, 320);
  assert.equal(request.voice_id, 'male-teen');
  assert.equal(request.tone, 'mysterious');
  assert.deepEqual(Object.keys(request).sort(), [
    'preview','preview_version','provider_preference','rate','text','tone','voice_id',
  ]);
});

test('evolution uses approved weights, age caps, and idempotent receipts', () => {
  assert.equal(Object.values(EVOLUTION_WEIGHTS_10).reduce((sum, value) => sum + value, 0), 1);
  const draft = {
    ai: { id: 'ai-1', name: 'Nova', stageKey: 'child', age: 8, developmentState: {} },
    messages: Array.from({ length: 80 }, (_, id) => ({ id })),
    memories: [{ id: 'm1', importance: 90 }],
    milestones: [], skills: [], roomItems: [],
  };
  const result = computeEvolution10(draft);
  assert.equal(result.phase, 'young_persona');
  assert.equal(result.stageCap, 'young_persona');
  assert.equal(evolutionEventKey10('ai-1', result.phase), 'evolution:ai-1:young_persona');
  assert.equal(applyEvolutionTransition10(draft, result, 1000), true);
  assert.equal(applyEvolutionTransition10(draft, result, 2000), false);
  assert.equal(draft.ai.developmentState.evolutionReceipts.length, 1);
  assert.equal(draft.milestones.filter((item) => item.eventKey === 'evolution:ai-1:young_persona').length, 1);
});

test('Version 6 migration is additive, idempotent, and preserves history IDs', () => {
  const legacy = {
    version: 6,
    ai: {
      id: 'ai-legacy', name: 'Nova', pronouns: 'she/her', voiceId: 'soft-neutral',
      appearanceSeed: 'ember', appearanceProfile: { hairStyle: 'curls' },
      developmentState: {}, createdAt: '2026-07-01T00:00:00.000Z',
    },
    conversations: [{ id: 'c-1' }],
    messages: [{ id: 'msg-1', conversationId: 'c-1' }],
    memories: [{ id: 'mem-1' }],
    milestones: [{ id: 'mile-1' }],
  };
  const first = migrateState(legacy);
  const second = migrateState(first);
  assert.equal(DATA_VERSION, 7);
  assert.equal(first.ai.id, 'ai-legacy');
  assert.equal(first.ai.presentation, 'feminine');
  assert.equal(first.ai.voiceId, 'female-adult');
  assert.equal(first.ai.developmentState.visualRollbackSnapshots.length, 1);
  assert.equal(second.ai.developmentState.visualRollbackSnapshots.length, 1);
  assert.deepEqual(second.conversations.map(({ id }) => id), ['c-1']);
  assert.deepEqual(second.messages.map(({ id }) => id), ['msg-1']);
  assert.deepEqual(second.memories.map(({ id }) => id), ['mem-1']);
  assert.deepEqual(second.milestones.map(({ id }) => id), ['mile-1']);
});

test('creator and Identity Studio keep presentation independent and rollback only visual state', () => {
  assert.deepEqual(CREATOR_STEPS_10, ['origin','identity','naming','appearance','style','voice','first-light']);
  let creator = createCreatorState10({ name: 'Nova', presentation: 'neutral', pronouns: 'she/her' });
  creator = applyCreatorAction10(creator, { type: 'set-field', field: 'presentation', value: 'masculine' });
  assert.equal(creator.presentation, 'masculine');
  assert.equal(creator.pronouns, 'she/her');

  const draft = {
    ai: {
      id: 'ai-1', name: 'Nova', presentation: 'neutral', pronouns: 'they/them',
      appearanceSeed: 'ember', appearanceProfile: normalizeAppearance10({ eyeColor: 'brown' }),
      originProfile: normalizeOrigin10({}), voiceId: 'female-adult',
      voiceProfile: normalizeVoiceProfile10({}), rendererVersion: 9,
      developmentState: {}, updatedAt: '2026-07-01T00:00:00.000Z',
    },
    messages: [{ id: 'msg-1', content: 'hello' }],
    memories: [{ id: 'mem-1', content: 'first hello' }],
  };
  const historyBefore = JSON.stringify({ messages: draft.messages, memories: draft.memories });
  const saved = saveVisualIdentity10(draft, { appearanceProfile: { eyeColor: 'violet' } }, 'test-edit', 1000);
  assert.equal(draft.ai.appearanceProfile.eyeColor, 'violet');
  assert.equal(rollbackVisualIdentity10(draft, saved.snapshot.id, 2000), true);
  assert.equal(draft.ai.appearanceProfile.eyeColor, 'brown');
  assert.equal(JSON.stringify({ messages: draft.messages, memories: draft.memories }), historyBefore);
  assert.deepEqual(createVisualSnapshot10(draft.ai).aiEntityId, 'ai-1');
});
