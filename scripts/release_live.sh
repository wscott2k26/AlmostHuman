#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-onvoaskzzxozmhkzyycy}"
PRODUCTION_URL="${AH_PRODUCTION_URL:-}"

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    printf 'Missing required local environment variable: %s\n' "$name" >&2
    exit 1
  fi
}

require_var SUPABASE_ACCESS_TOKEN
require_var OPENAI_API_KEY
require_var ALLOWED_ORIGINS

if [[ "$ALLOWED_ORIGINS" != https://* ]]; then
  echo "ALLOWED_ORIGINS must begin with at least one HTTPS origin." >&2
  exit 1
fi

command -v npx >/dev/null 2>&1 || { echo "Node.js/npm is required." >&2; exit 1; }

TMP_ENV="$(mktemp)"
cleanup() { rm -f "$TMP_ENV"; }
trap cleanup EXIT
chmod 600 "$TMP_ENV"
{
  printf '%s=%s\n' 'OPENAI_API_KEY' "$OPENAI_API_KEY"
  printf '%s=%s\n' 'OPENAI_FAST_CHAT_MODEL' "${OPENAI_FAST_CHAT_MODEL:-gpt-4.1-mini}"
  printf '%s=%s\n' 'OPENAI_CHAT_MODEL' "${OPENAI_CHAT_MODEL:-gpt-5-mini}"
  printf '%s=%s\n' 'OPENAI_ACTIVITY_MODEL' "${OPENAI_ACTIVITY_MODEL:-gpt-5-mini}"
  printf '%s=%s\n' 'OPENAI_EXTRACT_MODEL' "${OPENAI_EXTRACT_MODEL:-gpt-5-mini}"
  printf '%s=%s\n' 'OPENAI_TTS_MODEL' "${OPENAI_TTS_MODEL:-gpt-4o-mini-tts}"
  printf '%s=%s\n' 'ALLOWED_ORIGINS' "$ALLOWED_ORIGINS"
} > "$TMP_ENV"

echo "1/7 Linking Supabase project..."
npx --yes supabase@latest link --project-ref "$PROJECT_REF"

echo "2/7 Checking migration plan..."
DB_ARGS=(--linked --dry-run)
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then DB_ARGS+=(--password "$SUPABASE_DB_PASSWORD"); fi
npx --yes supabase@latest db push "${DB_ARGS[@]}"

echo "3/7 Applying database migrations..."
DB_ARGS=(--linked)
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then DB_ARGS+=(--password "$SUPABASE_DB_PASSWORD"); fi
npx --yes supabase@latest db push "${DB_ARGS[@]}"

echo "4/7 Uploading Edge Function secrets without printing them..."
npx --yes supabase@latest secrets set --project-ref "$PROJECT_REF" --env-file "$TMP_ENV"

echo "5/7 Deploying all Edge Functions..."
npx --yes supabase@latest functions deploy --project-ref "$PROJECT_REF" --use-api

echo "6/7 Confirming deployed functions and secrets..."
npx --yes supabase@latest functions list --project-ref "$PROJECT_REF"
npx --yes supabase@latest secrets list --project-ref "$PROJECT_REF"

echo "7/7 Running public live health gate..."
npm run verify:live

if [[ -n "$PRODUCTION_URL" ]]; then
  printf '\nProduction URL supplied: %s\n' "$PRODUCTION_URL"
  echo "Confirm this exact URL is set as Supabase Auth Site URL and appears in Redirect URLs."
else
  echo "AH_PRODUCTION_URL was not supplied; Auth Site URL still requires an account-side confirmation."
fi

echo
printf '%s\n' \
  "Almost Human live backend release completed." \
  "Next release gate: run the two-account isolation test three times and real-device testing."
