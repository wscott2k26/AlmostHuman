# Almost Human 8.3 — Quadruple Certification

Generated: 2026-07-31

## Certified product source

- Version: `8.3.0`
- Product identity: **Almost Human — The Haven**
- Native app version: `1.0.0`
- Expo SDK: `54.0.36`
- iOS bundle identifier: `com.stormandme.almosthuman`
- Expo owner: `wscott2k26`

## Four consecutive complete web/cloud/security gates

Every pass completed all of the following with no failure:

- Source lint: **56 files passed**
- Supabase Edge Function TypeScript: **passed**
- Engine/cloud adapter tests: **30 passed, 0 failed**
- Security/product integrity: **224 passed, 0 failed**
- Production web build: **passed**
- Browser-delivery smoke: **passed**

Four-pass totals:

- **224 linted file passes**
- **120 engine/cloud tests passed**
- **896 security/product integrity checks passed**
- **4 Edge TypeScript passes**
- **4 production builds passed**
- **4 browser-delivery passes**

## Four consecutive Step 7 mobile preflights

Every mobile preflight completed **75 checks, 0 failed**. Four-pass total: **300 mobile release checks passed**.

The mobile gate verifies:

- Expo/React/React Native/WebView dependency alignment
- App owner, slug, scheme, bundle IDs, version, and build profile
- Offline HTML and generated TypeScript bundle are byte-for-byte identical
- Native safe area, first-light loader, recovery, haptics, share, deep links, and pull-to-refresh
- Optional local Haven notification and notification-tap routing
- The Haven content, stage/mood atmosphere, inspectable keepsakes, and native bridge
- 1024px app/adaptive/splash assets and 96px monochrome notification asset
- No placeholder tokens, TODO/FIXME text, service-role secret, OpenAI secret, or embedded secret-shaped key

## Credit boundary

- Almost Human EAS builds used during this certification: **0**
- The source contains one protected manual workflow that requires `BUILD_ONCE` before starting a production iOS build.
- A second workflow submits that existing build after the real App Store Connect numeric ID is known; it does not create another build.

## Truth boundary

The source and release workflows are certified. A signed Almost Human iOS build and TestFlight upload are not yet claimed. Those require the canonical GitHub repository, its protected `EXPO_TOKEN`, EAS project creation, Apple credentials, and App Store Connect record.
