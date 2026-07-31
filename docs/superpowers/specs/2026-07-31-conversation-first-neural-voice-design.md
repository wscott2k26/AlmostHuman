# Almost Human 9.0 — Conversation-First Neural Voice Design

Date: 2026-07-31
Status: Approved
Owner: Storm And Me LLC / Willy Will

## Goal

Make Almost Human feel immediate, natural, and simple while preserving its original premise: the user raises an intelligence whose personality, memories, abilities, and Haven develop through real interaction.

The redesign follows the strongest proven companion-app pattern: quick creation, immediate conversation, and deeper customization or growth features revealed afterward.

## Confirmed problems to solve

1. Replies feel slow because the client waits for a complete response and may poll for up to 18 seconds.
2. The TestFlight app sounds robotic because the native bundle routes speech through device text-to-speech.
3. The current first-run experience still delays the relationship with multiple controls and a long birth sequence.
4. Chat, voice, growth, memories, and Haven feel like separate systems instead of one continuous relationship.

## Product rules

- Conversation is the center of the product.
- A new user reaches the first meaningful exchange in under one minute.
- The user message appears immediately.
- Assistant words appear progressively as they are generated.
- No fake typing dots, rotating thought phrases, or artificial delay.
- Neural voice is the normal voice path.
- Device speech is never substituted silently.
- Personality continues to emerge from interaction, not a long personality questionnaire.
- Existing companions, conversations, memories, growth history, and Haven state are preserved.
- No streak pressure, currency HUD, guilt loops, or character marketplace.

## Approved seven-part release

### 1. Conversation-first onboarding

**Welcome**

- Living companion portrait
- Headline: “Raise an intelligence that grows with you.”
- One primary button: **Begin**
- Returning-user sign-in link
- One short privacy statement

**Quick Create**

One vertically scrolling screen designed to finish in under 60 seconds:

- What the companion should call the user
- Companion name
- Pronouns
- Six large appearance presets
- Six neural voice choices with cached previews:
  - Girl · Young
  - Girl · Teen
  - Woman · Adult
  - Boy · Young
  - Boy · Teen
  - Man · Adult
- One primary button: **Meet [Name]**

Detailed skin, hair, eye, and voice controls remain in Settings.

**First Light**

A skippable 2–3 second transition that ends directly in Chat. The existing approximately 11-second blocker is removed.

Existing users never repeat onboarding.

### 2. Streaming conversation

The current complete-response polling flow is replaced with a streaming chat endpoint.

The server emits newline-delimited server-sent events:

- `ack`: request accepted and persistent IDs established
- `delta`: assistant text fragment
- `metadata`: stage, mood, provider mode, and latency information
- `done`: final text and cloud IDs
- `error`: normalized recoverable failure

Client behavior:

1. Render the user message immediately.
2. Create a stable request ID before the network call.
3. Open one assistant message container immediately with a calm listening state.
4. Append deltas into that same message.
5. Persist/reconcile final IDs when `done` arrives.
6. Reconnect once with the same request ID after a dropped stream.
7. Never create duplicate messages for a retry.

Latency targets from Send:

- User message visible: under 100 ms on-device
- First assistant text: median under 1.5 s, p95 under 4 s on a healthy connection
- Normal short reply complete: median under 6 s

A Stop control cancels generation and voice playback. A non-streaming fallback is allowed only when clearly labeled “Replying without live text.”

### 3. Neural voice

ElevenLabs is the preferred primary text-to-speech provider. The existing OpenAI voice endpoint may remain as a temporary compatible provider behind the same interface until an ElevenLabs secret is configured; device speech is not the normal path.

Provider secrets stay in Supabase. No key is stored in the web bundle, Expo binary, GitHub, or client storage.

The six product voice profiles map to six curated provider voice IDs stored in deployment configuration. “Young” and “Teen” are synthetic style labels; the product does not clone any real child, celebrity, user, or tester.

Each voice must pass a listening review for natural pacing, warmth, pronunciation, age style, and absence of metallic artifacts.

Phrase-level audio flow:

1. Stream text into the chat bubble.
2. Detect the first complete clause or sentence.
3. Request secured neural audio for that phrase.
4. Queue later phrases while the current phrase plays.
5. Preserve phrase order.
6. Stop immediately when interrupted.

If neural voice is unavailable, text continues and the app says so. **Use device voice this time** is a separate manual action; robotic fallback is never silent.

### 4. Voice Mode and microphone

A phone control in Chat opens a focused Voice Mode.

Release 9.0 uses reliable tap-to-talk:

1. Tap microphone to speak.
2. Tap again or pause to finish.
3. Committed transcript appears immediately.
4. Reply streams as text.
5. Neural speech begins after the first complete phrase.
6. Tapping the microphone while speech plays interrupts playback and starts the next turn.

Hands-free full duplex is outside this release.

The existing native permission flow remains, with a clear recording state, stop control, duration/size limits, empty-transcript recovery, and exact iPhone Settings guidance after denial.

The current secure transcription service remains unless measured transcription latency proves it is the bottleneck. ElevenLabs real-time transcription may later use authenticated single-use tokens; no permanent API key may reach the client.

### 5. Simpler app flow

Primary navigation contains five destinations:

1. Home
2. Chat
3. Growth
4. Memories
5. Haven

Chat is the emphasized center destination. Settings opens from the companion/profile control.

**Home** contains only:

- Large companion portrait
- Mood/status line
- Continue conversation
- Today’s growth moment
- One Haven or memory highlight

**Growth** explains current stage, recent changes, next ability, and optional activities in plain language.

**Memories** shows readable cards and search; correction, privacy, and deletion live in memory details.

**Haven** opens as a scene first; object details appear after tapping an item.

After a new user’s first meaningful exchange, one dismissible card introduces Growth and Haven without interrupting Chat.

### 6. Existing-user migration

On first 9.0 launch:

- Preserve companion identity, name, pronouns, appearance, voice choice, conversations, memories, milestones, growth, and Haven.
- Map legacy voice IDs to the closest neural profile.
- Show one dismissible “Faster chat and a more natural voice are ready” card.
- Let the user preview and confirm the mapped neural voice.
- Never reset or duplicate a conversation.

### 7. Reliability, measurement, and release

Tests are written before production changes and must fail for the intended missing behavior.

Required automated coverage:

- Welcome → Quick Create → Chat is the only new-user pre-conversation path.
- Existing users bypass onboarding and retain all data.
- User messages render optimistically.
- Stream deltas assemble in order.
- Same request ID cannot duplicate messages.
- Stop cancels text and audio.
- Neural voice never silently falls back to device speech.
- Six voice profiles remain correctly mapped.
- Phrase audio queue preserves order.
- Provider failure leaves text usable.
- Mic denial and empty transcription recover cleanly.
- Five-tab navigation and Settings remain reachable.

Performance instrumentation records:

- Send-to-first-delta
- Send-to-final-text
- First-delta-to-first-audio
- Audio interruption time
- Transcription completion time

Before any paid EAS build:

- Four complete web/backend/security test passes
- Four mobile preflight passes
- Expo Doctor fully green
- TypeScript and lint green
- iOS and Android no-credit exports green
- Live Supabase smoke tests green
- Real-device verification of microphone, streaming, neural voice, interruption, background/foreground, and migration
- No open high-severity defect

A paid iOS build requires fresh explicit authorization after certification. TestFlight upload requires separate explicit authorization.

## Architecture boundaries

### Client/PWA

Owns optimistic chat rendering, stream parsing, phrase segmentation, audio-queue state, navigation, cancellation, and visible recovery.

### Native Expo shell

Owns microphone permission/capture, native audio playback and interruption, audio-session behavior, deep links, notifications, haptics, safe areas, and crash recovery.

### Supabase Edge Functions

Own authentication, ownership validation, OpenAI streaming, neural TTS proxying, idempotency, persistence, provider timeouts, normalized errors, and background memory/growth work.

### Database

Existing tables remain authoritative. Schema changes are additive and limited to request-state or latency telemetry where needed.

## Security and privacy

- OpenAI and ElevenLabs secrets remain Supabase secrets.
- Audio is processed for transcription or playback and is not stored by Almost Human.
- Logs contain request IDs, timings, status codes, and provider IDs—not message or audio content.
- Voice and microphone data follow account deletion and app-data deletion controls.
- No voice cloning ships in 9.0.

## Error behavior

- Slow connection: keep received text and offer Reconnect.
- AI unavailable: offer a clearly labeled local developmental fallback.
- Neural voice unavailable: preserve text and offer manual device voice.
- Microphone denied: show Settings path.
- Empty transcript: keep the composer active and invite retry.
- Duplicate request: load the existing request state.
- Interrupted playback: stop without marking the message failed.
- App backgrounded: pause or stop according to iOS audio-session rules.

No error restarts the companion or destroys history.
