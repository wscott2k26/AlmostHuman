import test from 'node:test';
import assert from 'node:assert/strict';
import { ConversationTimings, sanitizeTimingSample } from '../app/core/performance9.js';

test('timings calculate non-negative conversation durations', () => {
  const timings = new ConversationTimings('r1', 1000);
  timings.markFirstDelta(1200);
  timings.markDone(1800);
  timings.markFirstAudio(1500);
  const sample = timings.toSample();
  assert.equal(sample.firstDeltaMs, 200);
  assert.equal(sample.finalTextMs, 800);
  assert.equal(sample.firstAudioMs, 500);
});

test('sanitized samples never retain text or audio', () => {
  const sample = sanitizeTimingSample({ requestId: 'r1', text: 'secret', audioBase64: 'secret', firstDeltaMs: 20, finalTextMs: 100 });
  assert.equal('text' in sample, false);
  assert.equal('audioBase64' in sample, false);
  assert.equal(sample.firstDeltaMs, 20);
});
