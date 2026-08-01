# Almost Human 9.0 certification

## Certified scope

Almost Human 9.0 web, backend, database migrations, streamed conversation, neural voice, secure transcription, user-data preservation, and the Expo native source and export pipeline are certified from source commit `19f53e6581db2b3afc65b5d91d53e05e46418c15`.

## Verification evidence

- Four complete web, backend, and security passes completed from one source revision.
- Expo Doctor, TypeScript, lint, four native preflights, iOS export, and Android export completed without EAS.
- Production deployment `dpl_JCVTgEzyXbar4SnFegsBxTcfX3Gp` is READY at `https://almost-human-swart.vercel.app`.
- Production content hash `07db3f766057641e56682919f4b05bb1c16b080e766e05c79fab09a31928a87e` matches the certified web build.
- Twenty streamed text turns completed: median first delta 1,104 ms, p95 first delta 2,159 ms, median final text 1,278 ms, and p95 final text 2,337 ms.
- Ten neural voice turns completed: median completed and first audio 1,608 ms, p95 2,032 ms.
- Final authenticated neural voice verification returned HTTP 200 in 1,923 ms.
- Secure transcription returned HTTP 200 with a non-empty result in 1,441 ms. Transcript text and audio were not stored in release receipts.
- Exact production-origin CORS, unauthenticated JWT rejection, request-ID replay protection, account deletion, and the no-canned-vocal-praise guard passed.

## Conversation-quality rule

Deterministic newborn and infant fallbacks no longer say that the user's voice is warm, gentle, safe, familiar, or that it came back. Vocal comments are limited to genuinely relevant voice or audio context and are protected by repetition checks.

## Provider state

OpenAI is the active text, neural voice, and transcription provider. ElevenLabs remains an explicit optional configuration and is not silently replaced by device speech. Device system speech is only an explicit one-time fallback when neural audio fails.

## Native boundary

Native 9.0 source and offline exports are certified, but real-device behavior cannot be claimed until a future signed iOS build. Existing TestFlight build 3 remains unchanged. A paid iOS build and a TestFlight upload each require separate explicit authorization.

## Known limitations

- ElevenLabs is not configured; OpenAI is the active secure neural voice provider.
- Neural speech is returned as a complete MP3, so measured first-audio timing equals completed-audio timing.
- Real-device validation of the native shell and interruption timing requires a future signed iOS build.
- Supabase leaked-password protection remains a dashboard configuration item.
- The authenticated `SECURITY DEFINER` `is_admin` helper remains executable because ownership RLS policies call it.
- Anonymous Supabase sessions intentionally use ownership-scoped authenticated-role RLS and therefore appear in the advisor anonymous-access warning group.

## Release boundary

- EAS builds run for 9.0: **0**
- TestFlight uploads run for 9.0: **0**
- Ready to request authorization for one paid iOS build: **yes**
