import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../supabase/migrations/202608010002_build5_visual_identity.sql', import.meta.url), 'utf8');

test('Version 10 migration is additive and idempotent', () => {
  for (const column of ['presentation','origin_profile','appearance_profile','voice_profile','renderer_version']) {
    assert.match(sql, new RegExp(`add\\s+column\\s+if\\s+not\\s+exists\\s+${column}`, 'i'));
  }
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|schema|database)\b/i);
  assert.doesNotMatch(sql, /\btruncate\b/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
  assert.doesNotMatch(sql, /\balter\s+column\s+id\b/i);
});

test('migration preserves Version 9 readability and visual rollback data', () => {
  assert.match(sql, /appearance_seed/i);
  assert.match(sql, /voice_id/i);
  assert.match(sql, /development_state/i);
  assert.match(sql, /visualRollbackSnapshots/i);
  assert.match(sql, /renderer_version[^;]*default\s+9/i);
});

test('migration validates JSON object shapes without weakening ownership', () => {
  assert.match(sql, /jsonb_typeof\s*\(origin_profile\)\s*=\s*'object'/i);
  assert.match(sql, /jsonb_typeof\s*\(appearance_profile\)\s*=\s*'object'/i);
  assert.match(sql, /jsonb_typeof\s*\(voice_profile\)\s*=\s*'object'/i);
  assert.doesNotMatch(sql, /disable\s+row\s+level\s+security/i);
  assert.doesNotMatch(sql, /grant\s+all/i);
  assert.doesNotMatch(sql, /service_role/i);
});

test('migration backfill is bounded to missing Version 10 fields', () => {
  assert.match(sql, /where\s+renderer_version\s+is\s+null/i);
  assert.match(sql, /where\s+presentation\s+is\s+null/i);
  assert.match(sql, /coalesce\s*\(development_state/i);
  assert.doesNotMatch(sql, /update\s+public\.ai_entities\s+set\s+id\s*=/i);
});
