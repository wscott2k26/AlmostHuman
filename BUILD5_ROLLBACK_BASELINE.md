# Almost Human Build 5 / Version 10.0 Rollback Baseline

Recorded: 2026-08-01

## Immutable production baseline

- Repository: `wscott2k26/AlmostHuman`
- Main SHA at branch creation: `d63d6e4e86f803de727eda79db362451ecd38e17`
- Development branch: `feature/build-5-version-10`
- Production Vercel project: `almost-human`
- Production deployment: `dpl_JCVTgEzyXbar4SnFegsBxTcfX3Gp`
- Production domain: `https://almost-human-swart.vercel.app`
- Production state when recorded: `READY`
- Supabase project: `onvoaskzzxozmhkzyycy`
- Supabase state when recorded: `ACTIVE_HEALTHY`

## Active Edge Function versions

- `health`: 6
- `chat-service`: 8
- `activity-service`: 7
- `memory-extract`: 7
- `memory-control`: 6
- `privacy-service`: 5
- `conversation-reset`: 6
- `progress-aging`: 5
- `diagnostics-service`: 6
- `voice-service`: 9
- `letter-service`: 6
- `transcription-service`: 1
- `chat-stream`: 1

## Locked mobile identity

- iOS bundle identifier: `com.stormandme.almosthuman`
- Android package: `com.stormandme.almosthuman`
- Apple app ID: `6796814542`
- EAS project ID: `cd0be7bb-e65a-454e-b255-3b261de060ee`
- Existing TestFlight version/build: `1.0.0 (4)`
- Signed iOS build ID: `9af3b9e9-eec0-473a-a59e-12fdeff56e42`
- Apple processing state: `VALID`
- Internal TestFlight state: `IN_BETA_TESTING`

## Build 5 authorization counters

- EAS builds authorized: **0**
- EAS builds run: **0**
- TestFlight uploads authorized: **0**
- TestFlight uploads run: **0**
- App Store releases authorized: **0**
- App Store releases run: **0**

## Rollback rule

Build 5 database work must remain additive and Version 9-readable. The production Vercel deployment, prior Edge Function versions, current production data, and TestFlight build 4 remain untouched until separate release gates are satisfied.
