import test from 'node:test';
import assert from 'node:assert/strict';
import { homeModel9 } from '../app/features/home9.js';
import { growthModel9 } from '../app/features/growth9.js';
import { memoryListModel9 } from '../app/features/memories9.js';
import { havenSceneModel9 } from '../app/features/haven9.js';

const state = {
  ai: { name: 'Nova', age: 2, currentMood: 'curious' },
  memories: [{ id: 'm1', title: 'Rain', content: 'A rainy day', hidden: false }],
  milestones: [{ id: 'x1', title: 'First hello' }],
  activities: [], roomItems: [{ id: 'r1', name: 'Desk', itemName: 'Desk', isUnlocked: true }],
};

test('home has one primary conversation action and at most three secondary blocks', () => {
  const model = homeModel9(state);
  assert.equal(model.primaryAction.route, 'talk');
  assert.ok(model.secondaryBlocks.length <= 3);
});

test('growth is plain-language stage, recent, next, activities', () => {
  const model = growthModel9(state);
  assert.deepEqual(Object.keys(model), ['stage', 'recentChange', 'nextAbility', 'activities']);
});

test('memory list defaults to readable cards without destructive controls', () => {
  const model = memoryListModel9(state, 'rain');
  assert.equal(model.items.length, 1);
  assert.equal('deleteAction' in model.items[0], false);
});

test('haven defaults to scene and reveals selected object only', () => {
  const initial = havenSceneModel9(state);
  assert.equal(initial.selected, null);
  const selected = havenSceneModel9(state, 'r1');
  assert.equal(selected.selected.id, 'r1');
});
