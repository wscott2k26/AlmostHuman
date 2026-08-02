import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { APPEARANCE_OPTIONS_10, normalizeAppearance10 } from '../app/core/appearance10.js';
import { appearanceVisualTokens10 } from '../app/character/appearanceVisual10.js';

const css = await readFile(new URL('../app/version10-appearance.css', import.meta.url), 'utf8');
const index = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
const renderer = await readFile(new URL('../app/character/renderer10.js', import.meta.url), 'utf8');

test('skin, undertone, eye, hair, brow weight, and style direction produce renderer tokens', () => {
  const base = normalizeAppearance10({});
  const fields = ['skinTone','skinUndertone','eyeColor','hairColor','browWeight','styleDirection'];
  for (const field of fields) {
    const first = appearanceVisualTokens10({ ...base, [field]: APPEARANCE_OPTIONS_10[field][0] });
    const last = appearanceVisualTokens10({ ...base, [field]: APPEARANCE_OPTIONS_10[field].at(-1) });
    assert.notDeepEqual(first, last, `${field} must change visible CSS tokens`);
  }
});

test('shape, style, texture, facial hair, body, and presentation selectors cover every option', () => {
  for (const field of ['faceShape','eyeShape','browShape','hairStyle','hairTexture','facialHair','bodySilhouette','styleDirection']) {
    for (const value of APPEARANCE_OPTIONS_10[field]) {
      const attribute = field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      assert.match(css, new RegExp(`data-${attribute}=[\\"']${value}[\\"']`), `${field}:${value} needs visible CSS`);
    }
  }
  for (const value of ['masculine','feminine','neutral']) {
    assert.match(css, new RegExp(`data-presentation=[\\"']${value}[\\"']`));
  }
});

test('renderer imports appearance tokens and the page loads appearance CSS last', () => {
  assert.match(renderer, /appearanceVisualTokens10/);
  assert.match(renderer, /\.\.\.appearanceTokens/);
  assert.match(index, /version10-appearance\.css\?v=10\.0/);
  assert.ok(index.indexOf('version10.css?v=10.0') < index.indexOf('version10-appearance.css?v=10.0'));
});
