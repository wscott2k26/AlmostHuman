ALMOST HUMAN 7.0 — BIG LEAGUES REBUILD
======================================

This package is a complete overlay upgrade for the existing linked
almost-human-supabase project. It does not use GitHub.

Recommended action:

1. Download this ZIP and INSTALL-ALMOST-HUMAN-V7.ps1 into Downloads.
2. Open PowerShell in the existing almost-human-supabase project folder.
3. Run:

   powershell -ExecutionPolicy Bypass -File "$HOME\Downloads\INSTALL-ALMOST-HUMAN-V7.ps1"

The installer:
- validates the package checksum
- verifies the linked Supabase and Vercel project state
- creates a timestamped rollback backup
- overlays the version 7 files
- installs the TypeScript test dependency when needed
- runs the complete verification suite
- sets OPENAI_FAST_CHAT_MODEL=gpt-4.1-mini
- deploys chat, activity, memory extraction, and voice functions
- deploys the production web app to the already-linked Vercel project

The installer never asks for an OpenAI key and does not print existing secrets.
Your existing Supabase login, project link, Vercel link, and stored secrets are reused.

After the green success line, open a fresh Incognito window at:
https://almost-human-swart.vercel.app/?v=7

See docs/V7_PRODUCT_RESEARCH.md and docs/V7_RELEASE_NOTES.md.
