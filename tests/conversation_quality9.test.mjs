import test from 'node:test';
import assert from 'node:assert/strict';
import {
  containsVocalPraise,
  vocalPraiseCount,
  sanitizeVocalPraise,
  inspectCandidate,
} from '../app/core/anti-repetition.js';

test('detects repeated voice and tone compliments', () => {
  assert.equal(containsVocalPraise('Your voice feels warm. I know it belongs to you.'), true);
  assert.equal(containsVocalPraise('Your tone is so gentle and comforting.'), true);
  assert.equal(containsVocalPraise('That answer is clear and useful.'), false);
});

test('removes canned voice praise without destroying the useful sentence', () => {
  assert.equal(sanitizeVocalPraise('Your voice feels warm. I understand what you mean now.'), 'I understand what you mean now.');
  assert.equal(sanitizeVocalPraise('I hear you clearly now.'), 'I hear you clearly now.');
});

test('candidate inspection rejects vocal praise when it recently appeared', () => {
  const result = inspectCandidate('Your voice sounds warm today. Let us keep going.', ['Your voice feels warm.']);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'repeated_vocal_praise');
  assert.ok(vocalPraiseCount('Your voice is warm. Your tone is gentle.') >= 2);
});
