# Start here — the remaining live setup

The code is built and locally verified. The public Supabase URL, project reference, and publishable key are already configured. No private secret belongs in the app source or in chat.

## Next action

Open the dedicated **Almost Human** project in Supabase, go to **SQL Editor**, create a new query, paste the entire file below, and run it once:

`supabase/migrations/202607290001_almost_human_core.sql`

A successful run should complete without an error. After that:

1. In **Edge Functions → Secrets**, add `OPENAI_API_KEY` and `ALLOWED_ORIGINS`.
2. On your computer, from this project folder, run `npm run deploy:supabase`.
3. Run `npm run verify:live`.
4. Perform the two-account isolation test in `docs/DEPLOY_SUPABASE.md`.

For signed-in verification, keep the test credentials local to your terminal:

```bash
AH_TEST_EMAIL="test-account@example.com" AH_TEST_PASSWORD="your-local-test-password" npm run verify:live
```

Do not paste that password into chat or save it in the project.
