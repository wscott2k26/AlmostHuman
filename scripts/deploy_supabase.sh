#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-onvoaskzzxozmhkzyycy}"
FUNCTIONS=(
  chat-service
  activity-service
  memory-extract
  memory-control
  privacy-service
  conversation-reset
  progress-aging
  diagnostics-service
  voice-service
  letter-service
)

command -v npx >/dev/null 2>&1 || { echo "Node.js/npm is required." >&2; exit 1; }

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Supabase login is required. A browser window may open."
  npx --yes supabase@latest login
fi

npx --yes supabase@latest link --project-ref "$PROJECT_REF"

if [[ "${AH_SKIP_DB_PUSH:-0}" != "1" ]]; then
  echo "Applying database migrations..."
  npx --yes supabase@latest db push
else
  echo "Skipping db push because AH_SKIP_DB_PUSH=1."
fi

for function_name in "${FUNCTIONS[@]}"; do
  echo "Deploying $function_name..."
  npx --yes supabase@latest functions deploy "$function_name" --project-ref "$PROJECT_REF"
done

npx --yes supabase@latest functions deploy health --project-ref "$PROJECT_REF" --no-verify-jwt

echo
printf '%s\n' \
  "Supabase code deployment finished." \
  "Next: add OPENAI_API_KEY and ALLOWED_ORIGINS in Supabase Edge Function secrets," \
  "then run: npm run verify:live"
