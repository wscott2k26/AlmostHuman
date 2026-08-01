# Almost Human Build 5 / Version 10.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved Option C Evolution Shell: a living origin form, independent identity presentation, full appearance and expressive voice creation, visible developmental evolution, and a cinematic Haven while preserving every existing user and release record.

**Architecture:** Keep the Version 9 local-first PWA, Supabase ownership model, developmental engine, streamed conversation, neural voice services, and Expo SDK 54 shell. Add focused Version 10 pure-model modules, an original procedural 2.5D SVG/CSS/canvas renderer, additive database fields, and idempotent migration/evolution receipts. Keep the renderer independent from identity data so future visual engines can consume the same normalized profiles.

**Tech Stack:** Vanilla ES modules, IndexedDB, Node test runner, Python integrity tests, layered SVG, CSS custom properties, Canvas 2D particles, Web Animations API, TypeScript/Deno Supabase Edge Functions, PostgreSQL/RLS, OpenAI neural speech, optional ElevenLabs, Expo SDK 54, React Native 0.81, WebView bridge, Vercel previews, GitHub Actions.

## Global Constraints

- Work only on `feature/build-5-version-10` until review and certification are complete.
- Preserve all users, guest accounts, companions, companion IDs, birthdays, developmental ages, memories, facts, conversations, messages, milestones, activities, letters, room items, Haven state, personality state, and relationship history.
- Preserve bundle/package `com.stormandme.almosthuman`.
- Preserve Apple app ID `6796814542`.
- Preserve EAS project `cd0be7bb-e65a-454e-b255-3b261de060ee`.
- Preserve TestFlight `1.0.0 (4)` and signed build `9af3b9e9-eec0-473a-a59e-12fdeff56e42`.
- Do not run an EAS build.
- Do not upload to TestFlight.
- Do not release to the App Store.
- Do not perform destructive production DDL.
- Do not introduce an external avatar SDK, remote rendering dependency, or paid runtime service.
- Keep ElevenLabs optional and OpenAI neural voice as secure fallback.
- Never silently fall back to device speech.
- Write a failing behavior test before every production behavior change.
- Four complete certification passes must run from one source revision.
- iOS and Android exports must be no-credit local exports.
- Production promotion and merge are prohibited until preview verification, code review, rollback verification, and all release gates pass.

## Planned file structure

### New web modules

- `app/core/appearance10.js` — profile schema, validation, legacy mapping, presets, comparison, and rollback snapshots
- `app/core/evolution10.js` — progress scoring, stage caps, phase mapping, transition receipts, and idempotency
- `app/core/origin10.js` — origin profile schema and First Light state machine
- `app/core/voiceProfile10.js` — expressive tone schema, provider-safe request shape, and legacy mapping
- `app/character/materials10.js` — premium material and lighting tokens
- `app/character/motion10.js` — idle, listening, thinking, speaking, transformation, and accessibility motion models
- `app/character/renderer10.js` — deterministic layered SVG character and orb markup
- `app/features/creator10.js` — screen models for Origin, Identity, Naming, Appearance, Style, Voice, and First Light
- `app/features/identityStudio10.js` — existing-companion edit and rollback model
- `app/features/evolutionJourney10.js` — evolution timeline and contributor model
- `app/features/havenEnvironment10.js` — cinematic Haven projection model

### New tests

- `tests/appearance10.test.mjs`
- `tests/evolution10.test.mjs`
- `tests/origin10.test.mjs`
- `tests/voice_profile10.test.mjs`
- `tests/creator10.test.mjs`
- `tests/identity_studio10.test.mjs`
- `tests/renderer10.test.mjs`
- `tests/haven_environment10.test.mjs`
- `tests/migration10.test.mjs`
- `tests/release_guard10.test.mjs`

### New backend/migration files

- `supabase/migrations/202608010002_build5_visual_identity.sql`
- `supabase/migrations/202608010003_build5_lookup_indexes.sql`
- `supabase/functions/_shared/voiceProfile10.ts`

### Existing files to modify

- `package.json`
- `app/app.js`
- `app/index.html`
- `app/styles.css`
- `app/sw.js`
- `app/config.js`
- `app/core/store.js`
- `app/core/cloud.js`
- `app/core/engine.js`
- `app/core/stages.js`
- `app/features/onboarding9.js`
- `app/features/home9.js`
- `app/features/growth9.js`
- `app/features/haven9.js`
- `supabase/functions/_shared/neuralVoice.ts`
- `supabase/functions/voice-service/index.ts`
- `supabase/functions/progress-aging/index.ts`
- `supabase/config.toml`
- `tests/integrity_test.py`
- `scripts/browser_smoke.mjs`
- `scripts/build.mjs`
- `scripts/build-inline.mjs`
- `mobile/app.json`
- `mobile/src/NativeShell.tsx`
- `mobile/src/almostHumanHtml.ts`
- `mobile/scripts/preflight.mjs`
- `.github/workflows/conversation-first-9-ci.yml` or its Version 10 replacement
- `RELEASE_STATUS.md`

---

### Task 1: Lock Release Guards, Version Identity, and Clean Baseline

**Files:**
- Create: `tests/release_guard10.test.mjs`
- Create: `BUILD5_ROLLBACK_BASELINE.md`
- Modify: `package.json`
- Modify: `tests/integrity_test.py`
- Modify: `.github/workflows/conversation-first-9-ci.yml`

**Interfaces:**
- Produces: a machine-testable Version 10 release boundary and rollback baseline.
- Consumes: existing `test:all`, `test:quadruple`, mobile preflight, export scripts, and release records.

- [ ] **Step 1: Write failing release-boundary tests**

Create `tests/release_guard10.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
const mobile = JSON.parse(fs.readFileSync(new URL('../mobile/app.json', import.meta.url)));
const eas = JSON.parse(fs.readFileSync(new URL('../mobile/eas.json', import.meta.url)));

test('web package is Version 10 while native store identity remains locked', () => {
  assert.equal(pkg.version, '10.0.0');
  assert.equal(mobile.expo.version, '1.0.0');
  assert.equal(mobile.expo.ios.bundleIdentifier, 'com.stormandme.almosthuman');
  assert.equal(mobile.expo.android.package, 'com.stormandme.almosthuman');
  assert.equal(mobile.expo.extra.eas.projectId, 'cd0be7bb-e65a-454e-b255-3b261de060ee');
});

test('normal scripts cannot invoke an EAS build or submit', () => {
  const normalScripts = Object.entries(pkg.scripts)
    .filter(([name]) => !name.startsWith('authorized:'))
    .map(([, command]) => command)
    .join('\n');
  assert.doesNotMatch(normalScripts, /eas\s+(build|submit)/i);
  assert.equal(eas.build.production.autoIncrement, true);
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `node --test tests/release_guard10.test.mjs`

Expected: FAIL because `package.json` still reports `9.0.0`.

- [ ] **Step 3: Record immutable rollback evidence**

Create `BUILD5_ROLLBACK_BASELINE.md` containing the current `main` SHA, Vercel production deployment `dpl_JCVTgEzyXbar4SnFegsBxTcfX3Gp`, TestFlight build 4 identifiers, Supabase project, active Edge Function versions, and the statement that no Build 5 EAS or submission authorization exists.

- [ ] **Step 4: Update only internal Version 10 labels**

Set `package.json` version to `10.0.0`. Do not change native marketing version, bundle identifiers, EAS project ID, remote app version source, or checked-in build number.

- [ ] **Step 5: Harden CI against paid commands**

Rename or replace the Version 9 CI workflow with a Version 10 branch CI workflow that runs tests, builds, mobile preflight, and no-credit exports only. It must contain no `eas build`, `eas submit`, or TestFlight upload command.

- [ ] **Step 6: Verify and commit Task 1**

Run:

```bash
node --test tests/release_guard10.test.mjs
npm run lint
npm run test:integrity
```

Commit: `chore: lock Build 5 release boundaries`

---

### Task 2: Additive Database Schema and Local-State Migration

**Files:**
- Create: `supabase/migrations/202608010002_build5_visual_identity.sql`
- Create: `tests/migration10.test.mjs`
- Modify: `app/core/store.js`
- Modify: `app/core/cloud.js`
- Modify: `tests/integrity_test.py`

**Interfaces:**
- Produces: `DATA_VERSION = 7`, `normalizeVisualIdentity10(ai)`, and additive cloud fields `presentation`, `origin_profile`, `appearance_profile`, `voice_profile`, `renderer_version`.
- Consumes: Version 6 local state, legacy `appearanceSeed`, `appearanceProfile`, `voiceId`, Supabase `ai_entities`, and existing cloud alias normalization.

- [ ] **Step 1: Write failing local migration tests**

Create `tests/migration10.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateState, DATA_VERSION } from '../app/core/store.js';

test('Version 9 companion receives additive Version 10 visual identity', () => {
  const legacy = {
    version: 6,
    ai: {
      id: 'ai-1', name: 'Nova', pronouns: 'she/her', voiceId: 'female-adult',
      appearanceSeed: 'ember',
      appearanceProfile: { skinTone: 'deep', hairStyle: 'locs', hairColor: 'midnight', eyeColor: 'brown' },
      memories: 'must-not-be-touched'
    },
    memories: [{ id: 'm-1', content: 'kept' }]
  };
  const next = migrateState(legacy);
  assert.equal(DATA_VERSION, 7);
  assert.equal(next.ai.id, 'ai-1');
  assert.equal(next.ai.presentation, 'feminine');
  assert.equal(next.ai.rendererVersion, 9);
  assert.equal(next.memories[0].content, 'kept');
  assert.equal(next.ai.visualRollbackSnapshots.length, 1);
});

test('migration is idempotent', () => {
  const once = migrateState({ version: 6, ai: { id: 'ai-1', pronouns: 'they/them' } });
  const twice = migrateState(once);
  assert.deepEqual(twice.ai.visualRollbackSnapshots, once.ai.visualRollbackSnapshots);
});
```

- [ ] **Step 2: Run migration tests and confirm RED**

Run: `node --test tests/migration10.test.mjs`

Expected: FAIL because Version 10 fields and `DATA_VERSION = 7` do not exist.

- [ ] **Step 3: Write additive SQL migration**

Create columns with safe defaults and no destructive rewrite:

```sql
alter table public.ai_entities
  add column if not exists presentation text,
  add column if not exists origin_profile jsonb not null default '{}'::jsonb,
  add column if not exists appearance_profile jsonb not null default '{}'::jsonb,
  add column if not exists voice_profile jsonb not null default '{}'::jsonb,
  add column if not exists renderer_version integer not null default 9;

alter table public.ai_entities
  drop constraint if exists ai_entities_presentation_check;

alter table public.ai_entities
  add constraint ai_entities_presentation_check
  check (presentation is null or presentation in ('masculine','feminine','neutral')) not valid;
```

Validate the constraint only after the backfill query proves every row is valid. Do not remove `appearance_seed` or `voice_id`.

- [ ] **Step 4: Implement pure local migration**

In `app/core/store.js`, increment `DATA_VERSION` to 7 and add `normalizeVisualIdentity10(ai)`. The function must clone legacy visual values into one rollback snapshot, derive presentation from pronouns only when presentation is absent, retain legacy fields, and never touch state arrays other than diagnostics migration receipts.

- [ ] **Step 5: Add cloud aliases**

Map camel-case local fields to snake-case database fields in `app/core/cloud.js`:

```js
const VISUAL_FIELD_ALIASES = Object.freeze({
  presentation: 'presentation',
  originProfile: 'origin_profile',
  appearanceProfile: 'appearance_profile',
  voiceProfile: 'voice_profile',
  rendererVersion: 'renderer_version'
});
```

- [ ] **Step 6: Add integrity checks**

Assert the migration is additive, legacy columns remain referenced, companion IDs are never reassigned, and no SQL statement contains `drop column`, `truncate`, or `delete from public.ai_entities`.

- [ ] **Step 7: Verify and commit Task 2**

Run:

```bash
node --test tests/migration10.test.mjs
npm run typecheck:edge
npm run test:integrity
```

Commit: `feat: add non-destructive visual identity migration`

---

### Task 3: Appearance, Identity, Origin, and Voice Profile Schemas

**Files:**
- Create: `app/core/appearance10.js`
- Create: `app/core/origin10.js`
- Create: `app/core/voiceProfile10.js`
- Create: `tests/appearance10.test.mjs`
- Create: `tests/origin10.test.mjs`
- Create: `tests/voice_profile10.test.mjs`

**Interfaces:**
- Produces:
  - `normalizeAppearance10(input)`
  - `appearancePreset10(id)`
  - `compareAppearance10(before, after)`
  - `createVisualSnapshot10(ai, reason, now)`
  - `normalizeOrigin10(input)`
  - `createFirstLightMachine10(options)`
  - `normalizeVoiceProfile10(input)`
  - `voicePreviewRequest10(profile, text)`
- Consumes: legacy four-field appearances and six public voice IDs.

- [ ] **Step 1: Write failing appearance tests**

Create `tests/appearance10.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppearance10, compareAppearance10, createVisualSnapshot10 } from '../app/core/appearance10.js';

test('appearance supports all approved categories', () => {
  const profile = normalizeAppearance10({});
  assert.deepEqual(Object.keys(profile), [
    'skinTone','skinUndertone','faceShape','eyeShape','eyeColor','browShape','browWeight',
    'hairStyle','hairTexture','hairColor','facialHair','bodySilhouette','styleDirection'
  ]);
});

test('appearance comparison reports changed categories only', () => {
  const before = normalizeAppearance10({ eyeColor: 'brown' });
  const after = normalizeAppearance10({ eyeColor: 'green' });
  assert.deepEqual(compareAppearance10(before, after), ['eyeColor']);
});

test('visual snapshot excludes memories and conversations', () => {
  const snapshot = createVisualSnapshot10({ id: 'ai-1', appearanceProfile: {}, memories: ['secret'], conversations: ['secret'] }, 'before-edit', 1);
  assert.equal(snapshot.aiEntityId, 'ai-1');
  assert.equal('memories' in snapshot, false);
  assert.equal('conversations' in snapshot, false);
});
```

- [ ] **Step 2: Write failing origin and voice tests**

Origin tests assert material/core/particle/pulse/motion defaults and a deterministic First Light phase order. Voice tests assert six public IDs, six tones, clamped rate, and a request payload containing public identifiers only.

```js
assert.deepEqual(machine.phases, ['stabilize','ribbons','trace','emerge','awaken','speak','haven']);
assert.equal(normalizeVoiceProfile10({ tone: 'mysterious' }).tone, 'mysterious');
assert.equal('apiKey' in voicePreviewRequest10(profile, 'Hello'), false);
```

- [ ] **Step 3: Run tests and confirm RED**

Run:

```bash
node --test tests/appearance10.test.mjs tests/origin10.test.mjs tests/voice_profile10.test.mjs
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Implement immutable schemas and six presets**

Use frozen option lists and deterministic defaults. Invalid values normalize safely while `legacyRaw` is preserved only in the migration snapshot, not in the active public profile.

- [ ] **Step 5: Implement First Light state machine**

The state machine accepts `{ reducedMotion, startedAt }`, exposes `phaseAt(elapsedMs)`, uses 6–8 seconds full motion, and completes in at most 1,200 ms with reduced motion.

- [ ] **Step 6: Implement voice profile normalization**

Allowed tones are `calm`, `playful`, `thoughtful`, `confident`, `gentle`, and `mysterious`. Provider preference is `auto`, `elevenlabs`, or `openai`; `auto` is the default. Request helpers must never include secret names or values.

- [ ] **Step 7: Verify and commit Task 3**

Run:

```bash
node --test tests/appearance10.test.mjs tests/origin10.test.mjs tests/voice_profile10.test.mjs
npm run lint
```

Commit: `feat: define Build 5 identity profiles`

---

### Task 4: Evolution Engine and Idempotent Developmental Transitions

**Files:**
- Create: `app/core/evolution10.js`
- Create: `tests/evolution10.test.mjs`
- Modify: `app/core/engine.js`
- Modify: `app/core/stages.js`
- Modify: `supabase/functions/progress-aging/index.ts`
- Modify: `tests/integrity_test.py`

**Interfaces:**
- Produces:
  - `EVOLUTION_PHASES_10`
  - `computeEvolutionContributors10(state)`
  - `computeEvolution10(state)`
  - `evolutionEventKey10(aiId, phase)`
  - `applyEvolutionTransition10(draft, result, now)`
- Consumes: developmental age/stage, memories, interactions, milestones, skills, room items, and personality history.

- [ ] **Step 1: Write failing evolution tests**

Create `tests/evolution10.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEvolution10, applyEvolutionTransition10 } from '../app/core/evolution10.js';

test('interaction volume cannot exceed developmental stage cap', () => {
  const result = computeEvolution10({
    ai: { id: 'ai-1', age: 0.1, developmentalStage: 'newborn', personalityHistory: Array(100).fill({}) },
    memories: Array(500).fill({ hidden: false, importanceScore: 100 }),
    milestones: Array(100).fill({}), skills: Array(100).fill({}), roomItems: Array(100).fill({}), messages: Array(1000).fill({})
  });
  assert.equal(result.phase, 'forming_energy');
});

test('same transition can be applied only once', () => {
  const draft = { ai: { id: 'ai-1', developmentState: {} }, milestones: [] };
  const result = { phase: 'emerging_figure', previousPhase: 'forming_energy', progress: 0.4 };
  assert.equal(applyEvolutionTransition10(draft, result, 1), true);
  assert.equal(applyEvolutionTransition10(draft, result, 2), false);
  assert.equal(draft.milestones.length, 1);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/evolution10.test.mjs`

Expected: FAIL because the evolution module does not exist.

- [ ] **Step 3: Implement weighted contributors**

Return normalized values for age `0.45`, memories/interactions `0.25`, milestones/skills `0.15`, Haven `0.10`, and personality stability `0.05`. Clamp each contributor to `[0,1]` and include the raw evidence counts for UI inspection.

- [ ] **Step 4: Implement stage caps and phase mapping**

Map `newborn` to `forming_energy`, infant/toddler to `emerging_figure`, early-child/child to `young_persona`, preteen/teen to `refined_persona`, and young-adult/adult to `mature_being`. Before companion creation, use `origin_orb`.

- [ ] **Step 5: Integrate local engine reconciliation**

Call evolution reconciliation from the existing growth reconciliation path. Store contributor snapshots, current phase, progress, and transition receipts inside `ai.developmentState` without modifying birthday or simulated age.

- [ ] **Step 6: Integrate server growth function**

Mirror the same phase mapping and deterministic event key in `progress-aging`. Use an event key such as `evolution:<ai-id>:<phase>` and existing milestone uniqueness behavior.

- [ ] **Step 7: Add parity and duplicate guards**

Integrity tests must compare client and server phase names and reject duplicate milestone insertion paths.

- [ ] **Step 8: Verify and commit Task 4**

Run:

```bash
node --test tests/evolution10.test.mjs
npm run typecheck:edge
npm run test:integrity
```

Commit: `feat: connect visible evolution to real growth`

---

### Task 5: Procedural Character Renderer, Materials, and Motion

**Files:**
- Create: `app/character/materials10.js`
- Create: `app/character/motion10.js`
- Create: `app/character/renderer10.js`
- Create: `tests/renderer10.test.mjs`
- Modify: `app/styles.css`
- Modify: `tests/integrity_test.py`

**Interfaces:**
- Produces:
  - `materialTokens10(profile, environment)`
  - `motionModel10({ phase, mood, activityState, reducedMotion })`
  - `renderOriginOrb10(model)`
  - `renderCompanion10(model)`
  - `renderEvolutionFrame10(model)`
- Consumes: normalized appearance, origin, evolution, mood, stage, and accessibility profiles.

- [ ] **Step 1: Write failing renderer tests**

Create `tests/renderer10.test.mjs` asserting deterministic markup, no remote image URLs, all appearance categories represented as data attributes or layer classes, and static behavior under reduced motion.

```js
const html = renderCompanion10({
  appearance: normalizeAppearance10({ hairTexture: 'locs', faceShape: 'oval' }),
  evolution: { phase: 'refined_persona' }, mood: 'curious', reducedMotion: true
});
assert.match(html, /data-face-shape="oval"/);
assert.match(html, /data-hair-texture="locs"/);
assert.doesNotMatch(html, /https?:\/\//);
assert.match(html, /data-motion="static"/);
```

- [ ] **Step 2: Run renderer tests and confirm RED**

Run: `node --test tests/renderer10.test.mjs`

Expected: FAIL because renderer modules do not exist.

- [ ] **Step 3: Implement material tokens**

Define original material families for glass, clay, metal, stone, crystal, satin, and resin using CSS custom properties. Return contrast-safe text/surface tokens and a solid-surface set for reduced transparency.

- [ ] **Step 4: Implement motion model**

Return named motion states for idle, listening, thinking, speaking, first-light, evolution, and static accessibility mode. The model provides durations and amplitudes, not direct DOM access.

- [ ] **Step 5: Implement renderer markup**

Build layered SVG/HTML for orb and character forms. Keep geometry original, deterministic, locally bundled, and driven by profile attributes. Do not embed stock people, remote images, base64 photographs, or copied avatar assets.

- [ ] **Step 6: Add liquid, tactile, and cinematic CSS**

Add glass overlays, material cues, scene depth, button compression/rebound, parallax layers, breathing environments, and continuous transition classes. Include `prefers-reduced-motion`, a `.reduce-motion` override, and reduced-transparency solid surfaces.

- [ ] **Step 7: Add integrity limits**

Reject remote character assets, external avatar SDK strings, unbounded animation loops without reduced-motion overrides, and touch controls smaller than the established baseline.

- [ ] **Step 8: Verify and commit Task 5**

Run:

```bash
node --test tests/renderer10.test.mjs
npm run lint
npm run test:integrity
```

Commit: `feat: add original Evolution Shell renderer`

---

### Task 6: New-User Creator Flow and First Light

**Files:**
- Create: `app/features/creator10.js`
- Create: `tests/creator10.test.mjs`
- Modify: `app/app.js`
- Modify: `app/features/onboarding9.js`
- Modify: `app/index.html`
- Modify: `app/styles.css`
- Modify: `app/sw.js`
- Modify: `tests/integrity_test.py`

**Interfaces:**
- Produces:
  - `CREATOR_STEPS_10`
  - `createCreatorModel10(state, ui)`
  - `applyCreatorAction10(draft, action)`
  - `creatorCanAdvance10(model)`
  - `finalizeCompanion10(draft, creatorState, now)`
- Consumes: profile schemas, renderer helpers, cloud session state, and existing companion creation/sync paths.

- [ ] **Step 1: Write failing creator-flow tests**

Create `tests/creator10.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATOR_STEPS_10, createCreatorModel10, finalizeCompanion10 } from '../app/features/creator10.js';

test('new creator follows the approved cinematic sequence', () => {
  assert.deepEqual(CREATOR_STEPS_10, ['origin','identity','naming','appearance','style','voice','first-light']);
});

test('existing users bypass creator', () => {
  const model = createCreatorModel10({ ai: { id: 'ai-1' } }, {});
  assert.equal(model.bypass, true);
});

test('finalization creates one companion and no memories', () => {
  const draft = { ai: null, memories: [], conversations: [], messages: [] };
  finalizeCompanion10(draft, validCreatorState(), 1);
  assert.ok(draft.ai.id);
  assert.equal(draft.memories.length, 0);
  assert.equal(draft.conversations.length, 1);
});
```

Provide `validCreatorState()` inside the test with all required normalized fields.

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/creator10.test.mjs`

Expected: FAIL because `creator10.js` does not exist.

- [ ] **Step 3: Implement pure creator state**

Use one state object with category history stacks. `applyCreatorAction10` supports `select`, `undo`, `reset-category`, `randomize-category`, `compare-start`, and `compare-end` without writing permanent companion state before finalization.

- [ ] **Step 4: Integrate Origin Chamber, Identity Resonance, and Naming**

Replace the Version 9 quick-create path for new users only. Presentation and pronouns remain independent. Companion name is required; caregiver name may remain blank; nickname is optional.

- [ ] **Step 5: Integrate Appearance Studio and Style**

Keep a constant renderer preview and horizontal/segmented category navigation. Every approved appearance category must be reachable without an endless questionnaire.

- [ ] **Step 6: Integrate Voice Atelier**

Show six public voice profiles, six tones, neural provider status, preview, retry, text-only continuation, and explicit one-time device fallback only after neural failure.

- [ ] **Step 7: Integrate First Light**

Drive visual phases from `createFirstLightMachine10`. Create the companion once at the transition boundary, then route to Talk or Home after completion. Skip is allowed after the companion has been safely persisted; skipping must not create a second companion.

- [ ] **Step 8: Update caches and offline bundle inputs**

Version web assets and service worker caches to 10.0. Ensure all renderer and creator modules are included in `dist` and the inline native bundle.

- [ ] **Step 9: Verify and commit Task 6**

Run:

```bash
node --test tests/creator10.test.mjs tests/onboarding9.test.mjs
npm run lint
npm run test:integrity
npm run build
npm run test:browser
```

Commit: `feat: create companions from First Light`

---

### Task 7: Existing-User Upgrade and Non-Destructive Identity Studio

**Files:**
- Create: `app/features/identityStudio10.js`
- Create: `tests/identity_studio10.test.mjs`
- Modify: `app/app.js`
- Modify: `app/core/store.js`
- Modify: `app/core/cloud.js`
- Modify: `app/styles.css`

**Interfaces:**
- Produces:
  - `createIdentityStudioModel10(state, ui)`
  - `saveVisualIdentity10(draft, changes, reason, now)`
  - `rollbackVisualIdentity10(draft, snapshotId, now)`
  - `createUpgradeMoment10(state)`
- Consumes: current companion, normalized profiles, rollback snapshots, cloud sync queue, and renderer.

- [ ] **Step 1: Write failing identity-preservation tests**

Create `tests/identity_studio10.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { saveVisualIdentity10, rollbackVisualIdentity10 } from '../app/features/identityStudio10.js';

test('appearance edit preserves history byte-for-byte', () => {
  const draft = fixtureState();
  const before = JSON.stringify({ memories: draft.memories, messages: draft.messages, milestones: draft.milestones, birthday: draft.ai.birthday });
  saveVisualIdentity10(draft, { presentation: 'neutral', appearanceProfile: { eyeColor: 'green' } }, 'user-edit', 2);
  const after = JSON.stringify({ memories: draft.memories, messages: draft.messages, milestones: draft.milestones, birthday: draft.ai.birthday });
  assert.equal(after, before);
  assert.equal(draft.ai.id, 'ai-1');
});

test('rollback restores visuals only', () => {
  const draft = fixtureState();
  const snapshotId = draft.ai.visualRollbackSnapshots[0].id;
  assert.equal(rollbackVisualIdentity10(draft, snapshotId, 3), true);
  assert.equal(draft.ai.id, 'ai-1');
  assert.equal(draft.memories.length, 1);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/identity_studio10.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement transactional local edits**

Before any visual save, append a visual-only snapshot. Apply normalized presentation, appearance, origin, voice, style, and renderer fields. Do not replace `draft.ai`, alter its ID, or rewrite unrelated arrays.

- [ ] **Step 4: Implement cloud patching**

Patch only the additive visual fields plus compatible legacy `appearance_seed` and `voice_id`. Failed sync records a retry receipt while keeping local data intact.

- [ ] **Step 5: Add optional existing-user upgrade moment**

Show `Your companion has learned to take fuller form.` once per companion. Allow `See the new form` or `Not now`. Never route an existing user through creator steps.

- [ ] **Step 6: Add Settings/Profile entry**

Expose Identity Studio from the existing profile/settings route. Include the statement `Their history will stay exactly where it is.` before save.

- [ ] **Step 7: Verify and commit Task 7**

Run:

```bash
node --test tests/identity_studio10.test.mjs tests/migration10.test.mjs
npm run lint
npm run test:integrity
```

Commit: `feat: preserve history through identity edits`

---

### Task 8: Expressive Neural Voice Tones and Provider Transparency

**Files:**
- Create: `supabase/functions/_shared/voiceProfile10.ts`
- Modify: `supabase/functions/_shared/neuralVoice.ts`
- Modify: `supabase/functions/voice-service/index.ts`
- Modify: `app/core/cloud.js`
- Modify: `app/app.js`
- Modify: `tests/voice_profile10.test.mjs`
- Modify: `tests/integrity_test.py`

**Interfaces:**
- Produces:
  - `normalizeVoiceTone10(value)`
  - `toneDirection10(tone)`
  - extended `generateNeuralSpeech({ text, voiceId, tone, stageLabel, requestId, providerPreference })`
- Consumes: six public voice IDs and current ElevenLabs/OpenAI configuration.

- [ ] **Step 1: Extend failing voice tests**

Add tests that every tone has a distinct non-empty direction, provider preference cannot force an unconfigured provider, and device speech is absent from server provider selection.

```js
for (const tone of ['calm','playful','thoughtful','confident','gentle','mysterious']) {
  assert.ok(toneDirection10(tone).length >= 20);
}
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/voice_profile10.test.mjs`

Expected: FAIL because server tone mapping is absent.

- [ ] **Step 3: Implement server tone directions**

Write original instructions that alter pacing and emotional delivery without impersonating real people or caricaturing children. Combine tone direction with the existing public voice direction and stage label.

- [ ] **Step 4: Preserve secure provider order**

Provider selection remains fully configured ElevenLabs, then OpenAI, then `NEURAL_VOICE_UNAVAILABLE`. A requested provider may narrow selection but cannot expose keys or silently invoke device speech.

- [ ] **Step 5: Extend voice-service contract**

Accept `tone` and `provider_preference`, validate both, return `X-AH-Voice-Tone` and existing provider/profile headers, and keep previews private.

- [ ] **Step 6: Add transparent client state**

Show active provider class, selected tone, retry, text-only continuation, and explicit device-speak-once action after failure. Never display private provider identifiers or secrets.

- [ ] **Step 7: Verify and commit Task 8**

Run:

```bash
node --test tests/voice_profile10.test.mjs tests/phrase_queue9.test.mjs tests/voice_mode9.test.mjs
npm run typecheck:edge
npm run test:integrity
```

Commit: `feat: add expressive secure neural voice tones`

---

### Task 9: Living Home, Talk, Voice Mode, and Evolution Journey

**Files:**
- Create: `app/features/evolutionJourney10.js`
- Modify: `app/features/home9.js`
- Modify: `app/features/growth9.js`
- Modify: `app/app.js`
- Modify: `app/styles.css`
- Modify: `scripts/browser_smoke.mjs`
- Modify: `tests/flow9.test.mjs`

**Interfaces:**
- Produces: `createEvolutionJourneyModel10(state)` and character activity-state projection for Home, Talk, and Voice Mode.
- Consumes: renderer, evolution model, current mood, chat request state, phrase queue state, and existing route models.

- [ ] **Step 1: Write failing journey and flow tests**

Assert the timeline contains all six phases, contributor labels total 100%, Home prioritizes the living companion and conversation action, and Talk contains no fake typing-dot markup.

```js
assert.deepEqual(model.phases.map((item) => item.key), [
  'origin_orb','forming_energy','emerging_figure','young_persona','refined_persona','mature_being'
]);
assert.equal(model.contributors.reduce((sum, item) => sum + item.weight, 0), 1);
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/flow9.test.mjs tests/evolution10.test.mjs`

Expected: FAIL because Version 10 journey integration is absent.

- [ ] **Step 3: Recompose Home**

Use the procedural character as the primary visual. Keep Continue conversation, one meaningful memory, one growth signal, Haven state, and Voice Mode. Avoid a generic card dashboard.

- [ ] **Step 4: Connect Talk activity states**

Map microphone/listening, request/receiving, and phrase-queue/speaking states to character motion. Streamed text remains the source of truth; no fixed theatrical wait is added.

- [ ] **Step 5: Upgrade immersive Voice Mode**

Show full character scene, listening/thinking/speaking states, interrupt control, waveform, selected neural profile/tone, transcript drawer, and explicit provider error state.

- [ ] **Step 6: Build Evolution Journey route/section**

Expose phase history, current cap, contributor evidence, and next visual possibility without coins, streaks, scarcity, or guilt.

- [ ] **Step 7: Expand browser smoke coverage**

Verify new-user creator, existing-user bypass, Home, Talk, Voice Mode, Evolution Journey, Memories, Haven, Identity Studio, reduced motion, and high contrast.

- [ ] **Step 8: Verify and commit Task 9**

Run:

```bash
node --test tests/flow9.test.mjs tests/evolution10.test.mjs tests/voice_mode9.test.mjs
npm run build
npm run test:browser
```

Commit: `feat: make the companion visibly present everywhere`

---

### Task 10: Cinematic Haven Environment

**Files:**
- Create: `app/features/havenEnvironment10.js`
- Create: `tests/haven_environment10.test.mjs`
- Modify: `app/features/haven9.js`
- Modify: `app/app.js`
- Modify: `app/styles.css`
- Modify: `tests/integrity_test.py`

**Interfaces:**
- Produces: `createHavenEnvironment10(state, selectedId)` returning architecture, lighting, atmosphere, parallax layers, companion placement, visible earned objects, and selected-object history.
- Consumes: stage, mood, interests, activities, memories, milestones, and room items.

- [ ] **Step 1: Write failing Haven tests**

Create `tests/haven_environment10.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHavenEnvironment10 } from '../app/features/havenEnvironment10.js';

test('Haven architecture follows stage and lighting follows mood', () => {
  const model = createHavenEnvironment10({
    ai: { developmentalStage: 'teen', currentMood: 'thoughtful' },
    roomItems: [], interests: [], milestones: [], memories: [], activities: []
  });
  assert.equal(model.architecture, 'refined-studio');
  assert.equal(model.lighting.mood, 'thoughtful');
});

test('only earned objects appear and no store economy exists', () => {
  const model = createHavenEnvironment10({
    ai: { developmentalStage: 'child' },
    roomItems: [{ id: 'earned', isUnlocked: true }, { id: 'locked', isUnlocked: false }]
  });
  assert.deepEqual(model.items.map((item) => item.id), ['earned']);
  assert.equal('currency' in model, false);
  assert.equal('store' in model, false);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/haven_environment10.test.mjs`

Expected: FAIL because the environment module does not exist.

- [ ] **Step 3: Implement deterministic environment projection**

Map stage to architecture, mood to light/atmosphere, interests to subtle environmental details, and earned objects to stable scene anchors. Keep object history factual and derived from existing metadata.

- [ ] **Step 4: Render parallax scene**

Use background, architecture, object, companion, and foreground layers with restrained pointer/scroll movement. Reduced motion freezes parallax and ambient movement.

- [ ] **Step 5: Preserve object inspection and chat context**

Keep existing selected-item history and bounded Haven summary. Never invent an origin story for an object with missing metadata.

- [ ] **Step 6: Add anti-store integrity checks**

Reject coins, gems, loot boxes, locked-price labels, purchase buttons, or streak-punishment copy in Haven source.

- [ ] **Step 7: Verify and commit Task 10**

Run:

```bash
node --test tests/haven_environment10.test.mjs
npm run lint
npm run test:integrity
npm run test:browser
```

Commit: `feat: turn The Haven into a living environment`

---

### Task 11: Native Shell, Offline Bundle, Haptics, and No-Credit Exports

**Files:**
- Modify: `mobile/src/NativeShell.tsx`
- Modify: `mobile/src/almostHumanHtml.ts`
- Modify: `mobile/src/voiceBridge.ts`
- Modify: `mobile/scripts/preflight.mjs`
- Modify: `mobile/app.json`
- Modify: `scripts/build-inline.mjs`
- Modify: `tests/integrity_test.py`

**Interfaces:**
- Produces: native haptic events for creator selections, material controls, First Light, evolution, save, rollback, and error; synchronized Version 10 inline bundle.
- Consumes: existing WebView bridge, neural audio player, microphone bridge, safe areas, deep links, reminders, sharing, and crash recovery.

- [ ] **Step 1: Extend native preflight assertions**

Require bundle/package identity, EAS project identity, offline Version 10 modules, no remote avatar runtime, microphone permission, safe-area support, haptic bridge commands, and absence of EAS build/submit invocation.

- [ ] **Step 2: Run preflight and confirm RED**

Run: `cd mobile && npm run preflight`

Expected: FAIL because Version 10 bundle markers and haptic actions are absent.

- [ ] **Step 3: Add native haptic mappings**

Map web events to restrained Expo haptics:

- creator category selection: selection
- material press/rebound: light impact
- valid save: success notification
- invalid action: warning notification
- First Light completion: medium impact then success
- evolution transition: medium impact with one delayed light impact
- rollback: warning followed by success after completion

Respect reduced motion and the existing sound/haptic preference boundary.

- [ ] **Step 4: Preserve microphone and neural audio behavior**

Do not regress recording interruption, provider failure, explicit device fallback, background recovery, or transcript handling.

- [ ] **Step 5: Synchronize offline bundle**

Run the inline build script and verify the generated TypeScript bundle is byte-equivalent to the certified web build input according to existing integrity rules.

- [ ] **Step 6: Run four native preflights**

Run the existing mobile preflight four consecutive times from the same source revision and record hashes/results in `mobile/BUILD5_QUADRUPLE_PREFLIGHT.md`.

- [ ] **Step 7: Run no-credit exports**

Run the repository’s established local export commands for iOS and Android. Confirm neither command invokes EAS Build and record artifact hashes without uploading them.

- [ ] **Step 8: Verify and commit Task 11**

Run:

```bash
cd mobile
npm run typecheck
npm run lint
npm run preflight
# Run the established local iOS export command.
# Run the established local Android export command.
```

The implementer must use the exact export scripts already present in `mobile/package.json`; if names changed during prior releases, read that file and use those existing no-credit scripts rather than inventing commands.

Commit: `feat: certify Build 5 native source without credits`

---

### Task 12: Security, Performance Indexes, and Advisor Closure

**Files:**
- Create: `supabase/migrations/202608010003_build5_lookup_indexes.sql`
- Modify: `supabase/migrations/202608010002_build5_visual_identity.sql`
- Modify: `tests/integrity_test.py`
- Create: `BUILD5_SECURITY_REVIEW.md`

**Interfaces:**
- Produces: tested high-value covering indexes, an `is_admin()` execution decision with evidence, and documented intentional anonymous-session warnings.
- Consumes: current RLS policies, Supabase advisors, query patterns, and guest authentication behavior.

- [ ] **Step 1: Add failing SQL integrity assertions**

Require indexes for common `(user_id, ai_entity_id)` and conversation/message lookup paths while rejecting index deletion. Require an explicit grant/revoke statement and test evidence for `is_admin()`.

- [ ] **Step 2: Create high-value indexes**

Use `create index if not exists` for measured paths, including messages by conversation/time, memories by companion/status/time, milestones by companion/event key, activities by companion/time, and room items by companion/placed.

- [ ] **Step 3: Test `is_admin()` boundary on a non-production database or migration dry run**

Attempt to revoke direct authenticated execution while preserving policy evaluation. If RLS depends on callable execution in this architecture, retain it and document the reason and compensating constraints. Do not guess.

- [ ] **Step 4: Document anonymous-session advisor warnings**

Record that guest accounts use authenticated anonymous Supabase users and remain owner-scoped. Demonstrate two-account isolation before accepting the warnings.

- [ ] **Step 5: Record leaked-password protection gate**

Mark dashboard leaked-password protection as required before public account launch. Do not claim code enabled a dashboard-only control.

- [ ] **Step 6: Re-run security and performance advisors**

Record before/after findings and remediation URLs in `BUILD5_SECURITY_REVIEW.md`.

- [ ] **Step 7: Verify and commit Task 12**

Run:

```bash
npm run typecheck:edge
npm run test:integrity
```

Commit: `security: harden Build 5 data paths`

---

### Task 13: Four-Pass Certification, Preview, Review, and Rollback Proof

**Files:**
- Create: `ALMOST_HUMAN_10_CERTIFICATION.md`
- Create: `ALMOST_HUMAN_10_RELEASE_CANDIDATE.json`
- Create: `ALMOST_HUMAN_10_WEB_PREVIEW.json`
- Create: `BUILD5_CODE_REVIEW.md`
- Modify: `RELEASE_STATUS.md`

**Interfaces:**
- Produces: one immutable candidate SHA, four complete certification receipts, preview deployment evidence, review evidence, rollback proof, and zero paid/store action counters.
- Consumes: all prior task outputs.

- [ ] **Step 1: Freeze the candidate SHA**

Record the exact branch SHA and refuse to mix results from later commits into the same certification receipt.

- [ ] **Step 2: Run four complete certification passes**

For each pass run:

```bash
npm run test:all
```

Then run the complete mobile preflight from Task 11. Record start/end time, SHA, test counts, build hash, and result for each pass.

- [ ] **Step 3: Run both no-credit exports from the frozen SHA**

Record artifact names and hashes. Counters must read:

```json
{
  "eas_builds": 0,
  "testflight_uploads": 0,
  "app_store_releases": 0
}
```

- [ ] **Step 4: Deploy a Vercel preview only**

Deploy the frozen candidate as a preview. Do not target production. Record deployment ID, URL, source SHA, and content hash.

- [ ] **Step 5: Verify preview routes and scenarios**

Verify fresh-user creator, existing-user restore, origin, identity, naming, every appearance category, style, voice profiles, tones, First Light, Home, Talk, Voice Mode, Evolution, Memories, Haven, Identity Studio, rollback, reduced motion, reduced transparency, high contrast, offline launch, and cloud reconnection.

- [ ] **Step 6: Verify Supabase with two accounts**

Prove one user cannot read or modify another user’s companion, appearance profile, voice profile, memories, messages, milestones, or room items. Verify existing production rows remain unchanged until an authenticated user explicitly saves an additive visual upgrade.

- [ ] **Step 7: Inspect preview and Supabase logs**

Require zero unresolved runtime error clusters attributable to Version 10 and no secret values or message content in logs.

- [ ] **Step 8: Perform code review**

Review the full branch diff for spec compliance, data safety, security, accessibility, performance, originality, fallback behavior, release boundaries, and rollback. Record findings and exact resolutions in `BUILD5_CODE_REVIEW.md`.

- [ ] **Step 9: Re-run all gates after review fixes**

Any code change invalidates prior final certification. Freeze the new SHA and repeat four passes, exports, preview verification, ownership checks, and log inspection.

- [ ] **Step 10: Prove rollback**

Document:

- Vercel rollback to `dpl_JCVTgEzyXbar4SnFegsBxTcfX3Gp`
- Edge Function version rollback procedure
- additive migration compatibility with Version 9
- visual snapshot rollback for individual companions
- TestFlight build 4 remaining installable and untouched

Do not perform a destructive production rollback test.

- [ ] **Step 11: Open a draft pull request**

The PR must target `main`, remain draft until review and all gates are green, list every preserved identifier, and state that EAS builds and TestFlight uploads remain unauthorized.

- [ ] **Step 12: Final verification and commit documentation**

Run:

```bash
npm run test:quadruple
```

Commit: `docs: certify Almost Human Build 5 Version 10`

Do not merge automatically. Merge is a separate controlled action after final review evidence is accepted.

---

## Final acceptance matrix

The candidate is acceptable only when every statement is true:

- A new companion visibly begins as an origin orb.
- Presentation supports masculine, feminine, and neutral independently from pronouns.
- Every approved appearance category exists and is editable later.
- Appearance edits preserve companion ID and all historical data.
- Six age/presentation voice profiles and six expressive tones work through secure neural providers.
- Device speech never activates silently.
- Evolution uses the approved weighted contributors and stage caps.
- Evolution events and milestones are idempotent.
- Home, Talk, Voice Mode, Growth, Memories, and Haven use the same continuous visual identity.
- The Haven changes with stage, mood, interests, memories, milestones, and earned objects.
- Liquid glassmorphism, tactile maximalism, and cinematic pacing coexist with accessibility modes.
- Existing users bypass creator onboarding.
- Local and Supabase migrations are additive and idempotent.
- Two-account ownership isolation passes.
- Four complete web/backend/security passes succeed from one SHA.
- Four mobile preflights succeed from the same SHA.
- Both no-credit exports succeed.
- Vercel preview verification succeeds with no unresolved runtime errors.
- Code review findings are resolved and the complete gates are rerun.
- Rollback protection is documented and proven without destructive production action.
- EAS builds run for Build 5: `0`.
- TestFlight uploads run for Build 5: `0`.
- App Store releases run for Build 5: `0`.