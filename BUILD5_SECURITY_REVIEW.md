# Almost Human Build 5 Security and Performance Review

Date: 2026-08-02  
Supabase project: `onvoaskzzxozmhkzyycy`  
Review state: additive migrations applied and verified; Version 10 remains unmerged and not promoted to Vercel production.

## Data continuity and RLS result

Migrations `20260802000134_build5_visual_identity` and `20260802000149_build5_lookup_indexes` were applied through the controlled Supabase migration action.

Before and after migration, row counts and hashed ID sets matched exactly for companions, conversations, messages, memories, milestones, and Haven items. All owner policies remained present. A transaction-scoped two-account test returned zero foreign companion rows and zero foreign message rows for both authenticated identities.

Full receipt: `BUILD5_SUPABASE_POSTCHANGE.md`.

## `is_admin()` SECURITY DEFINER warning

Supabase reports that `public.is_admin()` is a `SECURITY DEFINER` function executable by the `authenticated` role. The function is used by owner-scoped select policies as the explicit administrator override.

A production-safe transaction test was performed and rolled back:

1. Begin transaction.
2. Revoke `EXECUTE` on `public.is_admin()` from `authenticated`.
3. Assume the `authenticated` role with a non-owner JWT subject.
4. Select through the `ai_entities` RLS policy.
5. PostgreSQL returned `permission denied for function is_admin`.
6. The transaction rolled back.
7. A follow-up privilege query confirmed `authenticated` can still execute the helper.

Conclusion: directly revoking execution would break current RLS policy evaluation. Build 5 retains the grant and uses these compensating controls:

- administrator status is read only from trusted JWT `app_metadata`;
- unauthenticated `anon` execution remains revoked;
- user rows remain protected by `auth.uid() = user_id` owner clauses;
- cross-reference ownership triggers remain active;
- direct browser writes to subscriptions remain revoked;
- two-account isolation passed after migration.

Advisor reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Authenticated anonymous guest warning

Almost Human intentionally creates an authenticated anonymous guest account when the user chooses private guest mode. Those sessions use the `authenticated` database role, receive a unique `auth.uid()`, and remain constrained by the same owner predicates as email accounts.

The advisor labels policies available to authenticated anonymous users as anonymous access. That warning is expected for this product model; it is not equivalent to public unauthenticated table access. The core migration revokes table access from the `anon` role.

Post-migration two-account testing confirmed that separate owners cannot read each other's companions or messages.

Advisor reference: https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins

## Leaked Password Protection

Supabase currently reports **Leaked Password Protection** as disabled. This is an Auth project control rather than an application migration. It remains a release gate before public email/password account launch.

Anonymous guest mode and local-only mode are unaffected by this setting, but public password registration should not be considered fully release-certified until it is enabled or email/password registration is intentionally withheld.

Advisor reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Voice service boundary

`voice-service` version 10 is ACTIVE with JWT verification enabled. Its reviewed source hash is `5bd38684a37618da758c7065c5c8590d87448da23a0d246f498098a64dbf3439`; version 9 remains the rollback point.

The service:

- reads the requested preview profile only after authentication;
- reads real speech identity from the owner-scoped stored companion profile;
- bounds rate and tone values server-side;
- uses provider secrets only through server environment variables;
- returns a clear unavailable response when an explicitly selected provider is not configured;
- never silently switches to device speech.

The deployed source was fetched after deployment and matched the GitHub implementation. No user token, transcript, or provider secret was written to the release documents.

## Measured index state

Production already contained these high-value composites:

- `messages_conversation_idx (user_id, conversation_id, created_at)`
- `memories_recall_idx (user_id, ai_entity_id, status, importance_score desc, created_at desc)`
- `milestones_event_uidx (user_id, ai_entity_id, event_key)`
- `activities_ai_idx (user_id, ai_entity_id, created_at desc)`

Build 5 added only the seven reviewed support indexes:

- messages by `conversation_id`
- messages by `ai_entity_id`
- memories by `ai_entity_id`
- milestones by `ai_entity_id`
- activities by `ai_entity_id`
- room items by `(user_id, ai_entity_id, placed)`
- room items by `ai_entity_id`

No existing index was removed. New indexes appear unused immediately after creation because PostgreSQL usage statistics have not accumulated. Several older unrelated foreign-key paths remain advisory-level future hardening work. The unused `memories_tags_gin` index is deliberately retained because removal is outside Build 5 scope.

## Log review

- migration statements completed and post-change verification passed;
- nested transaction warnings came from the Supabase migration wrapper surrounding reviewed SQL that already included `begin` / `commit`;
- older missing-column and syntax errors predate the successful migration and came from rolled-back audit attempts;
- no new RLS bypass, missing-column error, or data-loss event appeared after the verified migration;
- edge-function history contains expected authenticated success responses and unauthenticated `401` responses.

## Remaining release gates

Before public launch or merge as release-ready:

- complete four consecutive certification passes on the frozen GitHub head;
- verify fresh Vercel preview metadata and logs for that frozen head;
- complete no-credit native export receipts if the existing project scripts support them;
- enable Leaked Password Protection before public email/password registration;
- retain zero EAS builds, zero TestFlight uploads, and zero App Store releases unless separately authorized.
