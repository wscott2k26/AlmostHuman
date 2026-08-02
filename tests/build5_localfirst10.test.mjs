import test from 'node:test';
import assert from 'node:assert/strict';

import { commitVersion10LocalFirst10 } from '../app/version10.js';

function state10() {
  return {
    ai: { id: 'ai-one', name: 'Nova' },
    conversations: [{ id: 'conversation-one' }],
    settings: { cloudSyncEnabled: true },
    diagnostics: {},
  };
}

test('local companion commit remains authoritative when cloud sync fails', async () => {
  const draft = state10();
  const persisted = [];
  const cloud = {
    authenticated: true,
    ensureCloudIdentity: async () => { throw new Error('temporary network failure'); },
    ensureCloudConversation: async () => { throw new Error('must not continue after identity failure'); },
    syncProfileAndSettings: async () => { throw new Error('must not continue after identity failure'); },
  };
  const result = await commitVersion10LocalFirst10(draft, {
    includeConversation: true,
    persist: async (value) => { persisted.push(structuredClone(value)); return value; },
    cloudFactory: () => cloud,
  });
  assert.equal(result.localCommitted, true);
  assert.equal(result.cloudSynced, false);
  assert.equal(result.state.ai.id, 'ai-one');
  assert.equal(persisted[0].ai.id, 'ai-one');
  assert.equal(result.state.diagnostics.cloudSyncPending, true);
  assert.match(result.state.diagnostics.lastError.message, /temporary network failure/);
});

test('successful cloud sync preserves the same local companion and conversation IDs', async () => {
  const draft = state10();
  const calls = [];
  const cloud = {
    authenticated: true,
    ensureCloudIdentity: async (state, force) => { calls.push(['identity', state.ai.id, force]); },
    ensureCloudConversation: async (state, conversation, force) => { calls.push(['conversation', state.ai.id, conversation.id, force]); },
    syncProfileAndSettings: async (state) => { calls.push(['profile', state.ai.id]); },
  };
  const result = await commitVersion10LocalFirst10(draft, {
    includeConversation: true,
    persist: async (value) => value,
    cloudFactory: () => cloud,
  });
  assert.equal(result.localCommitted, true);
  assert.equal(result.cloudSynced, true);
  assert.equal(result.state.ai.id, 'ai-one');
  assert.deepEqual(calls, [
    ['identity', 'ai-one', true],
    ['conversation', 'ai-one', 'conversation-one', true],
    ['profile', 'ai-one'],
  ]);
});
