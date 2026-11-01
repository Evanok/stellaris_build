#!/bin/bash
# Fetches a fresh, consistent snapshot of the production app database and
# installs it locally, so the local dev server can be tested against real data.
#
# This script never hardcodes the server address (repo is public): it uses PROD_HOST,
# or else DEPLOY_HOST from deploy/.env (gitignored, the deploy kit's host file).
#
# Only stellaris_builds.db is fetched - never sessions.db, which holds live
# session tokens for real users and has no value for local testing.
#
# WARNING: the fetched file contains real user data (emails, password hashes,
# OAuth ids, feedback). It's already covered by .gitignore's *.db rule, but
# never commit or share it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "${PROD_HOST:-}" ] && [ -f "$SCRIPT_DIR/../deploy/.env" ]; then
  PROD_HOST="$(sed -n 's/^DEPLOY_HOST=//p' "$SCRIPT_DIR/../deploy/.env")"
fi
if [ -z "${PROD_HOST:-}" ]; then
  echo "Error: no host. Set PROD_HOST=user@host, or DEPLOY_HOST in deploy/.env" >&2
  exit 1
fi
# Live database since the deploy kit migration (2026-11-01); ~/work/stellaris_build is a stale copy.
PROD_DB="~/apps/stellaris_build/shared/backend/db/stellaris_builds.db"
LOCAL_DB="$SCRIPT_DIR/../backend/stellaris_builds.db"
REMOTE_TMP="/tmp/stellaris_builds_fetch_$$.db"
LOCAL_TMP="$(mktemp)"

echo "Creating a consistent snapshot of the prod DB on $PROD_HOST ..."
# sqlite3's .backup is the Online Backup API - safe to run against a live,
# actively-written database (WAL or not), always yields a consistent copy.
ssh "$PROD_HOST" "sqlite3 $PROD_DB \".backup '$REMOTE_TMP'\" && chmod 600 '$REMOTE_TMP'"

echo "Downloading snapshot ..."
scp "$PROD_HOST:$REMOTE_TMP" "$LOCAL_TMP"
ssh "$PROD_HOST" "rm -f '$REMOTE_TMP'"

if [ -f "$LOCAL_DB" ]; then
  BACKUP_PATH="$SCRIPT_DIR/../backend/stellaris_builds.local-backup-$(date +%Y%m%d_%H%M%S).db"
  echo "Backing up current local DB to $BACKUP_PATH ..."
  mv "$LOCAL_DB" "$BACKUP_PATH"
fi

# Remove stale WAL sidecar files - they belong to the previous local DB's page
# structure, not the one we just fetched, and shouldn't be replayed against it.
rm -f "$LOCAL_DB-wal" "$LOCAL_DB-shm"

mv "$LOCAL_TMP" "$LOCAL_DB"

echo ""
echo "Done. Prod snapshot installed at $LOCAL_DB"
echo "Nodemon only watches .js files, so it won't auto-restart for this - restart your local backend manually to pick it up."
