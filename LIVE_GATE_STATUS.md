# Almost Human 8.1 live gate

## Completed in the package

- complete companion-first interface across every primary route
- repaired guest and email authentication experience
- Google, Apple, and Facebook provider entry controls
- premium cloud voice preview and playback
- bounded early-stage AI latency path
- secure Supabase database, RLS, functions, restore, export, and deletion
- production Vercel build and service-worker cache version
- three consecutive full verification cycles

## Owner-session deployment

The installer uses the owner’s existing Supabase and Vercel CLI sessions to:

1. create a rollback backup
2. install the complete 8.1 source
3. preserve the linked project files and public Supabase configuration
4. run the full production gate
5. set non-secret model routing values
6. deploy all Supabase Edge Functions
7. deploy Vercel production
8. verify the stable production URL and V8.1 asset markers

Private provider credentials, store signing, billing, and SMTP configuration are not embedded in the package.
