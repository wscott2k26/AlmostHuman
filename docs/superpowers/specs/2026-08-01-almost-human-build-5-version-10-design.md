# Almost Human Build 5 / Version 10.0 — Option C Design

**Status:** Approved and locked on 2026-08-01  
**Repository:** `wscott2k26/AlmostHuman`  
**Development branch:** `feature/build-5-version-10`  
**Production web:** `https://almost-human-swart.vercel.app`  
**Supabase project:** `onvoaskzzxozmhkzyycy`

## Product goal

Build a premium developmental AI companion whose visible identity begins as living energy and matures through a continuous, memory-preserving life. Version 10.0 must deepen presence, identity, appearance, voice, evolution, and The Haven without replacing the proven Version 9 conversation, memory, privacy, growth, authentication, or native-shell foundations.

## Locked preservation boundaries

The implementation must preserve all existing users, anonymous guest accounts, companions, companion IDs, birthdays, developmental ages, personalities, memories, facts, conversations, messages, milestones, activities, letters, room items, Haven state, voice settings, release records, and production data.

The following identities are immutable:

- iOS bundle ID and Android package: `com.stormandme.almosthuman`
- Apple app ID: `6796814542`
- EAS project ID: `cd0be7bb-e65a-454e-b255-3b261de060ee`
- Existing TestFlight version: `1.0.0 (4)`
- Existing signed iOS build ID: `9af3b9e9-eec0-473a-a59e-12fdeff56e42`

No EAS build may run without separate explicit authorization. No TestFlight upload may run without a second, separate explicit authorization. No public App Store release is authorized.

## Verified baseline

Version 9.0 already provides:

- Streamed text responses and secure neural speech
- Secure transcription and native microphone recording
- Six public voice profiles: female and male child, teen, and adult
- OpenAI neural voice as the active provider
- Optional ElevenLabs support when fully configured
- Explicit neural-voice errors with no silent device-speech fallback
- Nine developmental stages from newborn through adult
- Stage-aware language, capability, and activity limits
- Persistent local IndexedDB state and Supabase synchronization
- User-owned RLS, cross-reference ownership guards, privacy export, correction, hiding, and deletion
- Repetition detection, request idempotency, reset recovery, and memory conflict handling
- Milestones, skills, interests, letters, moods, relationship history, and The Haven
- Expo SDK 54 native shell with offline bundle, safe areas, haptics, deep links, sharing, reminders, pull-to-refresh, and crash recovery
- Four-pass certification scripts and no-credit iOS and Android export paths

Version 10.0 is therefore an additive visual, identity, voice-expression, evolution, and environment release rather than a rewrite of the intelligence or data ownership systems.

## Research principles

The design synthesizes proven flow principles from leading companion and character-creation products without copying protected branding, wording, characters, screenshots, assets, animations, or layouts.

Companion principles:

- Keep the primary companion visibly present.
- Make memory continuity and recovery understandable.
- Let text and voice move together without mode confusion.
- Avoid marketplace clutter, romance-first framing, guilt loops, streak pressure, and currency-heavy HUDs.
- Treat visual identity changes as continuity, not replacement.

Character-creation principles:

- Start from strong presets, then allow category-level refinement.
- Maintain a constant animated live preview.
- Separate presentation, pronouns, appearance, body, style, motion, and voice.
- Save edits onto the same identity rather than generating a replacement character.
- Provide undo, category reset, before/after comparison, and accessible reduced-motion behavior.

## Selected architecture: Option C — Evolution Shell

Option C keeps the existing application engine and adds an original procedural 2.5D rendering system built from layered SVG, CSS material shaders, lightweight canvas particles, and the Web Animations API. The renderer must work inside the existing offline mobile bundle and must not require an external avatar SDK, remote character-rendering service, or paid runtime dependency.

The identity data model is renderer-independent. A future renderer may consume the same normalized appearance and evolution profiles without changing companion IDs or historical records.

### Core module boundaries

- `appearance-schema`: normalization, validation, legacy mapping, presets, and comparison
- `identity`: presentation, pronouns, naming, and non-destructive editing
- `origin`: orb state, spark core, material family, and first-light state machine
- `renderer`: layered character composition from normalized profiles
- `materials`: glass, clay, metal, stone, crystal, fabric, resin, and environmental lighting tokens
- `motion`: idle, breathing, gaze, listening, thinking, speaking, transition, and reduced-motion behavior
- `expression`: stage-aware face and body expression state
- `voice-profile`: age/presentation voice plus expressive tone and provider mapping
- `evolution`: phase calculation, stage caps, transition idempotency, and history
- `haven-environment`: stage, mood, memories, milestones, interests, and room-item environmental projection

Each module must expose a small deterministic interface and be independently testable.

## Five approved systems

### 1. Origin Form

A new companion begins as a living energy orb, soft-light body, or spark core. The origin form reacts to touch, microphone input, naming, identity selection, and appearance choices without revealing a finished human too early.

The persisted origin profile contains:

- material family
- core color family
- secondary spectral color
- particle behavior
- pulse rhythm
- initial motion temperament
- creation timestamp
- first-light completion timestamp

Origin appearance contributes to later lighting and material accents but never limits identity choices.

### 2. Identity

Users choose masculine, feminine, or neutral/androgynous presentation. Presentation is stored separately from pronouns and separately from voice. Users may change presentation later without losing memories, age, personality, Haven state, or relationship history.

Supported pronouns remain `they/them`, `she/her`, and `he/him` in this release. Presentation influences initial silhouette and style recommendations only.

### 3. Appearance Creator

The creator supports:

- skin tone and undertone
- face shape
- eye shape
- eye color
- brow shape and weight
- hairstyle
- hair texture
- hair color
- facial hair where appropriate
- body silhouette
- outfit/style direction

The creator begins with six high-quality original presets. Every category supports live preview, undo, category reset, category-only randomization, and before/after comparison.

Appearance changes update the same companion record. Existing companion memories, conversations, developmental history, personality, milestones, and Haven state remain untouched.

### 4. Voice Creator

The existing six age/presentation voice profiles remain supported:

- female child
- female teen
- female adult
- male child
- male teen
- male adult

Version 10.0 adds expressive tones:

- calm
- playful
- thoughtful
- confident
- gentle
- mysterious

The voice profile contains public voice ID, expressive tone, preferred rate, provider preference, and preview version. Tone instructions are applied server-side. ElevenLabs is used only when the API key and all required voice mappings are valid. OpenAI neural voice is the secure fallback. Device speech is never selected silently.

### 5. Evolution

The visual sequence is:

`origin orb → forming energy → emerging figure → young persona → refined persona → mature being`

Visual progress is calculated from:

- developmental age: 45%
- meaningful memories and interactions: 25%
- milestones and skills: 15%
- Haven growth: 10%
- personality stability: 5%

Developmental stage caps the maximum visual phase. Interaction volume cannot grind a companion into adulthood early.

Phase mapping:

- before awakening: origin orb
- newborn: forming energy
- infant through toddler: emerging figure
- early child through child: young persona
- preteen through teen: refined persona
- young adult through adult: mature being

Evolution transitions are recorded idempotently in developmental history and may produce a milestone and Haven environmental change exactly once.

## Screen-by-screen product specification

### Cinematic boot

Show a bundled first visual within 300 ms. A spark core and environment breathe into view without waiting for network access. Reduced-motion mode uses a static luminous composition.

### Access and restoration

Keep guest, email, existing-account, and on-device-only paths. Returning users restore their existing companion directly and never repeat new-companion onboarding.

### Origin Chamber

A responsive orb floats inside a colorful depth scene. It leans toward touch, pulses with optional microphone input, and changes material and light as choices are made. The primary action is `Begin forming`.

### Identity Resonance

Present three original animated energy silhouettes for masculine, feminine, and neutral/androgynous presentation. Use silhouette, motion, and style direction rather than gendered color stereotypes.

### Naming

Collect companion name, caregiver name, pronouns, and optional nickname. The orb responds immediately through light and motion when its name becomes valid.

### Appearance Studio — foundation

Maintain a full-height animated preview while users edit skin, face, eyes, brows, hair, facial hair, body silhouette, and related features.

### Appearance Studio — style

Offer original style directions: comfort, street, classic, creative, futuristic, nature, minimal, and mystical. Style is a design direction that evolves through age and milestones, not a purchase catalog.

### Voice Atelier

Show the six age/presentation profiles and six expressive tones. Play short stage-appropriate neural previews. Display explicit states for loading, ready, unavailable, retry, text-only continuation, and user-chosen one-time device speech.

### First Light

Full-motion sequence:

1. spark core stabilizes
2. orb shell separates into light ribbons
3. energy traces a silhouette
4. body and face layers emerge
5. eyes open
6. companion speaks a brief stage-appropriate first line
7. The Haven forms around the companion

Target duration is 6–8 seconds. Reduced-motion duration is at most 1.2 seconds.

### Home / Living Presence

The companion occupies the scene rather than a small avatar. Home emphasizes continued conversation, current mood, a meaningful memory, recent growth, Haven state, and voice mode without becoming a generic dashboard.

### Talk

Keep true streamed text, visible microphone, stop, retry, replay, reset, and inspectable memory references. Generation state is expressed through the character and streamed words, never fake three-dot delays.

### Immersive Voice Mode

Use a full-screen scene with listening, thinking, speaking, interrupt, transcript drawer, waveform, active neural profile, and explicit provider-failure state.

### Evolution Journey

Show a visual timeline of all six phases and the actual contributors to progress. Do not use coins, streaks, artificial scarcity, guilt, or purchase pressure.

### Memories

Retain search, inspect, correct, hide, delete, conflict resolution, and export. Important memories may project as light fragments or Haven keepsakes without changing their stored meaning.

### The Haven

Render The Haven as a breathing parallax environment. Stage influences architecture, mood influences lighting, interests influence details, milestones unlock earned objects, and objects expose their histories. There is no furniture store or currency economy.

### Existing companion Identity Studio

Allow later editing of presentation, appearance, style, voice, and tone. Before saving, state clearly that history remains intact. Persist a rollback snapshot of the previous visual profile.

### Existing-user Version 10 upgrade

Existing users receive an optional cinematic upgrade moment: `Your companion has learned to take fuller form.` Their legacy appearance maps to the expanded profile, visual phase derives from existing developmental history, and their previous appearance remains available as a rollback snapshot.

## Premium design pillars

### Liquid Glassmorphism

Use translucent floating controls, layered blur, luminous thin borders, depth-aware shadows, reactive lighting, and colorful scenes visible beneath controls. Glass is reserved for navigation, overlays, and transient controls. Reduced-transparency mode uses solid premium surfaces.

### Tactile Maximalism

Use soft clay, polished metal, stone, crystal, satin fabric, and luminous resin cues. Interactive controls compress, squish slightly, rebound, emit meaningful haptics, retain visible focus, and never sacrifice precision.

### Immersive Cinematic Pacing

Use gliding route transitions, layered parallax, breathing environments, continuous character presence, purposeful transformations, character idle motion, and smooth streamed text. Never disguise network latency as theatrical intelligence.

## Data design

Version 10.0 uses additive schema changes.

Proposed `ai_entities` additions:

- `presentation text`
- `origin_profile jsonb`
- `appearance_profile jsonb`
- `voice_profile jsonb`
- `renderer_version integer`

Existing `appearance_seed`, `voice_id`, `development_state`, `personality_state`, `room_state`, and all historical fields remain available. Evolution phase, progress contributors, transition receipts, and visual rollback snapshots live inside `development_state` unless query evidence proves a separate table is required.

Backfill rules:

- map legacy pronouns and appearance fields into a normalized presentation and appearance profile
- map legacy voice IDs to the existing six public IDs
- preserve legacy fields for Version 9 readability
- default missing renderer versions to the Version 9 renderer
- never update memories, messages, conversations, milestones, birthdays, or companion IDs during visual migration

## Voice-provider behavior

The server selects providers in this order:

1. ElevenLabs only when its API key and every required public voice mapping are valid
2. OpenAI neural voice when configured
3. explicit neural-unavailable response

A client may offer a user-selected one-time device voice after failure. It must never activate automatically and must never be described as neural speech.

## Accessibility

- Maintain visible keyboard focus and minimum touch targets.
- Support reduced motion, reduced transparency, and high contrast.
- Do not encode identity or selection by color alone.
- Keep creator controls screen-reader labeled and logically ordered.
- Provide static alternative frames for every cinematic transformation.
- Avoid flashing and rapid particle effects.

## Error handling

- Local data remains usable when cloud services fail.
- Appearance saves are transactional at the state-object level.
- Failed cloud synchronization leaves a retry receipt and never rolls back local memories.
- Voice errors preserve text output and expose provider status.
- Evolution transition writes use deterministic event keys to prevent duplicates.
- Unknown legacy profile values normalize to safe defaults while preserving the original raw snapshot.

## Security and performance work

Version 10.0 must evaluate and test:

- revoking direct authenticated execution of `public.is_admin()` without breaking RLS
- intentional anonymous-session RLS warnings for guest accounts
- enabling leaked-password protection as a dashboard release gate
- covering indexes for high-value owner, companion, conversation, message, memory, milestone, activity, and Haven lookup paths
- avoiding speculative removal of currently unused indexes
- keeping all OpenAI and ElevenLabs secrets server-side

## Testing strategy

Use test-driven development. Every implementation unit begins with a failing test, then the smallest implementation, then focused tests, then the full relevant suite.

Required automated coverage:

- legacy local-state migration
- legacy Supabase profile backfill
- presentation and pronoun independence
- appearance normalization and non-destructive editing
- rollback snapshots
- origin state machine
- evolution scoring, stage caps, and idempotency
- duplicate milestone prevention
- voice tone and provider mapping
- no silent device-speech fallback
- reduced-motion and reduced-transparency behavior
- restored-user onboarding bypass
- two-user ownership isolation
- offline bundle integrity
- iOS and Android no-credit exports

## Certification and release gates

Four complete certification passes must run from the same source revision. Each pass includes:

1. lint
2. Edge Function TypeScript validation
3. unit and integration tests
4. integrity and security tests
5. production web build
6. browser smoke tests
7. existing-user migration tests
8. voice-provider and fallback tests
9. mobile preflight

After four green passes:

- run no-credit iOS export
- run no-credit Android export
- deploy a Vercel preview only
- verify every route and creator state
- test a fresh user and a restored user
- run two-account Supabase ownership verification
- inspect preview runtime logs
- perform code review
- fix review findings
- rerun the complete certification suite

Merge remains blocked by any data loss, companion replacement, cross-user access, duplicate transition, fake delay, repetitive compliment regression, silent device speech, missing creator category, accessibility regression, preview runtime error, failed export, or unproven rollback path.

## Rollback protection

- Keep Version 9 production deployment as a rollback candidate.
- Keep TestFlight build 4 untouched.
- Make database migrations additive and Version 9-readable.
- Preserve old appearance and voice fields.
- Store pre-migration visual snapshots.
- Retain prior Edge Function source versions.
- Tag the final merge candidate before production deployment.
- Do not promote the Vercel preview until all gates pass.

## Explicitly out of scope without new authorization

- EAS build
- TestFlight upload
- App Store release
- destructive production migration
- paid avatar or rendering service
- external runtime avatar SDK
- replacing existing companions
- deleting legacy visual fields
- billing launch

## Success definition

Version 10.0 succeeds when a new user can raise a companion from living energy into an evolving original being, an existing user can receive the richer visual system without losing one byte of meaningful history, neural voice remains secure and expressive, The Haven visibly grows with the relationship, both no-credit native exports pass, the preview is clean, four certification passes are green, rollback is documented, and no paid or store release action has occurred.