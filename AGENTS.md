# Almost Human engineering rules

This repository contains user-owned application code for a privacy-sensitive AI companion. Preserve the product’s developmental model, local-first behavior, and strict user ownership boundaries.

## Architecture

- `app/`: dependency-free PWA and deterministic local engine
- `supabase/migrations/`: PostgreSQL schema, Row Level Security, ownership triggers, storage policies, and RPCs
- `supabase/functions/`: authenticated Edge Functions and shared developmental services
- `tests/`: engine, cloud-adapter, integrity, type, build, and browser tests
- `dist/`: generated production web build; do not edit by hand

## Non-negotiable rules

- Never place OpenAI, service-role, database, billing, signing, or OAuth client secrets in browser files.
- All user-owned database tables must have Row Level Security and owner checks.
- Any foreign key joining life-history records must remain within the same user and AI boundary.
- Subscription entitlements are server-managed and read-only to normal clients.
- AI responses must pass developmental, safety, and anti-repetition checks before display.
- Request IDs must make chat and activity retries idempotent.
- The app must remain usable in local mode when cloud services fail.
- Do not claim a live provider, payment, voice, or store workflow passed unless it was tested against that real service.

## Required verification

Run `npm run test:all` after meaningful changes. Run `npm run test:triple` before handing off a release package. Do not weaken tests merely to make a build pass.
