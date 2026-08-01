# Almost Human Build 5 / Version 10.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved Option C Evolution Shell: living origin form, independent presentation identity, full appearance and expressive voice creation, visible developmental evolution, and a cinematic Haven without replacing any existing companion or history.

**Architecture:** Preserve the Version 9 local-first PWA, Supabase ownership model, developmental engine, streamed conversation, neural voice services, and Expo SDK 54 shell. Add pure Version 10 profile/evolution modules, an original procedural SVG/CSS renderer, additive PostgreSQL fields, and idempotent evolution receipts. The renderer consumes normalized identity data and remains replaceable without changing companion records.

**Tech Stack:** Vanilla ES modules, IndexedDB, Node test runner, Python integrity tests, SVG, CSS custom properties, Canvas 2D, Web Animations API, TypeScript/Deno Supabase Edge Functions, PostgreSQL/RLS, OpenAI neural speech, optional ElevenLabs, Expo SDK 54, React Native 0.81, WebView bridge, Vercel previews, GitHub Actions.

## Global Constraints

- Work only on `feature/build-5-version-10`.
- Preserve all users, guest accounts, companions, IDs, birthdays, developmental ages, personalities, memories, facts, conversations, messages, milestones, activities, letters, room items, Haven state, settings, and release records.
- Preserve `com.stormandme.almosthuman`, Apple app ID `6796814542`, EAS project `cd0be7bb-e65a-454e-b255-3b261de060ee`, TestFlight `1.0.0 (4)`, and signed build `9af3b9e9-eec0-473a-a59e-12fdeff56e42`.
- Do not run EAS Build, EAS Submit, a TestFlight upload, or an App Store release.
- Do not perform destructive production DDL.
- Do not add an external avatar SDK, remote renderer, stock people, or paid runtime service.
- ElevenLabs remains optional; OpenAI remains the secure fallback.
- Device speech never activates silently.
- Write failing tests before production behavior.
- Four complete certification passes must run from one source SHA.
- Native exports use only `npm run export:ios` and `npm run export:android` inside `mobile/`.
- Do not merge or promote production until preview verification, review, rollback proof, and all gates pass.

---

### Task 1: Release Guard and Rollback Baseline

**Files:**
- Create: `tests/release_guard10.test.mjs`
- Create: `BUILD5_ROLLBACK_BASELINE.md`
- Create: `.github/workflows/build-5-version-10-ci.yml`
- Modify: `package.json`
- Modify: `tests/integrity_test.py`

**Interfaces:** Produces a machine-tested release boundary and immutable baseline record.

- [ ] Write a failing test that requires web version `10.0.0`, native version `1.0.0`, locked bundle/package and EAS IDs, remote version auto-increment, and no `eas build` or `eas submit` in ordinary scripts.
- [ ] Run `node --test tests/release_guard10.test.mjs`; expect failure because package version is `9.0.0`.
- [ ] Record main SHA `d63d6e4e86f803de727eda79db362451ecd38e17`, production deployment `dpl_JCVTgEzyXbar4SnFegsBxTcfX3Gp`, Supabase project, Edge Function versions, TestFlight build 4, and zero Build 5 authorizations in `BUILD5_ROLLBACK_BASELINE.md`.
- [ ] Set only root `package.json` version to `10.0.0`.
- [ ] Create a manual-only `workflow_dispatch` CI workflow that runs `npm run test:all`, `cd mobile && npm run validate`, and a grep guard forbidding EAS build/submit commands. Do not add a push trigger.
- [ ] Run `node --test tests/release_guard10.test.mjs && npm run lint && npm run test:integrity`.
- [ ] Commit `chore: lock Build 5 release boundaries`.

Test core:

```js
assert.equal(pkg.version, '10.0.0');
assert.equal(mobile.expo.version, '1.0.0');
assert.equal(mobile.expo.ios.bundleIdentifier, 'com.stormandme.almosthuman');
assert.equal(mobile.expo.android.package, 'com.stormandme.almosthuman');
assert.equal(mobile.expo.extra.eas.projectId, 'cd0be7bb-e65a-454e-b255-3b261de060ee');
assert.doesNotMatch(Object.values(pkg.scripts).join('\n'), /eas\s+(build|submit)/i);
```

---

### Task 2: Additive Visual-Identity Migration

**Files:**
- Create: `supabase/migrations/202608010002_build5_visual_identity.sql`
- Create: `tests/migration10.test.mjs`
- Modify: `app/core/store.js`
- Modify: `app/core/cloud.js`
- Modify: `tests/integrity_test.py`

**Interfaces:** Produces `DATA_VERSION = 7`, `normalizeVisualIdentity10(ai)`, and cloud fields `presentation`, `origin_profile`, `appearance_profile`, `voice_profile`, `renderer_version`.

- [ ] Write failing tests proving Version 6 state becomes Version 7, IDs/history remain unchanged, one visual rollback snapshot is created, and repeated migration is idempotent.
- [ ] Run `node --test tests/migration10.test.mjs`; expect module/field failures.
- [ ] Add columns with `add column if not exists`; retain `appearance_seed` and `voice_id`.
- [ ] Add the presentation check only when absent using a `DO` block querying `pg_constraint`; do not drop an existing constraint.
- [ ] Backfill only empty visual fields. Do not update birthdays, memories, messages, conversations, milestones, or IDs.
- [ ] Increment local `DATA_VERSION` to 7 and normalize legacy appearance/voice/presentation into additive fields.
- [ ] Extend cloud field mapping for the five new columns.
- [ ] Add integrity assertions forbidding `drop column`, `truncate`, and deletion of companion rows.
- [ ] Run `node --test tests/migration10.test.mjs && npm run typecheck:edge && npm run test:integrity`.
- [ ] Commit `feat: add non-destructive visual identity migration`.

SQL core:

```sql
alter table public.ai_entities
  add column if not exists presentation text,
  add column if not exists origin_profile jsonb not null default '{}'::jsonb,
  add column if not exists appearance_profile jsonb not null default '{}'::jsonb,
  add column if not exists voice_profile jsonb not null default '{}'::jsonb,
  add column if not exists renderer_version integer not null default 9;
```

---

### Task 3: Profile Schemas and First-Light State Machine

**Files:**
- Create: `app/core/appearance10.js`
- Create: `app/core/origin10.js`
- Create: `app/core/voiceProfile10.js`
- Create: `tests/appearance10.test.mjs`
- Create: `tests/origin10.test.mjs`
- Create: `tests/voice_profile10.test.mjs`

**Interfaces:** Produces `normalizeAppearance10`, `compareAppearance10`, `createVisualSnapshot10`, `normalizeOrigin10`, `createFirstLightMachine10`, `normalizeVoiceProfile10`, and `voicePreviewRequest10`.

- [ ] Write failing tests for every approved appearance field, category comparison, visual-only snapshots, origin defaults, ordered First-Light phases, six public voice IDs, six tones, rate clamping, and secret-free requests.
- [ ] Run the three test files; expect missing-module failures.
- [ ] Implement immutable option lists, deterministic defaults, and six original presets.
- [ ] Implement phases `stabilize`, `ribbons`, `trace`, `emerge`, `awaken`, `speak`, `haven`; full duration 6–8 seconds and reduced-motion duration at most 1.2 seconds.
- [ ] Implement tones `calm`, `playful`, `thoughtful`, `confident`, `gentle`, `mysterious`; provider preference `auto`, `elevenlabs`, or `openai`.
- [ ] Run `node --test tests/appearance10.test.mjs tests/origin10.test.mjs tests/voice_profile10.test.mjs && npm run lint`.
- [ ] Commit `feat: define Build 5 identity profiles`.

Appearance key order:

```js
[
  'skinTone','skinUndertone','faceShape','eyeShape','eyeColor',
  'browShape','browWeight','hairStyle','hairTexture','hairColor',
  'facialHair','bodySilhouette','styleDirection'
]
```

---

### Task 4: Evolution Engine

**Files:**
- Create: `app/core/evolution10.js`
- Create: `tests/evolution10.test.mjs`
- Modify: `app/core/engine.js`
- Modify: `app/core/stages.js`
- Modify: `supabase/functions/progress-aging/index.ts`
- Modify: `tests/integrity_test.py`

**Interfaces:** Produces `computeEvolutionContributors10`, `computeEvolution10`, `evolutionEventKey10`, and `applyEvolutionTransition10`.

- [ ] Write failing tests for weights, stage caps, phase mapping, raw evidence, and duplicate transition prevention.
- [ ] Run `node --test tests/evolution10.test.mjs`; expect missing-module failure.
- [ ] Implement weights: age `.45`, memories/interactions `.25`, milestones/skills `.15`, Haven `.10`, personality stability `.05`.
- [ ] Map stages to `origin_orb`, `forming_energy`, `emerging_figure`, `young_persona`, `refined_persona`, `mature_being`.
- [ ] Store phase, progress, contributors, and deterministic transition receipts inside `developmentState` without changing age or birthday.
- [ ] Mirror phase/event-key logic in `progress-aging`; milestone event key is `evolution:<ai-id>:<phase>`.
- [ ] Add parity and duplicate guards to integrity tests.
- [ ] Run `node --test tests/evolution10.test.mjs && npm run typecheck:edge && npm run test:integrity`.
- [ ] Commit `feat: connect visible evolution to real growth`.

---

### Task 5: Original Procedural Renderer and Premium Materials

**Files:**
- Create: `app/character/materials10.js`
- Create: `app/character/motion10.js`
- Create: `app/character/renderer10.js`
- Create: `tests/renderer10.test.mjs`
- Modify: `app/styles.css`
- Modify: `tests/integrity_test.py`

**Interfaces:** Produces `materialTokens10`, `motionModel10`, `renderOriginOrb10`, `renderCompanion10`, and `renderEvolutionFrame10`.

- [ ] Write failing tests for deterministic local markup, all profile attributes, no remote URLs, no photographs, and static reduced-motion output.
- [ ] Run `node --test tests/renderer10.test.mjs`; expect missing-module failure.
- [ ] Implement glass, clay, metal, stone, crystal, satin, and resin token families with solid reduced-transparency alternatives.
- [ ] Implement idle, listening, thinking, speaking, First Light, evolution, and static motion models without direct DOM access.
- [ ] Implement layered original SVG/HTML for orb and character phases.
- [ ] Add liquid glass, material depth, tactile compression/rebound, scene parallax, breathing environments, visible focus, and accessibility overrides.
- [ ] Add integrity bans for remote avatar assets, avatar SDK names, unbounded motion without a reduced-motion rule, and undersized touch controls.
- [ ] Run `node --test tests/renderer10.test.mjs && npm run lint && npm run test:integrity`.
- [ ] Commit `feat: add original Evolution Shell renderer`.

---

### Task 6: Creator, First Light, and Existing-User Identity Studio

**Files:**
- Create: `app/features/creator10.js`
- Create: `app/features/identityStudio10.js`
- Create: `tests/creator10.test.mjs`
- Create: `tests/identity_studio10.test.mjs`
- Modify: `app/app.js`
- Modify: `app/features/onboarding9.js`
- Modify: `app/core/store.js`
- Modify: `app/core/cloud.js`
- Modify: `app/index.html`
- Modify: `app/styles.css`
- Modify: `app/sw.js`

**Interfaces:** Produces creator steps, undo/reset/category randomization, companion finalization, existing-user upgrade, visual saves, and visual rollback.

- [ ] Write failing tests for steps `origin`, `identity`, `naming`, `appearance`, `style`, `voice`, `first-light`; existing-user bypass; one-companion finalization; and byte-for-byte preservation of history during edits/rollback.
- [ ] Run both test files; expect missing-module failures.
- [ ] Implement a temporary creator state with category history stacks; do not write permanent companion state until safe finalization.
- [ ] Build Origin Chamber, Identity Resonance, Naming, Appearance Studio, Style, Voice Atelier, and First Light with a constant live preview.
- [ ] Keep presentation separate from pronouns and voice.
- [ ] Create one companion and one initial conversation; do not manufacture memories.
- [ ] Add optional existing-user copy `Your companion has learned to take fuller form.` with `See the new form` and `Not now`.
- [ ] Add Identity Studio statement `Their history will stay exactly where it is.` and visual-only rollback snapshots.
- [ ] Version web assets/service worker to 10.0 and include new modules in both production and inline builds.
- [ ] Run `node --test tests/creator10.test.mjs tests/identity_studio10.test.mjs tests/onboarding9.test.mjs && npm run test:all`.
- [ ] Commit `feat: create and edit evolving identities safely`.

---

### Task 7: Expressive Secure Neural Voice

**Files:**
- Create: `supabase/functions/_shared/voiceProfile10.ts`
- Modify: `supabase/functions/_shared/neuralVoice.ts`
- Modify: `supabase/functions/voice-service/index.ts`
- Modify: `app/core/cloud.js`
- Modify: `app/app.js`
- Modify: `tests/voice_profile10.test.mjs`
- Modify: `tests/integrity_test.py`

**Interfaces:** Extends neural speech with `tone` and `providerPreference` while preserving six public voice IDs.

- [ ] Extend failing tests so every tone has a distinct server direction, an unavailable forced provider cannot bypass fallback rules, and server code contains no device speech path.
- [ ] Implement original tone directions that alter pacing/expression without impersonation or child caricature.
- [ ] Provider order remains fully configured ElevenLabs, OpenAI, then `NEURAL_VOICE_UNAVAILABLE`.
- [ ] Accept validated `tone` and `provider_preference`; return `X-AH-Voice-Tone` plus current provider/profile headers.
- [ ] Show provider class, tone, retry, text-only continuation, and explicit device-speak-once only after neural failure.
- [ ] Run `node --test tests/voice_profile10.test.mjs tests/phrase_queue9.test.mjs tests/voice_mode9.test.mjs && npm run typecheck:edge && npm run test:integrity`.
- [ ] Commit `feat: add expressive secure neural voice tones`.

---

### Task 8: Living Home, Talk, Evolution Journey, and Haven

**Files:**
- Create: `app/features/evolutionJourney10.js`
- Create: `app/features/havenEnvironment10.js`
- Create: `tests/haven_environment10.test.mjs`
- Modify: `app/features/home9.js`
- Modify: `app/features/growth9.js`
- Modify: `app/features/haven9.js`
- Modify: `app/app.js`
- Modify: `app/styles.css`
- Modify: `scripts/browser_smoke.mjs`
- Modify: `tests/flow9.test.mjs`

**Interfaces:** Produces a six-phase journey model, character activity-state projection, and deterministic Haven environment model.

- [ ] Write failing tests for all six phases, contributor total `1`, Home’s primary conversation action, no typing dots, stage architecture, mood lighting, earned-only objects, and absence of store/currency fields.
- [ ] Recompose Home around the living companion with one memory, one growth signal, Haven, Voice Mode, and Continue conversation.
- [ ] Map listening/receiving/speaking states to character motion while streamed text remains the truth.
- [ ] Upgrade Voice Mode with full character scene, interrupt, waveform, tone/profile, transcript drawer, and explicit provider errors.
- [ ] Build Evolution Journey with current cap, evidence, and phase history; no coins, streaks, scarcity, or guilt.
- [ ] Build Haven layers from stage, mood, interests, milestones, memories, activities, and earned room items. Never invent object history.
- [ ] Expand browser smoke across creator, restored user, identity edits, Home, Talk, Voice Mode, Growth, Memories, Haven, reduced motion/transparency, and high contrast.
- [ ] Run `node --test tests/flow9.test.mjs tests/evolution10.test.mjs tests/haven_environment10.test.mjs tests/voice_mode9.test.mjs && npm run test:all`.
- [ ] Commit `feat: make the companion and Haven visibly alive`.

---

### Task 9: Native Bundle, Haptics, and No-Credit Exports

**Files:**
- Modify: `mobile/src/NativeShell.tsx`
- Modify: `mobile/src/almostHumanHtml.ts`
- Modify: `mobile/src/voiceBridge.ts`
- Modify: `mobile/scripts/preflight.mjs`
- Modify: `scripts/build-inline.mjs`
- Modify: `tests/integrity_test.py`
- Create: `mobile/BUILD5_QUADRUPLE_PREFLIGHT.md`

**Interfaces:** Adds restrained creator/evolution haptics while preserving microphone, neural audio, safe areas, deep links, reminders, sharing, and recovery.

- [ ] Extend preflight to require Version 10 offline markers, locked identifiers, no remote avatar runtime, new haptic commands, and no EAS build/submit command.
- [ ] Add haptics: selection for category change, light impact for material press, success for save, warning for invalid action, medium+success for First Light, medium+light for evolution, warning+success for rollback.
- [ ] Preserve microphone interruption, explicit device fallback, audio session, background recovery, typed draft, and transcript behavior.
- [ ] Run `node scripts/build-inline.mjs` from repository root and verify inline-bundle integrity.
- [ ] Run `cd mobile && npm run preflight:quadruple` and record the source hash/results.
- [ ] Run `cd mobile && npm run export:ios`.
- [ ] Run `cd mobile && npm run export:android`.
- [ ] Hash `mobile/dist-ios` and `mobile/dist-android`; do not upload either directory.
- [ ] Run `cd mobile && npm run doctor && npm run typecheck && npm run lint && npm run preflight:quadruple && npm run export:ios && npm run export:android`.
- [ ] Commit `feat: certify Build 5 native source without credits`.

---

### Task 10: Security and Performance

**Files:**
- Create: `supabase/migrations/202608010003_build5_lookup_indexes.sql`
- Create: `BUILD5_SECURITY_REVIEW.md`
- Modify: `tests/integrity_test.py`

**Interfaces:** Produces measured covering indexes and evidence-based advisor decisions.

- [ ] Add failing integrity requirements for indexes on messages `(user_id, conversation_id, created_at)`, memories `(user_id, ai_entity_id, status, created_at)`, milestones `(user_id, ai_entity_id, event_key)`, activities `(user_id, ai_entity_id, created_at)`, and room items `(user_id, ai_entity_id, placed)`.
- [ ] Add only `create index if not exists` statements; do not drop indexes.
- [ ] Test revoking direct authenticated `is_admin()` execution in a migration dry run. Retain it only when policy evaluation demonstrably requires it, with compensating owner/RLS evidence.
- [ ] Document authenticated anonymous guest behavior and prove two-account isolation.
- [ ] Record leaked-password protection as a Supabase dashboard release gate; do not claim code enabled it.
- [ ] Re-run security/performance advisors and record before/after findings with remediation URLs.
- [ ] Run `npm run typecheck:edge && npm run test:integrity`.
- [ ] Commit `security: harden Build 5 data paths`.

---

### Task 11: Four-Pass Certification, Preview, Review, and Rollback

**Files:**
- Create: `ALMOST_HUMAN_10_CERTIFICATION.md`
- Create: `ALMOST_HUMAN_10_RELEASE_CANDIDATE.json`
- Create: `ALMOST_HUMAN_10_WEB_PREVIEW.json`
- Create: `BUILD5_CODE_REVIEW.md`
- Modify: `RELEASE_STATUS.md`

**Interfaces:** Produces one frozen candidate SHA, four complete receipts, preview evidence, review evidence, rollback proof, and zero paid/store counters.

- [ ] Freeze one branch SHA.
- [ ] Run `npm run test:all` four times from that SHA.
- [ ] Run `cd mobile && npm run preflight:quadruple && npm run export:ios && npm run export:android` from the same SHA.
- [ ] Record `eas_builds: 0`, `testflight_uploads: 0`, and `app_store_releases: 0`.
- [ ] Deploy a Vercel preview only and record deployment ID, URL, source SHA, and content hash.
- [ ] Verify fresh creator, existing-user restore, every appearance category, voice profiles/tones, First Light, all routes, rollback, accessibility modes, offline launch, and cloud reconnection.
- [ ] Prove two-account Supabase isolation for visual fields and all existing history tables.
- [ ] Inspect Vercel and Supabase logs; require no unresolved Version 10 runtime errors, secrets, or message content.
- [ ] Review the full branch diff for spec coverage, data safety, security, accessibility, performance, originality, voice fallback, release boundaries, and rollback.
- [ ] After any review fix, freeze the new SHA and repeat all four passes, exports, preview checks, isolation checks, and log inspection.
- [ ] Document rollback to Vercel deployment `dpl_JCVTgEzyXbar4SnFegsBxTcfX3Gp`, prior Edge Function versions, Version 9-compatible additive fields, companion visual snapshots, and untouched TestFlight build 4.
- [ ] Open a draft PR to `main`; do not merge automatically.
- [ ] Commit `docs: certify Almost Human Build 5 Version 10`.

## Acceptance Matrix

All statements must be true:

- New companions begin as a living origin orb.
- Presentation is masculine, feminine, or neutral and independent from pronouns.
- Every approved appearance category exists and remains editable later.
- Visual edits preserve companion ID and all history.
- Six voice profiles and six tones use secure neural providers.
- Device speech never activates silently.
- Evolution uses approved weights and stage caps.
- Evolution transitions are idempotent.
- Home, Talk, Voice Mode, Growth, Memories, and Haven share one continuous visual identity.
- Haven responds to stage, mood, interests, memories, milestones, activities, and earned objects without a store economy.
- Liquid glassmorphism, tactile maximalism, and cinematic pacing coexist with reduced-motion, reduced-transparency, high-contrast, keyboard, and screen-reader support.
- Existing users bypass creator onboarding.
- Local and Supabase migrations are additive and idempotent.
- Two-account isolation passes.
- Four web/backend/security passes and four mobile preflights pass from one SHA.
- Both no-credit exports pass.
- Preview, code review, and rollback gates pass.
- EAS builds, TestFlight uploads, and App Store releases for Build 5 remain `0`.