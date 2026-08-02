# Almost Human Build 5 Supabase Pre-Change Fingerprint

Recorded: 2026-08-01 23:59:51 UTC  
Project: `onvoaskzzxozmhkzyycy`  
Database role used for read-only fingerprint: `postgres`

## Migration baseline

- `202607290001_almost_human_core`
- `20260731235632_fix_privacy_delete_subscription_boundary`
- `20260801005244_harden_helper_function_boundaries`

## Core row-ID fingerprints

These values expose no user IDs or message content. They combine row count with a PostgreSQL `bit_xor(hashtextextended(id::text, 0))` fingerprint so the same rows can be verified after additive migration.

| Table | Rows | ID fingerprint |
|---|---:|---:|
| `ai_entities` | 4 | `8365844705208525351` |
| `conversations` | 7 | `-952071819752967739` |
| `messages` | 44 | `-3435147917219833509` |
| `memories` | 2 | `2902160074438139146` |
| `milestones` | 6 | `-4012961111921750163` |
| `room_items` | 2 | `2480694926947748932` |

## `ai_entities` schema baseline

Version 10 columns were absent when this receipt was recorded. Existing compatibility columns included:

- `id`, `user_id`, `local_id`, `name`, `nickname`, `pronouns`
- `birthday`, `simulated_age`, `developmental_stage`
- `appearance_seed`, `voice_id`, `relationship_style`
- `current_mood`, `mood_intensity`
- `personality_state`, `personality_history`, `development_state`, `room_state`, `favorite_things`
- `trust_score`, `attachment_score`, `bond_score`
- `last_interaction_at`, `last_aged_at`, `onboarding_complete`
- `total_interactions`, `total_memories`, `growth_version`, `last_growth_bucket`, `last_birthday_year`
- `archived`, `created_at`, `updated_at`

The planned additive columns are `presentation`, `origin_profile`, `appearance_profile`, `voice_profile`, and `renderer_version`.

## Ownership policy baseline

Owner-scoped SELECT/INSERT/UPDATE/DELETE policies were present for:

- `ai_entities`
- `conversations`
- `messages`
- `memories`
- `milestones`
- `activities`
- `room_items`

Every write policy used `(select auth.uid()) = user_id`. SELECT policies retained the existing administrator override through `is_admin()`.

## Active Edge Function baseline

| Function | Version | JWT | Source hash |
|---|---:|---|---|
| `health` | 6 | no | `ff4980572b060b548890f3da891823496b1b8a70053a8228ee7b03ca18a48be5` |
| `chat-service` | 8 | yes | `409c2e8f1cdca25091ad92fb36e8f077470f862d02370733c5519b7bb79ff79c` |
| `activity-service` | 7 | yes | `9ce687a33bbab26dfa50abe7d401e77c7b74a6debf3188b2a8776c1f213ce5d2` |
| `memory-extract` | 7 | yes | `24321af2aec4661f61274b159e78e39c8204cc08e33011c5e67691e83b5c3c64` |
| `memory-control` | 6 | yes | `64dbdeb934a0da70760894a076d153d5b5468a9ca2b70f1f108dfc8290fb242f` |
| `privacy-service` | 5 | yes | `601eb69101f7526bcee645e8fb2ae08e6a8f187cb078225ca7024f23cea2c020` |
| `conversation-reset` | 6 | yes | `651143b9bf8bb19495dafbbebee18da437077f4bf8143e0bbb0b1d1e68c31dfe` |
| `progress-aging` | 5 | yes | `4ba2d98bd1be18a9d540eb1a903a38db3017fee6a8fca61ddba430d221c584f7` |
| `diagnostics-service` | 6 | yes | `370550c2adf7c6b54d174e1752a1b7d7788ce16e271d1976fec0166996e5520d` |
| `voice-service` | 9 | yes | `2ff22d2cc224352bef0cb5f86bbefb781337a80c43a4d3f03adba99288791f81` |
| `letter-service` | 6 | yes | `f7b88207d8edc83b1a326f5272f9ad340291bb908ec5800cd229d13f3d62872a` |
| `transcription-service` | 1 | yes | `d10a27ad65b466a88143c124b816b05b640e6f87d2ddbce48892d8e4c58eb9b5` |
| `chat-stream` | 1 | yes | `2db4892210138147895ebe8cfef3f36ef329aee25fbea803c7fe98059288cc65` |

## Required post-change checks

1. Recompute all six row-ID fingerprints and require exact equality.
2. Verify no table, policy, trigger, owner condition, or compatibility column was removed.
3. Verify all five Version 10 columns and seven support indexes exist.
4. Verify only `voice-service` advances version and remains JWT-protected.
5. Inspect database advisors and function logs.
6. Keep EAS builds, TestFlight uploads, and App Store releases at zero.
