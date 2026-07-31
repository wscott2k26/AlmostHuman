import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateState, DATA_VERSION } from '../app/core/store.js';

const old = {
  version: 5,
  profile: { id: 'u1', displayName: 'Will' },
  settings: { theme: 'cosmic' },
  ai: { id: 'ai1', name: 'Nova', voiceId: 'soft-neutral', appearanceProfile: { skinTone: 'deep', hairStyle: 'locs', hairColor: 'midnight', eyeColor: 'brown' } },
  conversations: [{ id: 'c1', title: 'History' }],
  messages: [{ id: 'm1', conversationId: 'c1', sender: 'user', content: 'Never change this', createdAt: '2026-01-01T00:00:00Z' }],
  memories: [{ id: 'mem1', content: 'Keep me', createdAt: '2026-01-02T00:00:00Z' }],
  roomItems: [{ id: 'room1', name: 'Desk' }],
};

test('9.0 migration preserves user content and stable ids', () => {
  const migrated = migrateState(old);
  assert.ok(DATA_VERSION >= 6);
  assert.equal(migrated.ai.id, 'ai1');
  assert.equal(migrated.ai.voiceId, 'female-adult');
  assert.deepEqual(migrated.messages, old.messages);
  assert.deepEqual(migrated.memories, old.memories);
  assert.deepEqual(migrated.roomItems, old.roomItems);
  assert.equal(migrated.settings.showNineUpgradeCard, true);
});

test('9.0 migration is idempotent', () => {
  const once = migrateState(old);
  const twice = migrateState(once);
  assert.deepEqual(twice.messages, once.messages);
  assert.equal(twice.diagnostics.migrations.filter((item) => item.to === DATA_VERSION).length, once.diagnostics.migrations.filter((item) => item.to === DATA_VERSION).length);
});
