# Almost Human 8.3 — The Haven

**Don’t just talk to AI. Raise one.**

Almost Human is a premium, local-first AI growth experience. A new intelligence begins with tightly limited language and develops through newborn, infant, toddler, child, preteen, teen, young-adult, and adult stages. Its memories, interests, The Haven, milestones, personality, and abilities evolve through real interaction rather than a personality preset.

## What is implemented

- Installable offline-first PWA with a premium mobile interface
- Developmental language and capability limits by simulated age
- Persistent local history in IndexedDB with readable JSON import/export
- Secure Supabase Auth, PostgreSQL, Storage, Row Level Security, and Edge Functions
- Server-side OpenAI Responses API integration with deterministic fallback
- Episodic, semantic, emotional, relationship, skill, and core memories
- Memory correction, hiding, deletion, conflict handling, and export
- Exact and semantic repetition protection, question-loop recovery, and request idempotency
- Birthdays, stage graduations, milestones, activities, letters, The Haven home growth, and voice output
- User-owned data isolation, cross-reference ownership guards, subscription write protection, and account deletion
- Automated engine, adapter, integrity, type, build, and browser-delivery tests
- Original companion-first version 8.3 interface with illustrated presence, cinematic birth, and complete warm interior pages

## Run locally

Requirements: Node.js 20 or newer. There are no runtime npm dependencies.

```bash
npm run dev
```

Open `http://127.0.0.1:4173`. The app remains usable in private on-device mode even before the cloud functions are deployed.

## Verify everything

```bash
npm run test:all
npm run test:quadruple
```

`test:all` performs source linting, Edge Function TypeScript checking, JavaScript engine and cloud-adapter tests, security/integrity validation, a production build, and a browser-delivery smoke test.

## Native TestFlight source

The `mobile/` directory contains the Expo SDK 54 Step 7 shell. It bundles the complete web experience for offline launch and adds native safe areas, haptics, sharing, deep links, optional local reminders, and crash recovery. The GitHub workflows under `.github/workflows/` deliberately separate the one paid iOS build from submission of that existing build. See `docs/V8.3_HAVEN_MOBILE_RELEASE.md`.

## Supabase production setup

The public project URL, project reference, and publishable key are already configured in `app/config.js`. Those values are intentionally safe for a browser when Row Level Security is enabled.

Complete the account-side deployment in this order:

1. Open the Supabase SQL Editor for the dedicated Almost Human project.
2. Run `supabase/migrations/202607290001_almost_human_core.sql`.
3. Add `OPENAI_API_KEY` and `ALLOWED_ORIGINS` under Edge Function secrets. Never put either secret in frontend code.
4. Deploy every folder under `supabase/functions/` except `_shared`.
5. Add the production site URL and callback URLs under Supabase Auth URL Configuration.
6. Run the two-account isolation test described in `docs/DEPLOY_SUPABASE.md`.

Supabase automatically provides hosted Edge Functions with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Do not copy the service-role value into `app/config.js` or a chat message.

## One-command live backend release

After authenticating locally and setting private values only in your terminal environment:

```bash
SUPABASE_ACCESS_TOKEN="..." \
OPENAI_API_KEY="..." \
ALLOWED_ORIGINS="https://your-domain.example,http://127.0.0.1:4173" \
AH_PRODUCTION_URL="https://your-domain.example" \
npm run release:live
```

The script performs a migration dry run, applies migrations, uploads secrets through a temporary permission-restricted file, deploys all Edge Functions, lists the deployed resources, and runs the live health gate. It never prints the secret values.

## Build and deploy the web app

```bash
npm run build
```

The deployable site is written to `dist/`. `vercel.json` is included for a no-repository Vercel CLI deployment.

```bash
npx vercel login
npx vercel link
npx vercel --prod
```

Choose the existing Vercel project named `almost-human` when linking.

## Important boundaries

- Store billing is not faked. The current build clearly labels billing as a founder preview until Apple, Google Play, or another verified billing provider is connected.
- A signed iOS/Android store binary still requires the owner’s Apple/Google/Expo credentials.
- No private provider key is included in this archive.
- Passing local tests does not replace live two-account, real-device, provider, and store-purchase testing.

See `RELEASE_STATUS.md` for the exact launch state, `docs/ENGINEERING_BLUEPRINT.md` for the architecture, and `docs/PREMIUM_UI_BENCHMARK.md` for the visual-product benchmark.
