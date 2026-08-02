import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { focusableVersion10Elements10 } from '../app/version10-compat.js';

const source = await readFile(new URL('../app/version10-compat.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../app/version10.css', import.meta.url), 'utf8');

test('dialog accessibility isolates the stable app and restores focus', () => {
  assert.match(source, /appRoot\.inert\s*=\s*true/);
  assert.match(source, /appRoot\.inert\s*=\s*false/);
  assert.match(source, /previousFocus10/);
  assert.match(source, /preventScroll:\s*true/);
  assert.match(source, /MutationObserver/);
});

test('keyboard focus wraps inside active Version 10 dialogs', () => {
  assert.match(source, /event\.key\s*!==\s*'Tab'/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /document\.activeElement\s*===\s*first/);
  assert.match(source, /document\.activeElement\s*===\s*last/);
  const visible = { hidden: false, getAttribute: () => null };
  const hidden = { hidden: true, getAttribute: () => null };
  const ariaHidden = { hidden: false, getAttribute: (name) => name === 'aria-hidden' ? 'true' : null };
  const dialog = { querySelectorAll: () => [visible, hidden, ariaHidden] };
  assert.deepEqual(focusableVersion10Elements10(dialog), [visible]);
});

test('all interactive Version 10 controls retain visible focus and touch sizing', () => {
  assert.match(css, /focus-visible/);
  assert.match(css, /outline:\s*3px/);
  assert.match(css, /min-height:\s*44px/);
});
