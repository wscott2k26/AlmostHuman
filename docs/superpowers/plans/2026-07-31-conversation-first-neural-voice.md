# Almost Human 9.0 Conversation-First Neural Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a faster conversation-first Almost Human experience with progressive replies, natural neural speech, simple tap-to-talk voice mode, preserved existing-user data, and a fully certified no-credit mobile candidate.

**Architecture:** Keep the existing local-first PWA, Supabase data model, and Expo WebView shell. Add focused modules for onboarding, stream parsing, phrase queuing, voice playback, and telemetry instead of expanding the already-large `app/app.js` and `mobile/src/NativeShell.tsx`. Introduce additive authenticated Supabase Edge Functions for streaming chat and neural voice while retaining current endpoints as explicit fallback paths.

**Tech Stack:** Vanilla ES modules, IndexedDB, Node test runner, Python integrity tests, TypeScript/Deno Supabase Edge Functions, OpenAI Responses streaming, ElevenLabs streaming TTS when configured, Expo SDK 54, React Native 0.81, `expo-audio`, WebView bridge, GitHub Actions, Vercel.

## Global Constraints

- Preserve all existing companions, conversations, messages, memories, growth, milestones, and Haven state.
- New-user pre-chat flow is Welcome → Quick Create → skippable First Light → Chat.
- Render user messages immediately and stream assistant text into one message.
- No fake typing dots or rotating waiting phrases.
- Device speech is never a silent fallback for a selected neural voice.
- Keep six public voice profiles: female-child, female-teen, female-adult, male-child, male-teen, male-adult.
- No provider API key in source, build artifacts, browser storage, or app logs.
- No voice cloning.
- Five primary destinations: Home, Chat, Growth, Memories, Haven; Settings opens from profile.
- No EAS build or TestFlight upload during implementation and certification.
- Write a failing behavior test before each production behavior change.

---

### Task 1: Conversation-First Onboarding, Navigation, and Existing-User Entry

**Files:**
- Create: `app/features/onboarding9.js`
- Create: `app/features/navigation9.js`
- Create: `tests/onboarding9.test.mjs`
- Create: `tests/navigation9.test.mjs`
- Modify: `app/app.js`
- Modify: `app/styles.css`
- Modify: `app/core/store.js`
- Modify: `app/index.html`
- Modify: `app/sw.js`
- Modify: `tests/integrity_test.py`

**Interfaces:**
- Produces: `createOnboardingModel(state, ui)`, `renderWelcome9(model)`, `renderQuickCreate9(model)`, `renderFirstLight9(model)`, `primaryDestinations9()`, and `migrateUiStateTo9(draft)`.
- Consumes: existing `beingMarkup`, store state, onboarding values, and route navigation callbacks supplied by `app/app.js`.

- [ ] **Step 1: Write failing onboarding tests**

Create `tests/onboarding9.test.mjs` asserting:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOnboardingModel } from '../app/features/onboarding9.js';

test('new users have exactly welcome, quick-create, first-light before chat', () => {
  const model = createOnboardingModel({ ai: null }, { onboardingStep: 0 });
  assert.deepEqual(model.steps, ['welcome', 'quick-create', 'first-light']);
  assert.equal(model.firstConversationRoute, 'talk');
});

test('existing users bypass onboarding without changing companion data', () => {
  const ai = { id: 'ai-1', name: 'Nova', voiceId: 'soft-neutral' };
  const model = createOnboardingModel({ ai }, { onboardingStep: 0 });
  assert.equal(model.bypass, true);
  assert.equal(model.ai, ai);
});
```

- [ ] **Step 2: Run onboarding tests and confirm RED**

Run: `node --test tests/onboarding9.test.mjs`

Expected: FAIL because `app/features/onboarding9.js` does not exist.

- [ ] **Step 3: Write failing navigation tests**

Create `tests/navigation9.test.mjs` asserting:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { primaryDestinations9 } from '../app/features/navigation9.js';

test('9.0 has five primary destinations and settings is not a tab', () => {
  const items = primaryDestinations9();
  assert.deepEqual(items.map((item) => item.route), ['home', 'talk', 'grow', 'memories', 'world']);
  assert.equal(items.some((item) => item.route === 'settings'), false);
});
```

- [ ] **Step 4: Run navigation tests and confirm RED**

Run: `node --test tests/navigation9.test.mjs`

Expected: FAIL because `app/features/navigation9.js` does not exist.

- [ ] **Step 5: Implement minimal onboarding and navigation modules**

Implement pure model/render helpers. Quick Create exposes six large appearance presets and six existing voice profiles. First Light has a maximum duration of 2,800 ms, a Skip action, and routes to `talk`.

- [ ] **Step 6: Integrate the modules into `app/app.js`**

Replace the old three-card onboarding renderer and 11-second timer with the new flow. Existing users route to their last valid route or `talk`; no existing state is rewritten except additive migration flags.

- [ ] **Step 7: Simplify primary navigation and add profile Settings entry**

Use `primaryDestinations9()` for the five tabs. Add a profile control opening `#settings`.

- [ ] **Step 8: Add versioned migration**

In `app/core/store.js`, add an idempotent migration that:

```js
if (!draft.migrations?.conversationFirst9) {
  draft.migrations = { ...(draft.migrations || {}), conversationFirst9: true };
  draft.settings.showNineUpgradeCard = Boolean(draft.ai);
  draft.ai &&= { ...draft.ai, voiceId: normalizeLegacyVoiceId(draft.ai.voiceId) };
}
```

The real implementation must preserve object identity requirements used by the engine and must not use `&&=` if repository lint rules reject it.

- [ ] **Step 9: Update styling, cache version, and integrity assertions**

Add responsive Welcome, Quick Create, First Light, five-tab, and profile-control styles. Increment web asset/cache labels to 9.0. Integrity tests must reject the old 11,000 ms birth timing and six-tab navigation.

- [ ] **Step 10: Verify and commit Task 1**

Run:

```bash
node --test tests/onboarding9.test.mjs tests/navigation9.test.mjs
npm run lint
npm run test:integrity
```

Commit: `feat: add conversation-first onboarding and navigation`

---

### Task 2: Optimistic Messages and Streaming Chat

**Files:**
- Create: `app/core/chatStream.js`
- Create: `tests/chat_stream9.test.mjs`
- Create: `supabase/functions/chat-stream/index.ts`
- Create: `supabase/functions/_shared/streamProtocol.ts`
- Modify: `app/app.js`
- Modify: `app/core/cloud.js`
- Modify: `app/core/engine.js`
- Modify: `app/core/store.js`
- Modify: `app/config.js`
- Modify: `supabase/config.toml`
- Modify: `tsconfig.edge.json`
- Modify: `tests/integrity_test.py`

**Interfaces:**
- Produces: `parseEventStream(readable, handlers, signal)`, `createOptimisticTurn(store, input)`, `finalizeOptimisticTurn(store, result)`, `SupabaseCloud.chatStreamProvider(context, handlers, signal)`, and the authenticated function `chat-stream`.
- Stream event shape: `{ type: 'ack'|'delta'|'metadata'|'done'|'error', data: object }` encoded as `event: <type>\ndata: <json>\n\n`.

- [ ] **Step 1: Write failing stream-parser tests**

Test split chunks, multiple events in one chunk, Unicode text, malformed JSON error normalization, and abort behavior.

- [ ] **Step 2: Run parser tests and confirm RED**

Run: `node --test tests/chat_stream9.test.mjs`

Expected: FAIL because `chatStream.js` does not exist.

- [ ] **Step 3: Implement the stream parser**

Use `ReadableStreamDefaultReader`, `TextDecoder`, an event buffer split on blank lines, and exact event dispatch. Abort must release the reader and return `{ aborted: true }` without converting the turn into a failed permanent message.

- [ ] **Step 4: Write failing optimistic-turn tests**

Assert the user message and one pending assistant message exist before the provider promise resolves; finalization updates that assistant message instead of appending another; retry with the same request ID reuses the same pair.

- [ ] **Step 5: Run optimistic tests and confirm RED**

Expected: FAIL because optimistic helpers are absent.

- [ ] **Step 6: Implement optimistic turn storage**

Add message status values `pending`, `streaming`, `complete`, `cancelled`, and `failed`. Store request IDs on both sides of a turn. The engine’s current completed-response path remains compatible.

- [ ] **Step 7: Implement `SupabaseCloud.chatStreamProvider`**

Call `/functions/v1/chat-stream` with the authenticated headers and `Accept: text/event-stream`. Do not use `supabase.functions.invoke` because it buffers the body. Pass the response body to `parseEventStream`.

- [ ] **Step 8: Implement authenticated `chat-stream` Edge Function**

Reuse ownership, safety, developmental-stage, context-selection, idempotency, and persistence logic from `chat-service`. Establish request/message IDs before model generation; emit `ack`; call OpenAI Responses with streaming enabled; emit only validated output-text deltas; persist one final AI message; emit `done`; run memory/growth updates after the response path.

- [ ] **Step 9: Integrate streaming into `sendChat`**

Render optimistic messages synchronously. Replace `ui.thinking` with a per-request controller. Append deltas to the pending assistant message. Add Stop and Reconnect controls. Keep `chat-service` as an explicitly labeled non-streaming fallback.

- [ ] **Step 10: Add latency telemetry**

Record `sentAt`, `firstDeltaAt`, `doneAt`, and provider mode in local diagnostics and sanitized server request metadata. Do not log message content.

- [ ] **Step 11: Verify and commit Task 2**

Run:

```bash
node --test tests/chat_stream9.test.mjs
npm run typecheck:edge
npm run lint
npm run test:integrity
```

Commit: `feat: stream optimistic companion replies`

---

### Task 3: Neural Voice Provider and Ordered Phrase Queue

**Files:**
- Create: `app/core/phraseQueue.js`
- Create: `tests/phrase_queue9.test.mjs`
- Create: `supabase/functions/_shared/neuralVoice.ts`
- Modify: `supabase/functions/voice-service/index.ts`
- Modify: `app/core/cloud.js`
- Modify: `app/app.js`
- Modify: `app/config.js`
- Modify: `tests/integrity_test.py`

**Interfaces:**
- Produces: `segmentSpeakablePhrases(text, cursor)`, `PhraseAudioQueue`, and `generateNeuralSpeech({ text, voiceId, requestId })`.
- Voice service accepts `{ text, voice_id, request_id, preview }` and returns audio with `X-AH-Voice-Provider`, `X-AH-Voice-Request`, and `Cache-Control: no-store`.

- [ ] **Step 1: Write failing phrase segmentation tests**

Cover sentence boundaries, commas after a minimum word count, abbreviations, decimals, short fragments, and final flush.

- [ ] **Step 2: Run segmentation tests and confirm RED**

Run: `node --test tests/phrase_queue9.test.mjs`

Expected: FAIL because `phraseQueue.js` does not exist.

- [ ] **Step 3: Write failing queue-order and interruption tests**

Use a fake player that resolves manually. Assert phrase 2 never starts before phrase 1 ends; `stop()` aborts the active fetch/player and clears queued phrases; duplicate phrase IDs are ignored.

- [ ] **Step 4: Implement phrase segmentation and queue**

The queue receives `{ id, text, voiceId }`, fetches one secured audio response at a time or with a bounded prefetch of one, and delegates playback to a platform adapter. It emits `firstAudioAt`, `started`, `ended`, and `error` callbacks.

- [ ] **Step 5: Implement server provider abstraction**

`generateNeuralSpeech` selects ElevenLabs when `ELEVENLABS_API_KEY` and the mapped voice secret are configured. Use the low-latency ElevenLabs streaming endpoint and a low-latency model supported by the account. If ElevenLabs is not configured, call the existing OpenAI neural speech implementation through the same interface. Never call device speech server-side.

- [ ] **Step 6: Update voice-service contract**

Validate six voice IDs, user ownership, text length, and request ID. Return a clear 503 code `NEURAL_VOICE_UNAVAILABLE` when no neural provider is configured. Preview requests use short fixed text and may use a short private cache keyed by public profile, not user message content.

- [ ] **Step 7: Integrate phrase queue with streamed chat**

After each delta, segment newly completed phrases. When autoplay is enabled, enqueue the first phrase as soon as available. Stop speech when the user sends, taps Stop, begins recording, changes route away from Chat/Voice Mode, or backgrounds the app.

- [ ] **Step 8: Remove silent device-speech behavior**

The native path no longer automatically handles normal `speak` messages with Expo Speech. Device speech remains behind an explicit `device-speak-once` action shown only after neural failure.

- [ ] **Step 9: Verify and commit Task 3**

Run:

```bash
node --test tests/phrase_queue9.test.mjs
npm run typecheck:edge
npm run lint
npm run test:integrity
```

Commit: `feat: add secured neural phrase voice`

---

### Task 4: Native Audio Playback, Tap-to-Talk Voice Mode, and Mic Recovery

**Files:**
- Create: `mobile/src/NeuralAudioPlayer.ts`
- Create: `mobile/src/voiceBridge.ts`
- Create: `mobile/scripts/voice-preflight.mjs`
- Create: `tests/voice_mode9.test.mjs`
- Modify: `mobile/src/NativeShell.tsx`
- Modify: `mobile/package.json`
- Modify: `mobile/package-lock.json`
- Modify: `mobile/scripts/preflight.mjs`
- Modify: `app/app.js`
- Modify: `app/styles.css`
- Modify: `tests/integrity_test.py`

**Interfaces:**
- Native bridge receives: `audio-play`, `audio-stop`, `mic-toggle`, and `audio-session`.
- Native bridge emits: `audio-state`, `mic-state`, `mic-audio`, and `app-state`.
- `NeuralAudioPlayer.play({ id, url?, base64?, mimeType })` returns a cancellable playback handle.

- [ ] **Step 1: Write failing bridge-contract tests**

Assert every permitted message validates required fields, rejects unknown URLs/mime types, and represents interruption separately from playback failure.

- [ ] **Step 2: Run bridge tests and confirm RED**

Run: `node --test tests/voice_mode9.test.mjs`

Expected: FAIL because the contract module does not exist.

- [ ] **Step 3: Implement native neural audio player**

Use Expo SDK 54-compatible `expo-audio` playback APIs. Configure iOS audio sessions for spoken playback and recording transitions. Stop must complete promptly and release temporary files/players.

- [ ] **Step 4: Replace automatic Expo Speech path**

Keep Expo Speech only for the explicit one-time device fallback command. Normal neural audio is played by the new player.

- [ ] **Step 5: Add focused Voice Mode UI**

In the web layer, add a phone button and full-screen focused mode showing companion portrait, transcript, recording state, speaking state, one mic control, one close control, and no dashboard content.

- [ ] **Step 6: Implement interruption flow**

Tapping the mic while audio plays sends `audio-stop`, waits for stopped acknowledgment, and starts recording. Starting a text message also stops playback.

- [ ] **Step 7: Harden microphone states**

Handle first permission request, denied/can-ask-again, denied/settings-only, recording timeout, empty recording, oversized recording, empty transcript, backgrounding, and return to foreground. Preserve typed draft and conversation state in all cases.

- [ ] **Step 8: Extend mobile preflight**

Static preflight must assert microphone description, neural playback module, explicit-only Expo Speech fallback, six profiles, no automatic `Speech.speak` path, and no unbounded audio base64.

- [ ] **Step 9: Verify and commit Task 4**

Run:

```bash
node --test tests/voice_mode9.test.mjs
cd mobile
npm run doctor
npm run typecheck
npm run lint
npm run preflight:quadruple
```

Commit: `feat: add interruptible tap-to-talk voice mode`

---

### Task 5: Simplified Home, Growth, Memories, and Haven

**Files:**
- Create: `app/features/home9.js`
- Create: `app/features/growth9.js`
- Create: `app/features/memories9.js`
- Create: `app/features/haven9.js`
- Create: `tests/flow9.test.mjs`
- Modify: `app/app.js`
- Modify: `app/styles.css`
- Modify: `tests/integrity_test.py`

**Interfaces:**
- Produces pure view models: `homeModel9(state)`, `growthModel9(state)`, `memoryListModel9(state, query)`, and `havenSceneModel9(state)`.
- Views consume existing engine-derived state and return HTML without writing state.

- [ ] **Step 1: Write failing flow-density tests**

Assert Home has one primary Continue Conversation action and at most three secondary content blocks; Growth exposes stage/recent/next/activities; Memories defaults to list/search and moves destructive controls to detail; Haven defaults to scene and reveals object details after selection.

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/flow9.test.mjs`

Expected: FAIL because the 9.0 feature modules do not exist.

- [ ] **Step 3: Implement pure models and focused renderers**

Keep existing data and capabilities. Remove duplicate statistics and configuration from primary screens; do not delete underlying features.

- [ ] **Step 4: Add post-first-conversation reveal**

After the first completed user/assistant exchange for a new companion, show one dismissible card introducing Growth and Haven. Persist dismissal locally and in cloud settings when available.

- [ ] **Step 5: Verify responsive and accessibility behavior**

Maintain 46 px minimum primary controls, visible focus, reduced motion, high contrast, safe-area spacing, and no hover-only operation.

- [ ] **Step 6: Verify and commit Task 5**

Run:

```bash
node --test tests/flow9.test.mjs
npm run lint
npm run test:integrity
npm run build
npm run test:browser
```

Commit: `feat: simplify core companion screens`

---

### Task 6: Migration, Diagnostics, Provider Configuration, and Live Services

**Files:**
- Create: `app/core/performance9.js`
- Create: `tests/migration9.test.mjs`
- Create: `tests/performance9.test.mjs`
- Create: `docs/ALMOST_HUMAN_9_PROVIDER_SETUP.md`
- Modify: `app/core/store.js`
- Modify: `app/core/cloud.js`
- Modify: `app/config.js`
- Modify: `supabase/functions/health/index.ts`
- Modify: `scripts/verify_live.mjs`
- Modify: `tests/integrity_test.py`

**Interfaces:**
- Produces: `migrateTo9(draft)`, `ConversationTimings`, and health fields `chat_stream_configured`, `neural_voice_configured`, `neural_voice_provider`, and `transcription_configured`.

- [ ] **Step 1: Write failing migration tests**

Test 8.4 fixtures with legacy voice IDs, existing cloud IDs, long histories, no migrations object, and repeated migration calls. Assert byte-equivalent preservation of user content and stable IDs.

- [ ] **Step 2: Run migration tests and confirm RED**

Run: `node --test tests/migration9.test.mjs`

Expected: FAIL because `migrateTo9` is absent.

- [ ] **Step 3: Implement idempotent migration**

Map only configuration fields required by 9.0. Never rewrite message content, memory content, timestamps, relationship values, or Haven item IDs.

- [ ] **Step 4: Write failing performance tests**

Assert timings never contain text/audio content, derive non-negative durations, tolerate absent audio, and cap stored samples.

- [ ] **Step 5: Implement sanitized performance diagnostics**

Store the most recent 100 samples locally. Sync only aggregate values or explicitly approved diagnostics; no message text or audio.

- [ ] **Step 6: Inspect and configure provider secrets**

Check Supabase secret names without reading values. If `ELEVENLABS_API_KEY` and six mapped voice secrets are available, enable ElevenLabs. Otherwise deploy the provider abstraction with the existing OpenAI neural provider active and record ElevenLabs as an explicit pending configuration—not a hidden device fallback.

- [ ] **Step 7: Deploy additive Edge Functions**

Deploy `chat-stream`, updated `voice-service`, and updated health function. Preserve the old `chat-service` and transcription function as fallbacks. Verify JWT enforcement and exact allowed origins.

- [ ] **Step 8: Deploy web 9.0 candidate**

Build from the feature branch, publish to a preview deployment first, run live checks, and promote the stable domain only after preview passes. Do not alter TestFlight build 3.

- [ ] **Step 9: Verify and commit Task 6**

Run:

```bash
node --test tests/migration9.test.mjs tests/performance9.test.mjs
npm run typecheck:edge
npm run verify:live
```

Commit: `feat: add safe 9.0 migration and diagnostics`

---

### Task 7: Four-Pass Certification and Release Candidate Handoff

**Files:**
- Create: `ALMOST_HUMAN_9_CERTIFICATION.md`
- Create: `ALMOST_HUMAN_9_RELEASE_CANDIDATE.json`
- Modify: `mobile/STEP7_PREFLIGHT.json`
- Modify: `mobile/STEP7_QUADRUPLE_PREFLIGHT.md`
- Modify: `RELEASE_STATUS.md`
- Modify: `.github/workflows/` only as needed for no-credit certification; no build trigger is created.

**Interfaces:**
- Produces a sanitized release candidate record containing source commit, test counts, live function versions, web deployment ID, no-credit export hashes, known limitations, `easBuildsRun: 0`, and `testFlightUploadsRun: 0`.

- [ ] **Step 1: Run four complete web/backend/security passes**

Run `npm run test:quadruple`. All four iterations must be green from the same commit.

- [ ] **Step 2: Run mobile certification**

From `mobile/` run Doctor, TypeScript, lint, four preflights, iOS export, and Android export. No EAS command is permitted.

- [ ] **Step 3: Run live service smoke tests**

Verify authenticated stream event order, request-id replay, neural voice response/provider header, explicit neural failure behavior, transcription, health, allowed origins, and ownership rejection using test identities designed for the project.

- [ ] **Step 4: Execute performance harness**

Record at least 20 healthy text turns and 10 voice turns across warm and cold starts. Report median and p95 for first delta, final text, first audio, interruption, and transcription. Do not fabricate target compliance.

- [ ] **Step 5: Perform real-device checklist**

Verify on the current TestFlight device through a development/preview-safe route where possible: existing-user migration snapshot, mic permission states, text streaming, neural voice, interruption, background/foreground, empty transcription, rotation/safe areas, and no data loss. Native-module changes remain unclaimable until a future signed build.

- [ ] **Step 6: Create certification and candidate records**

Document every command, commit, deployment, result, limitation, and zero-credit boundary. A failed gate blocks release-candidate status.

- [ ] **Step 7: Open reviewed pull request**

Open a PR from `feature/conversation-first-9-0` to `main` containing the spec, plan, source, tests, deployment receipts, and certification. Review the exact diff and resolve issues before merge.

- [ ] **Step 8: Request separate paid-build authorization**

Only after the PR is merged and the candidate remains green, request a fresh explicit authorization for one new iOS build. TestFlight upload remains a separate later authorization.

Commit: `docs: certify Almost Human 9.0 release candidate`
