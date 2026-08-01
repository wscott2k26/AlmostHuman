import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentSpeakablePhrases, PhraseAudioQueue } from '../app/core/phraseQueue.js';

test('segments complete phrases without splitting abbreviations or decimals', () => {
  const result = segmentSpeakablePhrases('Dr. Reed paid 3.50 today. That worked, and it felt natural. Last bit', 0, true);
  assert.deepEqual(result.phrases, ['Dr. Reed paid 3.50 today.', 'That worked, and it felt natural.', 'Last bit']);
});

test('returns only newly completed phrases from cursor', () => {
  const first = segmentSpeakablePhrases('Hello there. Another', 0, false);
  assert.deepEqual(first.phrases, ['Hello there.']);
  const second = segmentSpeakablePhrases('Hello there. Another thought!', first.cursor, false);
  assert.deepEqual(second.phrases, ['Another thought!']);
});

test('queue preserves order and stop clears active and pending phrases', async () => {
  const starts = [];
  const releases = new Map();
  const queue = new PhraseAudioQueue({
    fetchAudio: async ({ id }) => ({ id }),
    playAudio: async ({ id }, signal) => {
      starts.push(id);
      await new Promise((resolve) => {
        releases.set(id, resolve);
        signal.addEventListener('abort', resolve, { once: true });
      });
    },
  });
  queue.enqueue({ id: '1', text: 'One.', voiceId: 'female-adult' });
  queue.enqueue({ id: '2', text: 'Two.', voiceId: 'female-adult' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(starts, ['1']);
  releases.get('1')();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(starts, ['1', '2']);
  queue.stop();
  assert.equal(queue.size, 0);
});
