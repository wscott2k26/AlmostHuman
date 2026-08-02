import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { shouldDeferVersion10ForAccess10 } from '../app/version10.js';

const source = await readFile(new URL('../app/version10.js', import.meta.url), 'utf8');

test('Version 10 waits for the stable app shell before reading companion state', () => {
  assert.match(source, /awaitStableAppShell10/);
  assert.match(source, /await\s+awaitStableAppShell10\(/);
});

test('access gate defers creator while onboarding and restored lives may continue', () => {
  const gateRoot = { querySelector: (selector) => selector === '.v8-gate' ? {} : null };
  const onboardingRoot = { querySelector: () => null };
  assert.equal(shouldDeferVersion10ForAccess10(gateRoot), true);
  assert.equal(shouldDeferVersion10ForAccess10(onboardingRoot), false);
  assert.equal(shouldDeferVersion10ForAccess10(null), false);
});

test('access transition re-reads the shared state before rendering Version 10', () => {
  assert.match(source, /refreshAfterAccessTransition10/);
  assert.match(source, /runtime\.state\s*=\s*await\s+readState10\(\)/);
  assert.match(source, /MutationObserver/);
});
