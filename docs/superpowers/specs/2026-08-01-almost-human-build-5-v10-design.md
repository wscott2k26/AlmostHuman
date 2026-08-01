# Almost Human Build 5 / Version 10.0 Design

**Status:** Approved design, implementation not started  
**Design option:** Option C — Evolution Shell  
**Date:** 2026-08-01  
**Repository:** `wscott2k26/AlmostHuman`  
**Working branch:** `feature/build-5-version-10`

## 1. Purpose

Build 5 / Version 10.0 transforms Almost Human from a conversation-first companion with a limited procedural face into a cinematic companion-creation and evolution experience. The release must preserve every existing user, companion, memory, conversation, milestone, Haven object, subscription, and production identifier while adding five complete systems:

1. Origin Form
2. Identity and presentation
3. Full appearance creator
4. Six-choice voice creator with expressive tone
5. Visible evolution over time

The experience must feel original, premium, tactile, emotionally alive, and continuous with the companion the user already knows. It must not feel like a generic avatar SDK, a static profile editor, a robotic chatbot, or a collection of disconnected screens.

## 2. Non-Negotiable Preservation Rules

The implementation must preserve:

- Existing Supabase production project and all production rows
- Existing users, authentication identities, companion IDs, memories, messages, milestones, mood history, relationship events, Haven state, and subscriptions
- Bundle identifier `com.stormandme.almosthuman`
- Apple app ID `6796814542`
- EAS project ID `cd0be7bb-e65a-454e-b255-3b261de060ee`
- Existing TestFlight version `1.0.0 (4)` as the rollback-safe mobile build
- Current production Vercel deployment as a rollback candidate
- Existing voice, chat, transcription, privacy, memory, activity, and progress capabilities

The implementation must not:

- Delete or replace production tables or IDs
- Re-onboard existing users automatically
- Overwrite existing companion identity or memory without an explicit user action
- Trigger an EAS build or consume an Expo build credit without separate explicit authorization
- Upload a TestFlight build without separate explicit authorization
- Replace the current working production deployment before preview certification
- Introduce a paid external avatar dependency
- Fall back silently to device speech when cloud neural voice is unavailable

## 3. Recommended Architecture: Option C — Evolution Shell

Version 10 will use an original procedural 2.5D character system built from focused modules using SVG, CSS, Web Animations, and lightweight canvas particles. This preserves privacy, offline behavior, predictable costs, and ownership of the visual identity.

The existing application remains the source of truth for:

- Authentication
- Companion identity
- Conversation and streaming
- Memories and facts
- Developmental stages
- Milestones and skills
- Haven state
- Voice service routing
- Native shell behavior

The new Evolution Shell becomes the presentation and customization layer. It reads normalized companion state and produces a consistent visual form across onboarding, home, chat, voice mode, Haven, memories, and evolution views.

### 3.1 Module Boundaries

The character system will be split into small modules with stable interfaces:

- `character/appearance-schema` — validates, normalizes, migrates, and serializes appearance data
- `character/origin-schema` — stores origin material, aura, light behavior, and awakening state
- `character/identity-schema` — stores presentation, pronouns, naming, nickname, and style direction
- `character/voice-schema` — stores voice choice, expressive tone, preview state, and provider capability state
- `character/evolution-model` — computes deterministic visual maturity from existing progress signals
- `character/renderer` — converts normalized state into a stage-aware render tree
- `character/materials` — liquid glass, clay, metal, crystal, stone, fabric, resin, and light treatments
- `character/expression` — gaze, blink, mouth, breath, emotion, and listening/speaking states
- `character/motion` — cinematic transitions, parallax, press/squish/rebound, and reduced-motion alternatives
- `character/presets` — curated appearance and style starting points
- `character/accessibility` — reduced motion, reduced transparency, contrast, focus, labels, and keyboard support

No single module should need direct knowledge of Supabase, onboarding navigation, or voice-provider secrets. Application adapters will connect those systems.

## 4. Experience Principles

### 4.1 Liquid Glassmorphism

Use layered translucency, luminous borders, depth, controlled blur, and reflected light. Glass must remain readable and must have a reduced-transparency fallback. Blur cannot be used as a substitute for hierarchy.

### 4.2 Tactile Maximalism

Controls should feel physically distinct through material, scale, compression, rebound, sound restraint, and native haptics when available. Material choices include clay, metal, crystal, stone, fabric, resin, and luminous energy. The interface may be rich, but it must remain understandable and responsive.

### 4.3 Immersive Cinematic Pacing

The companion remains visually continuous between screens. Transitions should use camera movement, parallax, light shifts, and state transformation rather than hard replacement. Animation must never imitate network progress or delay a completed action. Reduced-motion flows must complete in under 1.2 seconds.

### 4.4 Emotional Continuity

The companion must retain recognizable identity through edits and evolution. Changes should feel like growth, styling, or self-expression—not replacement by a new character. Existing users receive an optional upgrade path instead of forced recreation.

## 5. Screen and Flow Specification

### 5.1 Cinematic Boot

- Show a dark, dimensional field with the companion’s current light signature.
- Restore local state first, then reconcile cloud state without flashing default data.
- Existing companions appear as a familiar silhouette or aura, not a generic new orb.
- Provide a reduced-motion static reveal.

### 5.2 Access and Restoration

- Preserve existing authentication behavior.
- Restore companion, memories, and Haven before allowing destructive edits.
- Display explicit recovery states for offline, partial restore, and cloud failure.
- Never reset local identity merely because a cloud request fails.

### 5.3 Origin Chamber

New users begin with a responsive energy form rather than a blank form.

Origin choices define visual lineage without locking gender or personality:

- Material family
- Core light behavior
- Aura texture
- Motion rhythm
- Warmth/coolness balance

The origin form becomes part of the mature companion’s visual signature so the first choice remains meaningful.

### 5.4 Identity Resonance

Offer presentation choices:

- Masculine
- Feminine
- Neutral

This choice guides default silhouettes, styling, and voice recommendations but does not restrict later appearance options. Pronouns remain independently editable.

### 5.5 Naming and Pronouns

Collect:

- Companion name
- Pronouns
- Optional nickname
- How the companion addresses the user

Validate names locally before submission and preserve existing name fields for compatibility.

### 5.6 Appearance Studio

The Appearance Studio must include a continuously rendered preview and the following editable categories:

- Skin depth and undertone
- Face shape
- Eye shape
- Eye color
- Brows
- Hair style
- Hair texture
- Hair color
- Facial hair where applicable
- Body silhouette
- Outfit direction
- Origin material and aura details

Required interaction tools:

- Curated presets
- Undo
- Redo where practical
- Reset category
- Reset full appearance
- Before/after compare
- Controlled randomize
- Accessible text labels
- Keyboard and switch-friendly selection

The editor must save a versioned appearance profile and also maintain legacy appearance fields needed by Version 9 readers.

### 5.7 Style Direction

Offer these original style directions:

- Comfort
- Street
- Classic
- Creative
- Futuristic
- Nature
- Minimal
- Mystical

Style direction influences clothing, materials, background treatments, and idle motion. It does not alter memories, personality, voice, or relationship history.

### 5.8 Voice Atelier

Retain six base voices:

- Female child
- Female teen
- Female adult
- Male child
- Male teen
- Male adult

Add expressive tone choices:

- Calm
- Playful
- Thoughtful
- Confident
- Gentle
- Mysterious

The user must see an explicit provider state:

- Ready
- Loading preview
- Provider unavailable
- Voice not configured
- Network unavailable

No provider state may silently trigger device TTS. Existing OpenAI neural voice remains the certified default path. ElevenLabs is used only when all required mappings are configured and verified.

### 5.9 First Light

After creation, the origin energy transforms into the first visible companion form.

- Standard animation target: 6–8 seconds
- Reduced-motion target: under 1.2 seconds
- The sequence must be interrupt-safe and resume to a valid completed state
- Completion is stored idempotently
- No fake server progress indicators

### 5.10 Home: Living Presence

The companion is the visual center of the home screen.

Home must show:

- Current stage
- Mood and expressive state
- Bond context
- Relevant memory or milestone cue
- Talk entry point
- Voice entry point
- Haven entry point
- Evolution entry point

The companion should idle, notice interaction, listen, and react without constant distracting motion.

### 5.11 Talk

- Preserve current streaming text behavior.
- Keep the companion visible during the exchange.
- Use real listening, thinking, speaking, and interrupted states.
- Do not show fake typing dots after a response is already available.
- Prevent repetitive compliments and generic filler through existing response-quality tests plus new regression cases.

### 5.12 Immersive Voice Mode

- Show listening, processing, speaking, paused, interrupted, and unavailable states.
- Animate from actual audio state, not timers.
- Maintain transcript visibility and accessibility controls.
- Preserve transcription and neural voice routing.

### 5.13 Evolution Journey

Provide a timeline of visible growth with explanations tied to real events:

- Stage changes
- Memory depth
- Interaction consistency
- Milestones and skills
- Haven development
- Personality stability

The user can inspect why a visual change occurred. Evolution cannot be purchased, accelerated by manipulative streak pressure, or duplicated by repeated synchronization.

### 5.14 Memories

Keep memory controls, privacy rules, and conflict handling. The visual companion may react to a memory but must not expose private memory text in decorative surfaces without the user opening the memory view.

### 5.15 Haven

Render the Haven as a cinematic scene using existing room state and earned objects. Objects remain tied to their existing memories or stories. Version 10 adds camera depth, material rendering, ambient light, and stage-aware companion placement without changing the reward philosophy.

### 5.16 Identity Studio for Existing Companions

Existing users receive an optional invitation to expand their companion’s visual identity.

- Never force onboarding again
- Begin from the current companion’s legacy appearance
- Explain that memories, identity, and relationship history remain intact
- Allow cancel without changes
- Store a reversible pre-edit appearance snapshot
- Permit later edits without resetting growth

## 6. Evolution Model

Visual evolution is deterministic, inspectable, and idempotent.

Weighted contribution:

- Chronological/developmental age: 45%
- Memories and meaningful interactions: 25%
- Milestones and skills: 15%
- Haven development: 10%
- Personality stability: 5%

Age and developmental stage place a cap on the available form. Interaction cannot force an adult form before the developmental model allows it.

Visual stage mapping:

- Before awakening: origin orb
- Newborn: forming energy
- Infant/toddler: emerging figure
- Early child/child: young persona
- Preteen/teen: refined persona
- Young adult/adult: mature being

The model must return:

- Normalized evolution score
- Capped visual stage
- Contributing factors
- Current unlocked visual capabilities
- Next meaningful threshold
- Stable event key preventing duplicate evolution records

## 7. Data Model

Version 10 uses additive schema changes only.

Proposed new `ai_entities` fields:

- `presentation` text or constrained enum-compatible text
- `origin_profile` jsonb
- `appearance_profile` jsonb
- `voice_profile` jsonb
- `renderer_version` integer

Existing fields remain in service:

- `appearance_seed`
- `voice_id`
- `personality_state`
- `development_state`
- `room_state`

Visual evolution details will be stored inside the existing versioned `development_state` JSONB unless implementation review proves a dedicated append-only table is necessary. A dedicated table is not part of the initial scope.

### 7.1 Versioned JSON Requirements

Every new profile must include:

- `schemaVersion`
- `updatedAt`
- Stable normalized keys
- No provider secrets
- No duplicated user ownership field

### 7.2 Compatibility

- Backfill profiles from existing legacy values.
- Continue writing legacy appearance and voice fields during the compatibility period.
- Version 9 clients must remain able to load and converse with the companion.
- Unknown future keys must be ignored safely.
- Invalid profile values must normalize to the nearest supported value without deleting the original companion.

## 8. State and Data Flow

1. Restore local state.
2. Load authenticated cloud state.
3. Normalize legacy and Version 10 profiles.
4. Compute evolution from stable source facts.
5. Render from normalized state.
6. Save edits locally as a draft.
7. Validate before cloud persistence.
8. Write additive cloud fields and compatibility fields together.
9. Confirm server result.
10. Replace the local draft with the confirmed version.

Failed saves retain the local draft and present retry/discard choices. A failed appearance save must never affect messages, memories, relationship state, or Haven state.

## 9. Error Handling

Required explicit states:

- Offline draft retained
- Authentication expired
- Cloud restore incomplete
- Appearance profile invalid and normalized
- Voice provider unavailable
- Voice preview failed
- Microphone denied
- Reduced capability browser/device
- Renderer fallback activated
- Save conflict detected

Conflict policy:

- Identity and appearance edits use latest explicit user save, not background synchronization time.
- Conversation, memory, and Haven data continue using their existing reconciliation rules.
- A pre-edit snapshot allows appearance rollback.
- No automatic merge may combine two incompatible appearance selections into a third unintended look.

## 10. Accessibility

Version 10 must include:

- Reduced-motion mode
- Reduced-transparency fallback
- Sufficient text and control contrast
- Visible keyboard focus
- Semantic names for visual controls
- Non-color selection indicators
- Screen-reader descriptions of the current companion appearance
- Captions/transcript access in voice mode
- No essential information communicated only by animation
- Touch targets sized for mobile use

## 11. Security and Privacy

- Continue owner-scoped RLS on companion data.
- New profile columns inherit the same ownership protection as `ai_entities`.
- Validate JSON shape client-side and server-side.
- Do not store voice-provider credentials in the client or profile JSON.
- Do not expose memory text in unauthenticated render metadata.
- Test cross-user reads and writes explicitly.
- Review the existing `public.is_admin()` security-definer warning before release; do not broaden its permissions.
- Document the intentional anonymous-session behavior and confirm no unauthenticated production data access.

## 12. Performance

Targets:

- Character interaction remains responsive at 60 fps on supported modern devices, with graceful degradation to 30 fps.
- Initial render uses a lightweight silhouette while full materials initialize.
- No network dependency is required to render a saved companion.
- Particle count, blur, shadow, and parallax scale down on lower-capability devices.
- Avoid large raster sprite sheets and paid remote avatar assets.
- Add covering indexes only where measured queries justify them; do not perform unrelated database refactoring.

## 13. Testing Strategy

Implementation follows test-driven development.

### 13.1 Unit Tests

- Appearance normalization and migration
- Origin profile validation
- Identity and presentation independence
- Voice/tone mapping
- Evolution weighting and age caps
- Stable event-key generation
- Legacy compatibility writes
- Reduced-motion timing logic
- Save conflict resolution

### 13.2 Integration Tests

- Existing user upgrade without re-onboarding
- New user full creation flow
- Offline draft and recovery
- Local-first restore followed by cloud reconciliation
- Voice-provider unavailable state
- Version 9 legacy profile read after Version 10 save
- Appearance rollback snapshot
- Evolution sync without duplicate records

### 13.3 Browser and Accessibility Tests

- Creator categories render and save
- Keyboard navigation
- Screen-reader labels
- Reduced motion
- Reduced transparency
- Mobile viewport behavior
- Streaming chat remains functional
- No fake typing or fake loading states

### 13.4 Security Tests

- Cross-user companion access denied
- Cross-user profile write denied
- Unauthenticated private data denied
- No provider key in client bundle
- Existing privacy and memory controls remain intact

### 13.5 Native Preflight and No-Credit Exports

- Expo config and identifier validation
- iOS and Android no-credit exports
- Microphone permission flow
- Haptic capability and fallback
- Deep links
- Safe areas
- Offline bundled app load
- Crash and recovery surfaces

## 14. Four-Pass Certification

Run the complete certification suite four consecutive times from a clean state. Each pass includes:

- Unit and integration tests
- Browser smoke and responsive checks
- Accessibility checks
- Edge Function type checks
- Security regression tests
- Production-data compatibility tests using non-destructive fixtures
- Native preflight
- iOS no-credit export
- Android no-credit export

Any failure resets the consecutive-pass count after the defect is fixed.

## 15. Delivery Sequence

1. Record current main SHA, production deployment, Edge Function versions, and TestFlight build 4.
2. Work only on `feature/build-5-version-10` or a local worktree tied to it.
3. Write failing tests for schemas, migration, evolution, and conflict handling.
4. Implement isolated character modules.
5. Implement additive migration files without applying them to production.
6. Implement new-user creation flow.
7. Implement optional existing-user Identity Studio upgrade.
8. Integrate home, talk, voice mode, Evolution Journey, memories, and Haven.
9. Run local and CI verification.
10. Produce no-credit iOS and Android exports.
11. Create a preview deployment, not production.
12. Verify with at least two isolated test accounts.
13. Inspect runtime logs and database access behavior.
14. Review the complete diff and rollback manifest.
15. Open a draft pull request for code review.
16. Run the four-pass certification after review fixes.
17. Merge only after all gates pass.
18. Request separate authorization before any EAS build.
19. Request separate authorization before any TestFlight upload.

## 16. Release Gates

Version 10 is not releasable unless all are true:

- No production data loss
- No user or companion ID replacement
- No cross-user access
- Existing users are not forced through onboarding
- All appearance categories work
- Six voice choices work with explicit provider state
- Expressive tone mapping works without hidden fallback
- Evolution is visible, explainable, age-capped, and idempotent
- No duplicate evolution events
- Streaming chat remains functional
- No repetitive generic compliment regression
- No fake network delays or fake typing state
- Reduced motion and reduced transparency work
- Native microphone and recovery flows pass
- iOS and Android no-credit exports pass
- Four consecutive certification passes complete
- Rollback manifest is verified
- EAS build count remains zero until separately authorized
- TestFlight upload count remains zero until separately authorized

## 17. Rollback Plan

- Keep TestFlight `1.0.0 (4)` untouched.
- Keep the current Vercel production deployment available for immediate rollback.
- Keep Version 10 database changes additive and readable by Version 9.
- Preserve legacy appearance and voice fields.
- Preserve previous Edge Function source and deployment versions.
- Capture pre-edit appearance snapshots.
- Tag or record the final pre-Version-10 main SHA before merge.
- Do not remove compatibility writes until a later separately designed release.

## 18. Out of Scope

The following are intentionally excluded from Build 5 / Version 10.0:

- External avatar marketplace integration
- Paid avatar SDK dependency
- Real-money cosmetic economy
- Loot boxes, coins, streak guilt, or furniture pressure
- Public App Store release
- Automatic TestFlight upload
- New social network features
- Replacing the conversation model
- Destructive database normalization
- Broad unrelated refactoring

## 19. Success Definition

Build 5 / Version 10.0 succeeds when a new user can create an original companion through a cinematic origin, identity, appearance, and voice flow; an existing user can expand the same companion without losing any history; the companion visibly and explainably evolves through real relationship progress; and the entire experience remains safe, reversible, accessible, performant, and compatible with the current production system.