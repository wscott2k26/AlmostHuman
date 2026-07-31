# Supabase deployment — exact sequence

This guide performs only account-side actions. Never paste a database password, service-role key, OpenAI key, OAuth secret, or store credential into the browser application or a chat.

## 1. Apply the database migration

In the Almost Human Supabase dashboard:

1. Open **SQL Editor**.
2. Create a new query.
3. Paste the entire contents of `supabase/migrations/202607290001_almost_human_core.sql`.
4. Run it once.
5. Confirm the query ends with `Success. No rows returned` or an equivalent successful result.

The migration is designed to be repeat-safe. It creates the schema, triggers, policies, storage bucket, and RPCs inside one transaction.

## 2. Configure Edge Function secrets

Under **Edge Functions → Secrets**, add:

- `OPENAI_API_KEY`
- `OPENAI_FAST_CHAT_MODEL` = `gpt-4.1-mini` (recommended early-stage latency route)
- `OPENAI_CHAT_MODEL` = `gpt-5-mini` (older-stage/default quality route)
- `OPENAI_ACTIVITY_MODEL` = `gpt-5-mini` (optional override)
- `OPENAI_EXTRACT_MODEL` = `gpt-5-mini` (optional override)
- `OPENAI_TTS_MODEL` = `gpt-4o-mini-tts` (optional override)
- `ALLOWED_ORIGINS` = a comma-separated list containing the final HTTPS domain and local test origins

Hosted Supabase Functions automatically receive `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

## 3. Deploy functions

Deploy these folders:

- `chat-service`
- `activity-service`
- `memory-extract`
- `memory-control`
- `privacy-service`
- `conversation-reset`
- `progress-aging`
- `diagnostics-service`
- `voice-service`
- `letter-service`
- `health`

`_shared` is imported by the functions and is not deployed as a standalone endpoint.

With the Supabase CLI on the owner’s computer:

```bash
supabase login
supabase link --project-ref onvoaskzzxozmhkzyycy
supabase db push
supabase functions deploy chat-service
supabase functions deploy activity-service
supabase functions deploy memory-extract
supabase functions deploy memory-control
supabase functions deploy privacy-service
supabase functions deploy conversation-reset
supabase functions deploy progress-aging
supabase functions deploy diagnostics-service
supabase functions deploy voice-service
supabase functions deploy letter-service
supabase functions deploy health --no-verify-jwt
```

The SQL Editor route can be used instead of `supabase db push`; do not do both simultaneously.

## 4. Configure authentication URLs

Under **Authentication → URL Configuration**:

- Set **Site URL** to the final production HTTPS origin.
- Add the exact production origin and local `http://127.0.0.1:4173` / `http://localhost:4173` callback URLs.
- Keep email confirmation enabled for production.

Enable Google or Apple only after their OAuth client secrets are stored in Supabase’s provider settings.

## 5. Live two-account isolation test

Use two unrelated test emails in separate private browser sessions.

1. Create Account A, awaken an AI, send a message, add a memory, and create a letter.
2. Copy Account A’s AI, conversation, message, memory, and letter UUIDs from its own authenticated network responses.
3. Sign in as Account B.
4. Attempt direct `GET`, `PATCH`, and `DELETE` requests for each Account A UUID using Account B’s access token.
5. Confirm every request returns no record or an authorization/not-found response.
6. Attempt to create a message, memory, fact conflict, letter, or admin event that references Account A’s UUIDs.
7. Confirm the ownership triggers reject every write.
8. Confirm Account B cannot write to `subscriptions`.
9. Export Account B and confirm it contains only Account B data.
10. Delete Account B app data, then delete Account B’s cloud account and confirm sign-in no longer works.

Do not open public beta access until this complete sequence passes three times.

## 6. Health check

Open the app, sign in, then choose **Settings → Check services**. A launch-ready cloud reports:

- database: ready
- schema: ready
- AI: ready
- voice: ready
- account deletion: configured

A failure here is a release blocker, not something to hide with a local success message.
