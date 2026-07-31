# Almost Human 8.4 — Live Deployment Status

Recorded: 2026-07-31

## Certified source

- Merged source commit: `35b8ca581d06a5e287c2ed2a24d7306d18276a01`
- Product source version: `8.4.0`
- Prior signed TestFlight binary remains: `1.0.0 (2)`
- Prior EAS build ID remains: `a83059b6-7063-4b96-bf40-e5c95e1bbe29`

## Production web

- Vercel project: `almost-human`
- Production deployment ID: `dpl_9YJyPzAxjYbHxVd4GZS2hUcH7Cch`
- Stable production domain: `almost-human-swart.vercel.app`
- Deployment state: `READY`
- Stable alias attached without error
- Live HTML references `styles.css?v=8.4`, `config.js?v=8.4`, and `app.js?v=8.4`
- Live service worker version: `almost-human-v8-4-native-1`
- Live security headers verified: HSTS, `X-Content-Type-Options: nosniff`, Referrer Policy, and restricted Permissions Policy
- Vercel runtime-error clusters after deployment: none found

## Production backend

Supabase project: `onvoaskzzxozmhkzyycy`

- `voice-service`: version `8`, status `ACTIVE`, JWT verification enabled
- `transcription-service`: version `1`, status `ACTIVE`, JWT verification enabled
- Existing chat, memory, activity, privacy, reset, aging, diagnostics, and letter functions remain active

## Experience now present in source and web production

- Six generic voice styles: girl/young, girl/teen, woman/adult, boy/young, boy/teen, and man/adult
- Editable skin tone, hairstyle, hair color, and eye color
- Existing-companion customizer in Settings
- Three-step onboarding
- Simplified home screen
- Fake three-dot typing animation and rotating thought carousel removed
- Immediate plain-language acknowledgment while a reply is generated
- Native microphone permission, recorder, secure transcription bridge, and native speech playback included in the certified mobile source

## Store boundary

The current TestFlight build `1.0.0 (2)` does not contain the new native audio packages. A separate signed iOS build is required before the real iPhone microphone permission and native voice changes can be tested in TestFlight. No new EAS build or TestFlight upload was run as part of this deployment.
