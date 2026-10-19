#!/bin/sh
# Entry point for the all-in-one Render image.
#
# Two processes share this container because a free hosting tier allows one web service:
#
#   • the GenAI Hub, on an internal port, providing exam generation and the real Python AST parser
#   • the API Gateway, on $PORT, which Render exposes publicly and which also serves the frontend
#
# The gateway must not be delayed waiting for the hub: it degrades to its offline engine when the
# hub is unreachable, so a slow hub would only make the first exam generation fall back. The hub
# is therefore started in the background and the gateway immediately.
#
# `exec` on the final command is deliberate. Without it the shell would stay as PID 1, Render's
# stop signal would reach the shell instead of Node, and the container would be killed on
# timeout rather than shutting down cleanly.

set -e

HUB_PORT="${HUB_PORT:-3001}"
export GENAI_HUB_URL="${GENAI_HUB_URL:-http://127.0.0.1:${HUB_PORT}}"

echo "================================================================"
echo " AITA all-in-one container"
echo "   public port    : ${PORT:-3000}  (gateway + frontend)"
echo "   internal hub   : ${HUB_PORT}    (exam generation, AST parser)"
echo "   hub URL        : ${GENAI_HUB_URL}"
echo "================================================================"

# ── GenAI Hub (background) ──────────────────────────────────────────────────
if [ -f /app/hub/dist/src/server.js ]; then
  PORT="${HUB_PORT}" node /app/hub/dist/src/server.js &
  HUB_PID=$!
  echo "[start] GenAI Hub started (pid ${HUB_PID})"
else
  echo "[start] WARNING: hub bundle missing at /app/hub/dist/src/server.js"
  echo "[start] exam generation will use the offline engine"
fi

# ── Demo accounts (opt-in) ──────────────────────────────────────────────────
# The built-in seed ships a placeholder password hash so no seeded account can sign in. That is
# correct for production and unhelpful for a demo, so usable accounts are written here when
# SEED_DEMO_ACCOUNTS=true. The hashes use the same scrypt scheme the auth service verifies with,
# so login goes through the normal path — there is no bypass branch.
if [ "${SEED_DEMO_ACCOUNTS}" = "true" ]; then
  if [ -f /app/dist/scripts/seed-demo-accounts.js ]; then
    echo "[start] seeding demo accounts (SEED_DEMO_ACCOUNTS=true)"
    node /app/dist/scripts/seed-demo-accounts.js || echo "[start] WARNING: demo seeding failed"
  else
    echo "[start] WARNING: seed script missing; demo accounts will not be usable"
  fi
else
  echo "[start] demo accounts not seeded (set SEED_DEMO_ACCOUNTS=true to enable)"
fi

# ── API Gateway (foreground) ────────────────────────────────────────────────
# The frontend bundle makes same-origin requests, so no API URL needs to be configured here.
exec node /app/dist/main.js
