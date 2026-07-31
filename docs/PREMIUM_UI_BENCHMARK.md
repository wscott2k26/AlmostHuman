# Almost Human premium UI benchmark

This document records the product patterns studied before the version 6 visual pass. It is a design benchmark, not a request to copy another product. Almost Human keeps its own brand, developmental premise, component shapes, art direction, navigation structure, and motion language.

## Products reviewed

### Replika

Strong patterns:

- An always-visible visual companion creates presence before the first word.
- Avatar customization, rooms, calls, memories, and proactive moments make the relationship feel broader than a chat screen.
- A simple conversation surface keeps the primary action obvious.

Patterns deliberately avoided:

- Currency-heavy HUD elements, streak pressure, and engagement guilt.
- Treating appearance purchases as the center of development.
- Excessive 3D animation that competes with reading.

### Kindroid

Strong patterns:

- Large companion portrait and strong visual identity.
- Deep backstory, memory, voice, and generated-media controls.
- High perceived customization and expressive conversation tools.

Patterns deliberately avoided:

- Front-loading a fully formed personality.
- Dense configuration screens before the relationship begins.
- Repetition and memory failures reported by reviewers.

### Nomi

Strong patterns:

- Low-friction onboarding and an immediate feeling of personal connection.
- Short- and long-term memory presented as the product core.
- Voice, images, group interactions, and shared notes add continuity.
- Users praise fun backstories, generated pictures, and memory across months.

Patterns deliberately avoided:

- Photorealism as the default identity.
- Romance-first framing for the initial release.
- Sudden message limits that interrupt an active emotional conversation.

### Character.AI

Strong patterns:

- Familiar messaging conventions and a low learning curve.
- Seamless movement between text and voice.
- Strong creative-play framing.

Patterns deliberately avoided:

- Discovery-feed clutter in the primary companion journey.
- Ads or waiting-room experiences inside a conversation.
- A marketplace of unrelated characters competing with the one being raised.

## Review themes that matter most

Across the strongest user reviews, the repeatedly praised qualities were:

1. Conversation realism and personality depth.
2. Accurate long-term memory.
3. Voice that feels expressive rather than robotic.
4. Visual identity and customization.
5. Generated keepsakes such as images, stories, and journals.
6. Easy controls for backstory, memories, and conversation recovery.

The most common complaints were:

1. Forgotten facts and broken continuity.
2. Repeated phrases or questions.
3. Conversation resets that destroy the character.
4. Paywalls or limits interrupting a meaningful session.
5. Overly animated, cluttered, or game-like interfaces.
6. Safety or policy changes that feel unexplained.

Almost Human treats those complaints as engineering requirements, not cosmetic feedback.

## Version 6 visual system

### Core experience

- A cinematic “living portrait” home hero makes the companion present without copying a human face.
- The avatar remains an original procedural light-form that matures by stage.
- Home shows age, bond, memories, mood, today’s moment, and growth progress without game currency.
- Chat remains the fastest path and uses familiar message behavior.
- Grow, Memories, and World use editorial cards instead of dashboard widgets.

### Materials and depth

- Glass is reserved for navigation, transient controls, and overlays.
- Content cards use more opaque surfaces for legibility.
- Soft spectral lighting and restrained grain create depth without image assets.
- The active navigation state uses a distinct capsule and light pip.

### Motion

- Motion tokens separate fast feedback, standard transitions, and slow ambient movement.
- Page, message, modal, avatar, and button motion each communicate a specific state.
- `prefers-reduced-motion` removes orbiting, breathing, drifting, pulse, and shine effects.
- `prefers-reduced-transparency` removes blur-heavy surfaces.

### Accessibility

- Primary controls use a 46px baseline; mobile navigation uses 58px rows.
- Text and icons are not distinguished by color alone.
- Focus rings remain visible.
- High-contrast mode strengthens surfaces and labels.
- Hover-only actions remain visible on touch devices.

## Originality guardrails

Do not import screenshots, avatars, icons, copy, product names, animations, paywall layouts, or proprietary art from another app. Any future visual reference must be translated into a principle — presence, clarity, continuity, expressiveness, or trust — and then rebuilt using Almost Human’s own components and developmental story.
