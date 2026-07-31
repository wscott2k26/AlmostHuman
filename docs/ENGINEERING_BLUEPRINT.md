# Almost Human — Engineering Blueprint

## Product invariant
Almost Human is a developmental AI relationship simulator, not a generic assistant with an age label. Every response must be constrained by developmental stage, grounded in owned memories, checked for repetition, and safe from manipulative attachment behavior.

## Runtime flow
1. Authenticate user and verify ownership of the AI entity and conversation.
2. Calculate simulated age and stage from birthday.
3. Apply idempotency using a client-generated `request_id`.
4. Persist the user message once.
5. Route crisis/confusion/reset cases through deterministic safety paths.
6. Retrieve recent conversation, selected memories, and verified user facts.
7. Build a modular stage-aware prompt.
8. Generate, repetition-check, regenerate when necessary, and safety-filter.
9. Persist the AI response with the same `request_id`.
10. Update personality, relationship state, milestones, and asynchronous memory extraction.

## Data ownership
Every user-owned entity uses row-level rules keyed to `created_by_id`. Server functions must additionally validate ownership and parent-child relationships before reading or writing IDs supplied by the client.

## Required release gates
- No duplicate messages under double tap, timeout, retry, or refresh.
- No repeated birthday or stage milestone.
- No cross-user entity access.
- No stage-inappropriate language.
- No fake memories or low-confidence claims stated as facts.
- No manipulative dependency language.
- Privacy export and deletion flows verified on real accounts.
- AI, voice, billing, and storage secrets remain server-side.

## Production work still requiring connected credentials
OpenAI-compatible model key, voice provider, Apple/Google sign-in configuration, billing provider, analytics/error monitoring, and mobile signing credentials.
