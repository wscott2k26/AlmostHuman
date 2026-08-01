import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { registerVersion10ServiceWorker10 } from '../app/version10-compat.js';

const sw = await readFile(new URL('../app/sw.js', import.meta.url), 'utf8');

test('Version 10 service worker owns a new cache namespace and every new shell asset', () => {
  assert.match(sw, /almost-human-v10-0-evolution-shell-1/);
  for (const asset of [
    'version10.css?v=10.0',
    'version10-appearance.css?v=10.0',
    'version10-compat.js?v=10.0',
    'version10.js?v=10.0',
    'core/appearance10.js',
    'core/origin10.js',
    'core/voiceProfile10.js',
    'core/evolution10.js',
    'features/creator10.js',
    'features/identityStudio10.js',
    'features/evolutionJourney10.js',
    'character/appearanceVisual10.js',
    'character/renderer10.js',
  ]) assert.match(sw, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('offline shell never caches function APIs or non-GET requests', () => {
  assert.match(sw, /request\.method\s*!==\s*'GET'/);
  assert.match(sw, /url\.pathname\.includes\('\/functions\/'\)/);
  assert.match(sw, /url\.pathname\.includes\('\/api\/'\)/);
});

test('Version 10 explicitly registers its cache version on web only', async () => {
  const calls = [];
  const web = await registerVersion10ServiceWorker10({
    navigatorObject: { serviceWorker: { register: async (value) => { calls.push(value); return { scope: '/' }; } } },
    locationObject: { protocol: 'https:' },
    nativeBundle: false,
  });
  assert.equal(web.scope, '/');
  assert.deepEqual(calls, ['./sw.js?v=10.0']);

  assert.equal(await registerVersion10ServiceWorker10({ navigatorObject: {}, locationObject: { protocol: 'https:' } }), null);
  assert.equal(await registerVersion10ServiceWorker10({ navigatorObject: { serviceWorker: {} }, locationObject: { protocol: 'file:' } }), null);
  assert.equal(await registerVersion10ServiceWorker10({ navigatorObject: { serviceWorker: {} }, locationObject: { protocol: 'https:' }, nativeBundle: true }), null);
});
