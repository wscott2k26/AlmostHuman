import test from 'node:test';
import assert from 'node:assert/strict';

import { primaryDestinations9, settingsEntry9 } from '../app/features/navigation9.js';

test('9.0 has five primary destinations and settings is not a tab', () => {
  const items = primaryDestinations9();
  assert.deepEqual(items.map((item) => item.route), ['home', 'talk', 'grow', 'memories', 'world']);
  assert.equal(items.some((item) => item.route === 'settings'), false);
});

test('chat is the emphasized center destination', () => {
  const items = primaryDestinations9();
  assert.equal(items[2].route, 'grow');
  const chat = items.find((item) => item.route === 'talk');
  assert.equal(chat?.emphasized, true);
});

test('settings remains reachable from a profile control', () => {
  assert.deepEqual(settingsEntry9(), { route: 'settings', label: 'Settings', source: 'profile' });
});
