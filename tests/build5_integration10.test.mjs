import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  characterProjection10,
  createVersion10LayerModel,
  renderVersion10Layer10,
} from '../app/version10.js';
import { normalizeNativeBridgeMessage10 } from '../app/version10-compat.js';
import { renderCompanion10 } from '../app/character/renderer10.js';

const index = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
const stylesheet = await readFile(new URL('../app/version10.css', import.meta.url), 'utf8');

test('Version 10 loads as an additive layer after the stable application shell', () => {
  assert.match(index, /version10\.css\?v=10\.0/);
  assert.match(index, /type="module" src="\.\/version10\.js\?v=10\.0"/);
  assert.match(index, /type="module" src="\.\/app\.js\?v=10\.0"/);
  assert.ok(index.indexOf('app.js?v=10.0') < index.indexOf('version10.js?v=10.0'));
  assert.doesNotMatch(index, /recovery\/app__app|build5-source\.patch|BUILD5_INSTALL_FAILURE/);
});

test('new users receive the seven-step creator while existing users never repeat onboarding', () => {
  const fresh = createVersion10LayerModel({ ai: null, settings: {} });
  assert.equal(fresh.mode, 'creator');
  assert.deepEqual(fresh.steps, ['origin','identity','naming','appearance','style','voice','first-light']);

  const existing = createVersion10LayerModel({
    ai: { id: 'ai-1', rendererVersion: 9, developmentState: {} },
    settings: { tenUpgradeMomentDismissed: false },
  });
  assert.equal(existing.mode, 'upgrade');
  assert.equal(existing.reonboard, false);

  const upgraded = createVersion10LayerModel({
    ai: { id: 'ai-1', rendererVersion: 10, developmentState: {} },
    settings: { tenUpgradeMomentDismissed: false },
  });
  assert.equal(upgraded.mode, 'ambient');
  assert.equal(upgraded.reonboard, false);
});

test('character projection keeps the same companion identity and exposes real evolution evidence', () => {
  const state = {
    ai: {
      id: 'ai-1', name: 'Nova', presentation: 'neutral', stageKey: 'child', age: 8,
      currentMood: 'curious', appearanceProfile: {}, originProfile: {}, developmentState: {},
    },
    messages: [{ id: 'm-1' }], memories: [], milestones: [], skills: [], roomItems: [],
    settings: { reducedMotion: true, reducedTransparency: true },
  };
  const projection = characterProjection10(state, 'listening');
  assert.equal(projection.aiEntityId, 'ai-1');
  assert.equal(projection.name, 'Nova');
  assert.equal(projection.evolution.phase, 'young_persona');
  assert.equal(projection.activityState, 'listening');
  assert.equal(projection.reducedMotion, true);
  assert.equal(projection.reducedTransparency, true);
});

test('layer markup is semantic and contains no forced dependency or fake progress copy', () => {
  const model = createVersion10LayerModel({ ai: null, settings: {} });
  const html = renderVersion10Layer10(model);
  assert.match(html, /role="dialog"/);
  assert.match(html, /Origin Chamber/);
  assert.match(html, /data-v10-action="creator-next"/);
  assert.doesNotMatch(html, /loading your AI|please wait|avatar sdk|ready player me/i);
});

test('Version 10 semantic haptics use the already-certified native tap protocol', () => {
  assert.deepEqual(normalizeNativeBridgeMessage10({ type: 'v10-haptic', kind: 'selection' }), { type: 'tap', strength: 'light' });
  assert.deepEqual(normalizeNativeBridgeMessage10({ type: 'v10-haptic', kind: 'first-light' }), { type: 'tap', strength: 'success' });
  assert.deepEqual(normalizeNativeBridgeMessage10({ type: 'v10-haptic', kind: 'rollback' }), { type: 'tap', strength: 'medium' });
  assert.equal(
    normalizeNativeBridgeMessage10(JSON.stringify({ type: 'v10-haptic', kind: 'warning' })),
    JSON.stringify({ type: 'tap', strength: 'warning' }),
  );
  assert.equal(normalizeNativeBridgeMessage10('not-json'), 'not-json');
});

test('each rendered companion owns unique SVG gradients and filters', () => {
  const first = renderCompanion10({ aiEntityId: 'ai-1', name: 'Nova', evolution: { phase: 'young_persona' } });
  const second = renderCompanion10({ aiEntityId: 'ai-1', name: 'Nova', evolution: { phase: 'young_persona' } });
  const firstIds = [...first.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const secondIds = [...second.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(firstIds.length, 3);
  assert.equal(secondIds.length, 3);
  assert.equal(new Set([...firstIds, ...secondIds]).size, 6);
  for (const id of firstIds) assert.match(first, new RegExp(`url\\(#${id}\\)`));
  for (const id of secondIds) assert.match(second, new RegExp(`url\\(#${id}\\)`));
});

test('Version 10 stylesheet includes accessibility fallbacks and tactile controls', () => {
  assert.match(stylesheet, /prefers-reduced-motion/);
  assert.match(stylesheet, /reduce-transparency/);
  assert.match(stylesheet, /focus-visible/);
  assert.match(stylesheet, /min-height:\s*44px/);
  assert.match(stylesheet, /v10-character/);
  assert.match(stylesheet, /v10-origin-orb/);
});
