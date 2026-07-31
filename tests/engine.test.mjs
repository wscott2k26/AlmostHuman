import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../app/core/store.js';
import { AlmostHumanEngine } from '../app/core/engine.js';
import { normalizeText } from '../app/core/anti-repetition.js';

test('awakening creates one coherent life foundation', () => {
  const state = defaultState(0);
  const engine = new AlmostHumanEngine(state);
  const result = engine.awaken({ name: 'Nova', caregiverName: 'Will', pronouns: 'they/them', appearanceSeed: 'violet-dawn', acceptedSafety: true }, 0);
  assert.equal(result.ai.name, 'Nova');
  assert.equal(state.conversations.length, 1);
  assert.equal(state.milestones.filter((item) => item.eventKey === 'life:awakening').length, 1);
  assert.equal(state.memories.filter((item) => item.isCore).length, 1);
  assert.ok(state.roomItems.length >= 1);
});

test('growth reconciliation is idempotent across birthdays and stages', () => {
  const state = defaultState(0);
  const engine = new AlmostHumanEngine(state);
  engine.awaken({ name: 'Nova' }, 0);
  const oneYear = 14 * 86_400_000;
  engine.reconcileGrowth(oneYear * 15);
  const firstCount = state.milestones.length;
  const eventKeys = state.milestones.map((item) => item.eventKey);
  assert.equal(new Set(eventKeys).size, eventKeys.length);
  engine.reconcileGrowth(oneYear * 15);
  assert.equal(state.milestones.length, firstCount);
  assert.equal(new Set(state.milestones.map((item) => item.eventKey)).size, state.milestones.length);
});

test('conversation stress sequence does not loop or violate boundaries', async () => {
  const state = defaultState(0);
  const engine = new AlmostHumanEngine(state);
  engine.awaken({ name: 'Nova', caregiverName: 'Will' }, 0);
  const conversationId = state.conversations[0].id;
  const sequence = ['Hi', 'Huh', 'Idk', 'Why do you keep asking that?', 'Change the subject', 'I already told you', 'Stop asking questions'];
  const outputs = [];
  for (let index = 0; index < sequence.length; index += 1) {
    const result = await engine.sendMessage(sequence[index], { conversationId, now: 1000 + index * 1000, requestId: `stress_${index}` });
    outputs.push(result.aiMessage.content);
  }
  assert.equal(new Set(outputs.map(normalizeText)).size, outputs.length);
  assert.match(outputs[3], /right|loop|reset|stuck|already/i);
  assert.doesNotMatch(outputs.at(-1), /\?/);
  assert.equal(state.messages.length, sequence.length * 2);
});

test('request idempotency returns the already saved AI message', async () => {
  const state = defaultState(0);
  const engine = new AlmostHumanEngine(state);
  engine.awaken({ name: 'Nova' }, 0);
  const conversationId = state.conversations[0].id;
  const first = await engine.sendMessage('Hello', { conversationId, now: 1000, requestId: 'same_request' });
  const second = await engine.sendMessage('Hello', { conversationId, now: 2000, requestId: 'same_request' });
  assert.equal(second.replayed, true);
  assert.equal(second.aiMessage.id, first.aiMessage.id);
  assert.equal(state.messages.filter((item) => item.requestId === 'same_request').length, 2);
});

test('facts and memories emerge without a preset personality jump', async () => {
  const state = defaultState(0);
  const engine = new AlmostHumanEngine(state);
  engine.awaken({ name: 'Nova' }, 0);
  const before = { ...state.ai.personality };
  await engine.sendMessage('My favorite color is purple. Remember that my dog is named Luna.', { conversationId: state.conversations[0].id, now: 1000, requestId: 'learn' });
  assert.ok(state.facts.some((fact) => fact.key === 'favorite_color'));
  assert.ok(state.memories.some((memory) => /dog is named luna/i.test(memory.content)));
  for (const key of Object.keys(before)) assert.ok(Math.abs(state.ai.personality[key] - before[key]) < 2);
});

test('activities, letters, and room unlocks are functional', () => {
  const state = defaultState(0);
  const engine = new AlmostHumanEngine(state);
  engine.awaken({ name: 'Nova' }, 0);
  state.ai.age = 8;
  state.ai.stageKey = 'child';
  const story = engine.doActivity('story', 'a brave little bear', 1000);
  assert.equal(story.type, 'story');
  assert.ok(state.skills.some((skill) => skill.name === 'Storytelling'));
  const letter = engine.createLetter({ title: 'For later', content: 'Remember who raised you.', unlockAge: 9 }, 2000);
  assert.throws(() => engine.openLetter(letter.id, 3000), /unlocks/);
  state.ai.age = 9;
  engine.unlockLetters(9, 4000);
  assert.equal(engine.openLetter(letter.id, 5000).openedAt !== null, true);
});

test('cloud provider IDs are attached to the matching local messages', async () => {
  const state = defaultState(0);
  const engine = new AlmostHumanEngine(state);
  engine.awaken({ name: 'Nova' }, 0);
  const result = await engine.sendMessage('Hello cloud', {
    conversationId: state.conversations[0].id,
    now: 1000,
    requestId: 'cloud-id-map',
    localAiMessageId: 'local-ai-message',
    provider: async (context) => {
      assert.equal(context.localUserMessageId, state.messages.find((message) => message.sender === 'user').id);
      assert.equal(context.localAiMessageId, 'local-ai-message');
      return { text: 'Hello back.', cloudUserMessageId: 'cloud-user-message', cloudMessageId: 'cloud-ai-message', mode: 'cloud-ai' };
    },
  });
  assert.equal(result.userMessage.cloudId, 'cloud-user-message');
  assert.equal(result.aiMessage.id, 'local-ai-message');
  assert.equal(result.aiMessage.cloudId, 'cloud-ai-message');
});

test('activity local ID is preserved across local and cloud records', () => {
  const state = defaultState(0);
  const engine = new AlmostHumanEngine(state);
  engine.awaken({ name: 'Nova' }, 0);
  state.ai.age = 8;
  state.ai.stageKey = 'child';
  const record = engine.doActivity('story', 'the moon', 1000, { content: 'A cloud story.', activity_id: 'cloud-activity', request_id: 'request-activity' }, 'local-activity');
  assert.equal(record.id, 'local-activity');
  assert.equal(record.cloudActivityId, 'cloud-activity');
  assert.equal(record.requestId, 'request-activity');
});
