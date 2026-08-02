# Almost Human Build 5 Supabase Post-Change Verification

Recorded: 2026-08-02 UTC  
Project: `onvoaskzzxozmhkzyycy`

## Applied migrations

- `20260802000134_build5_visual_identity`
- `20260802000149_build5_lookup_indexes`

Both migrations completed successfully. The Supabase migration wrapper emitted benign nested-transaction warnings because the reviewed SQL also contained explicit `begin` / `commit`; post-change schema, row, policy, and index checks all passed.

## User-data continuity

The same PostgreSQL row-count and ID-fingerprint query was run before and after migration. Every value is identical.

| Table | Before rows | After rows | ID fingerprint |
|---|---:|---:|---:|
| `ai_entities` | 4 | 4 | `8365844705208525351` |
| `conversations` | 7 | 7 | `-952071819752967739` |
| `messages` | 44 | 44 | `-3435147917219833509` |
| `memories` | 2 | 2 | `2902160074438139146` |
| `milestones` | 6 | 6 | `-4012961111921750163` |
| `room_items` | 2 | 2 | `2480694926947748932` |

Result: no companion, conversation, message, memory, milestone, or Haven-object row was added, removed, or assigned a new ID by the migration.

## Version 10 columns

The following additive `ai_entities` columns now exist:

- `presentation text`
- `origin_profile jsonb not null default '{}'`
- `appearance_profile jsonb not null default '{}'`
- `voice_profile jsonb not null default '{}'`
- `renderer_version integer not null default 9`

Post-migration validation across all existing companions returned:

- presentation nulls: `0`
- non-object origin profiles: `0`
- non-object appearance profiles: `0`
- non-object voice profiles: `0`
- renderer versions outside 9–10: `0`
- missing visual rollback arrays: `0`

Legacy `appearance_seed`, `voice_id`, `development_state`, `room_state`, identifiers, and history tables remain intact for Version 9 compatibility and rollback.

## Added support indexes

- `messages_conversation_fk_idx`
- `messages_ai_entity_fk_idx`
- `memories_ai_entity_fk_idx`
- `milestones_ai_entity_fk_idx`
- `activities_ai_entity_fk_idx`
- `room_items_owner_ai_placed_idx`
- `room_items_ai_entity_fk_idx`

No existing index was removed. Supabase currently labels the new indexes unused because they were just created; that is expected until production query statistics accumulate.

## Ownership policy verification

The seven relevant tables still have four owner-scoped policies each:

- `ai_entities`
- `conversations`
- `messages`
- `memories`
- `milestones`
- `activities`
- `room_items`

A two-account transaction test assumed the authenticated role for two separate existing owners and rolled back after inspection. For both accounts:

- own companion rows were visible;
- foreign companion rows visible: `0`;
- foreign message rows visible: `0`;
- only owner-scoped conversation, memory, milestone, activity, and Haven records were returned.

Result: two-account RLS isolation passed.

## Voice service deployment

- Function: `voice-service`
- Active version: `10`
- JWT verification: enabled
- Deployment source hash: `5bd38684a37618da758c7065c5c8590d87448da23a0d246f498098a64dbf3439`
- Rollback version: `9`

Version 10 adds six expressive tones, bounded rate control, explicit `auto` / `openai` / `elevenlabs` provider preference, stored-profile use for real speech, request-profile use for preview, and clear provider-unavailable errors. It does not add a silent device-speech fallback.

The exact GitHub source passed Edge TypeScript checks and the full no-build CI before deployment. The deployed bundle was fetched after deployment and matched the reviewed source. An authenticated Version 10 audio request was not fabricated during certification because no user session token was exposed to this workflow; JWT enforcement and deployment source were verified directly.

## Advisor and log review

No new RLS-policy, missing-column, or migration failure was introduced.

Known security warnings retained and documented:

1. `public.is_admin()` is a SECURITY DEFINER helper callable by `authenticated`; revoking it breaks current owner-policy evaluation. Anonymous execution remains revoked, and administrator status is read from trusted JWT app metadata.
2. Authenticated anonymous guest sessions are intentionally supported and remain owner-scoped by `auth.uid()`; direct unauthenticated `anon` table access remains revoked.
3. Supabase Leaked Password Protection remains disabled and is a release gate before public email/password launch.

Known performance information:

- newly created Build 5 indexes show zero use immediately after creation, as expected;
- several older, unrelated foreign-key paths still lack covering indexes and remain future hardening work;
- `memories_tags_gin` remains unused but was not removed because removal is outside Build 5 scope.

Postgres logs contain benign migration-wrapper transaction warnings and older pre-migration audit errors. Current schema verification, fingerprints, policies, and function deployment all pass.

## Release boundary

- EAS builds performed for Build 5: `0`
- TestFlight uploads performed for Build 5: `0`
- App Store releases performed for Build 5: `0`
- Vercel production promotions performed for Build 5: `0`
- TestFlight `1.0.0 (4)` remains untouched.
