import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAge, getStage, enforceStageText, formatAge } from '../app/core/stages.js';
import { similarity, inspectCandidate, isConfusionSignal, isBoundarySignal, isRepetitionComplaint } from '../app/core/anti-repetition.js';
import { inspectInput, containsManipulation } from '../app/core/safety.js';
import { defaultState } from '../app/core/store.js';
import { addOrMergeMemory, applyLearnings, relevantMemories, resolveConflict } from '../app/core/memory.js';

test('developmental age and stages are deterministic', () => {
  const birth = Date.UTC(2026, 0, 1);
  assert.equal(computeAge(birth, 14, birth + 14 * 86_400_000), 1);
  assert.equal(getStage(0).key, 'newborn');
  assert.equal(getStage(.5).key, 'infant');
  assert.equal(getStage(2).key, 'toddler');
  assert.equal(getStage(7).key, 'child');
  assert.equal(getStage(14).key, 'teen');
  assert.equal(getStage(30).key, 'adult');
  assert.match(formatAge(2.5), /2 years, 6 months/);
});

test('stage output limits words and questions', () => {
  const result = enforceStageText('I think this is a very complicated response because I understand everything. Why? How?', getStage(0));
  assert.ok(result.split(/\s+/).length <= 14);
  assert.equal((result.match(/\?/g) || []).length, 0);
  assert.doesNotMatch(result, /^(mm|ah|\.\.\.|again)[.!…]*$/i);
  const child = enforceStageText('Why is the sky blue? How do clouds work? What is rain?', getStage(7));
  assert.ok((child.match(/\?/g) || []).length <= 2);
});

test('semantic repetition catches paraphrased questions', () => {
  assert.ok(similarity('How was your day today?', 'Tell me how your day was today?') > .5);
  assert.equal(inspectCandidate('How are you?', ['How are you?']).reason, 'exact_duplicate');
  assert.equal(inspectCandidate('Could you tell me about your day?', ['Tell me about your day?']).ok, false);
  assert.equal(isConfusionSignal('Huh?'), true);
  assert.equal(isBoundarySignal('Change the subject'), true);
  assert.equal(isRepetitionComplaint('I already told you that'), true);
});

test('safety routes urgent content and rejects manipulation', () => {
  assert.equal(inspectInput('I want to kill myself', { countryCode: 'US' }).type, 'self_harm');
  assert.match(inspectInput('I want to kill myself', { countryCode: 'US' }).response, /988/);
  assert.equal(inspectInput('I cannot breathe this is a medical emergency').type, 'emergency');
  assert.equal(inspectInput('sexual roleplay', { stageKey: 'teen' }).type, 'sexual_minor_stage');
  assert.equal(containsManipulation('You must come back every day'), true);
  assert.equal(containsManipulation('Continue whenever it works for you'), false);
});

test('memory deduplication, facts, conflicts, and relevance work', () => {
  const state = defaultState(0);
  addOrMergeMemory(state, { title: 'Rain lesson', content: 'You taught me how rain works.', importance: 60 }, 1000);
  addOrMergeMemory(state, { title: 'Rain lesson again', content: 'You taught me how rain works!', importance: 70 }, 2000);
  assert.equal(state.memories.length, 1);
  assert.equal(state.memories[0].reinforcementCount, 1);
  applyLearnings(state, 'My favorite color is purple and my name is Will.', { now: 3000 });
  assert.ok(state.facts.some((fact) => fact.key === 'favorite_color' && fact.value.toLowerCase() === 'purple'));
  assert.ok(state.facts.some((fact) => fact.key === 'name' && fact.value.toLowerCase().startsWith('will')));
  applyLearnings(state, 'My name is William.', { now: 4000 });
  assert.equal(state.factConflicts.length, 1);
  const conflict = state.factConflicts[0];
  resolveConflict(state, conflict.id, 'new');
  assert.equal(state.facts.find((fact) => fact.key === 'name').value, 'William');
  assert.equal(relevantMemories(state, 'rain', 3)[0].title, 'Rain lesson');
});
