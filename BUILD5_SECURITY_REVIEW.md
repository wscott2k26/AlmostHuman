# Almost Human Build 5 Security and Performance Review

Date: 2026-08-01  
Supabase project: `onvoaskzzxozmhkzyycy`  
Review state: branch implementation; no Build 5 production migration has been applied.

## `is_admin()` SECURITY DEFINER warning

Supabase reports that `public.is_admin()` is a `SECURITY DEFINER` function executable by the `authenticated` role. The function is used by owner-scoped select policies as the explicit administrator override.

A production-safe transaction test was performed and rolled back:

1. Begin transaction.
2. Revoke `EXECUTE` on `public.is_admin()` from `authenticated`.
3. Assume the `authenticated` role with a non-owner JWT subject.
4. Select through the `ai_entities` RLS policy.
5. PostgreSQL returned `permission denied for function is_admin`.
6. The transaction rolled back automatically.
7. A follow-up privilege query confirmed `authenticated` can still execute the function.

Conclusion: directly revoking execution would break current RLS policy evaluation. Build 5 retains the grant and treats these as compensating controls:

- the function reads administrator status only from trusted JWT `app_metadata`;
- anonymous role execution remains revoked;
- user data remains protected by `auth.uid() = user_id` owner clauses;
- cross-reference ownership triggers remain active;
- direct browser writes to subscriptions remain revoked;
- a two-account isolation test remains a mandatory certification gate before merge.

Advisor reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Anonymous guest policy warning

Almost Human intentionally creates an authenticated anonymous guest account when the user chooses private guest mode. Those sessions use the `authenticated` database role, receive a real unique `auth.uid()`, and remain constrained by the same owner RLS predicates as email accounts.

The advisor labels policies available to authenticated anonymous users as anonymous access. That warning is expected for this product model; it is not equivalent to public `anon` table access. The core migration explicitly revokes table access from the unauthenticated `anon` role.

A fresh-user versus second-user two-account isolation test is required in final certification for companions, visual profiles, conversations, messages, memories, milestones, activities, and Haven objects.

Advisor reference: https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins

## Leaked Password Protection

Supabase currently reports **Leaked Password Protection** as disabled. This is an Auth dashboard control and cannot honestly be enabled by the application migration. Enabling it is a release gate before public email/password account launch.

Advisor reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Measured index state

Production already contains these high-value composites:

- `messages_conversation_idx (user_id, conversation_id, created_at)`
- `memories_recall_idx (user_id, ai_entity_id, status, importance_score desc, created_at desc)`
- `milestones_event_uidx (user_id, ai_entity_id, event_key)`
- `activities_ai_idx (user_id, ai_entity_id, created_at desc)`

Build 5 therefore does not create duplicate composites. Migration `202608010003_build5_lookup_indexes.sql` adds only missing foreign-key support indexes and the Haven placement path:

- messages by `conversation_id`
- messages by `ai_entity_id`
- memories by `ai_entity_id`
- milestones by `ai_entity_id`
- activities by `ai_entity_id`
- room items by `(user_id, ai_entity_id, placed)`
- room items by `ai_entity_id`

No existing index is removed. The currently unused `memories_tags_gin` index is deliberately retained because usage statistics are young and removal is outside Build 5 scope.

## Release gates

Before merge:

- apply migrations only through the controlled preview/release path;
- rerun Supabase security and performance advisors;
- complete two-account isolation;
- verify no secret, transcript, or message content appears in logs;
- enable Leaked Password Protection in the Supabase Auth dashboard;
- retain zero EAS builds, zero TestFlight uploads, and zero App Store releases for Build 5.
