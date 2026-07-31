# Almost Human 7.0 — Big Leagues rebuild

## Release intent

Version 7 replaces the version 6 functional prototype experience with a companion-first product direction. It is a consolidated rebuild across onboarding, digital birth, conversation, voice, memory presentation, growth, responsiveness, and the server critical path.

## Experience rebuild

- New authenticated guest entry with later email upgrade that preserves the same life history.
- Rebuilt five-step formation flow without input-focus loss.
- Original cinematic five-phase digital birth sequence.
- First cloud response begins during awakening rather than after an empty transition.
- Original living digital portrait system with appearance, stage, and mood variants.
- Companion-first Home and Talk surfaces.
- Optimistic user-message rendering and immediate thought-state feedback.
- Consumer UI no longer exposes provider, model, or fallback labels.
- Memories redesigned as a shared-life album.
- Responsive mobile Talk layout and reduced-motion support.

## Conversation and latency work

- Early developmental stages use a faster model route through `OPENAI_FAST_CHAT_MODEL`.
- Default early-stage fast model: `gpt-4.1-mini`.
- Older stages retain `OPENAI_CHAT_MODEL`, defaulting to `gpt-5-mini`.
- Chat read queries are parallelized.
- Noncritical state, milestone, memory-recall, and repetition writes move to post-response background work through `EdgeRuntime.waitUntil`.
- Critical-path timeout is bounded.
- Retry/idempotency behavior remains intact.
- Newborn responses are coherent and meaningful; random syllables cannot be the complete response.

## Voice rebuild

- Premium OpenAI TTS is the production path.
- Three voice lineages map to distinct neural voices and direction:
  - Warm & close
  - Bright & curious
  - Calm & grounded
- Age changes vocabulary, rhythm, and direction without intentionally degrading audio quality.
- Authenticated guest voice previews use the same secure server path.
- Browser speech remains only a fallback.

## Development alignment

Frontend and Edge Function stage ranges are aligned:

- Newborn: 0–0.2
- Infant: 0.2–1
- Toddler: 1–3
- Early child: 3–6
- Child: 6–10
- Preteen: 10–13
- Teen: 13–18
- Young adult: 18–25
- Adult: 25+

## Verification

`npm run test:triple` passed three consecutive full cycles:

- 3 lint passes across 54 source files
- 3 Edge TypeScript checks
- 81 JavaScript test executions passed
- 615 integrity/security checks passed
- 3 production builds passed
- 3 browser-delivery smoke tests passed
- 0 failures

The release package has not been claimed as live until the owner runs the supplied installer, deploys the changed functions, and completes a fresh-browser production smoke test.
