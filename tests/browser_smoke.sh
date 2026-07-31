#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${AH_TEST_PORT:-4173}"
LOG="/tmp/almost-human-browser-server.log"
node "$ROOT/scripts/serve.mjs" --source "$ROOT/dist" --port "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT
for _ in {1..30}; do
  curl -fsS "http://127.0.0.1:$PORT/" >/tmp/ah-index.html 2>/dev/null && break
  sleep .2
done
curl -fsS "http://127.0.0.1:$PORT/app.js" >/tmp/ah-app.js
curl -fsS "http://127.0.0.1:$PORT/styles.css" >/tmp/ah-styles.css
curl -fsS "http://127.0.0.1:$PORT/manifest.webmanifest" >/tmp/ah-manifest.json

grep -q '<title>Almost Human</title>' /tmp/ah-index.html
grep -q 'Digital birth sequence' /tmp/ah-app.js
grep -q 'AlmostHumanEngine' /tmp/ah-app.js
grep -q 'Continue as Guest' /tmp/ah-app.js
grep -q 'Almost Human' /tmp/ah-manifest.json
grep -q 'mobile-tabs' /tmp/ah-styles.css
grep -q 'being-face' /tmp/ah-styles.css

echo "Browser delivery smoke passed."
