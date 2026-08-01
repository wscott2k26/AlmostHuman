import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEventStream, encodeStreamEvent, createOptimisticTurn, applyStreamEvent } from '../app/core/chatStream.js';

function streamOf(chunks) {
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(new TextEncoder().encode(chunk)));
      controller.close();
    },
  });
}

test('stream parser handles split UTF-8 chunks and ordered events', async () => {
  const events = [];
  const raw = `${encodeStreamEvent('ack', { requestId: 'r1' })}${encodeStreamEvent('delta', { text: 'Hello 🌎' })}${encodeStreamEvent('done', { text: 'Hello 🌎' })}`;
  const cut = Math.floor(raw.length / 2);
  await parseEventStream(streamOf([raw.slice(0, cut), raw.slice(cut)]), (event) => events.push(event));
  assert.deepEqual(events.map((event) => event.type), ['ack', 'delta', 'done']);
  assert.equal(events[1].data.text, 'Hello 🌎');
});

test('malformed event becomes a normalized stream error', async () => {
  const events = [];
  await parseEventStream(streamOf(['event: delta\ndata: {bad}\n\n']), (event) => events.push(event));
  assert.equal(events[0].type, 'error');
  assert.equal(events[0].data.code, 'MALFORMED_STREAM_EVENT');
});

test('optimistic turn appears immediately and finalizes one assistant message', () => {
  const draft = { messages: [], generationRequests: [] };
  const turn = createOptimisticTurn(draft, { requestId: 'r1', conversationId: 'c1', text: 'Hi', now: 100 });
  assert.equal(draft.messages.length, 2);
  assert.equal(draft.messages[0].sender, 'user');
  assert.equal(draft.messages[1].status, 'pending');
  applyStreamEvent(draft, turn, { type: 'delta', data: { text: 'Hello' } });
  applyStreamEvent(draft, turn, { type: 'done', data: { text: 'Hello there', messageId: 'cloud-ai' } });
  assert.equal(draft.messages.length, 2);
  assert.equal(draft.messages[1].content, 'Hello there');
  assert.equal(draft.messages[1].status, 'complete');
  assert.equal(draft.messages[1].cloudId, 'cloud-ai');
});

test('same request id reuses optimistic turn', () => {
  const draft = { messages: [], generationRequests: [] };
  const first = createOptimisticTurn(draft, { requestId: 'same', conversationId: 'c1', text: 'Hi', now: 100 });
  const second = createOptimisticTurn(draft, { requestId: 'same', conversationId: 'c1', text: 'Hi', now: 101 });
  assert.equal(first.aiMessageId, second.aiMessageId);
  assert.equal(draft.messages.length, 2);
});
