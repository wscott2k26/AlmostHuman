import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../supabase/migrations/202608010003_build5_lookup_indexes.sql', import.meta.url), 'utf8');

test('lookup migration is transactional, additive, and idempotent', () => {
  assert.match(sql.trimStart(), /^begin;/i);
  assert.match(sql.trimEnd(), /commit;$/i);
  assert.equal((sql.match(/create\s+index\s+if\s+not\s+exists/gi) || []).length, 7);
  assert.doesNotMatch(sql, /\bdrop\s+(index|table|column|schema)\b/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\b|\btruncate\b|\bupdate\b/i);
});

test('lookup migration covers every documented ownership and Haven path', () => {
  for (const fragment of [
    'public.messages (conversation_id)',
    'public.messages (ai_entity_id)',
    'public.memories (ai_entity_id)',
    'public.milestones (ai_entity_id)',
    'public.activities (ai_entity_id)',
    'public.room_items (user_id, ai_entity_id, placed)',
    'public.room_items (ai_entity_id)',
  ]) assert.match(sql, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('lookup migration does not alter RLS, ownership, or user data', () => {
  assert.doesNotMatch(sql, /row\s+level\s+security|\bpolicy\b|\bgrant\b|\brevoke\b/i);
  assert.doesNotMatch(sql, /auth\.uid|service_role|security\s+definer/i);
  assert.doesNotMatch(sql, /insert\s+into|alter\s+table/i);
});
