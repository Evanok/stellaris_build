#!/bin/bash
# Deploys infra/nginx/stellaris-build.conf to the production server.
# This script never hardcodes the server address (repo is public) -
# pass it via PROD_HOST, e.g.:
#   PROD_HOST=user@1.2.3.4 ./infra/deploy_nginx.sh
# (see CLAUDE.local.md for the actual value)
set -euo pipefail

if [ -z "${PROD_HOST:-}" ]; then
  echo "Error: PROD_HOST is not set. Usage: PROD_HOST=user@host ./infra/deploy_nginx.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_FILE="$SCRIPT_DIR/nginx/stellaris-build.conf"

echo "Copying $CONF_FILE to $PROD_HOST:/tmp/stellaris-build.conf ..."
scp "$CONF_FILE" "$PROD_HOST:/tmp/stellaris-build.conf"

echo "Installing config and reloading nginx on $PROD_HOST ..."
# -t forces a pseudo-terminal so sudo can prompt for your password interactively
# nginx serves every site on this server: a broken file left in sites-available would
# take all of them down at the next reload/restart (certbot renewals reload nginx).
# So the previous file is kept, and put back if the new one fails `nginx -t`.
ssh -t "$PROD_HOST" '
  set -e
  live=/etc/nginx/sites-available/stellaris-build
  sudo cp "$live" "$live.previous"
  sudo cp /tmp/stellaris-build.conf "$live"
  if ! sudo nginx -t; then
    sudo cp "$live.previous" "$live"
    echo "nginx -t FAILED: previous config restored, nothing reloaded." >&2
    exit 1
  fi
  sudo systemctl reload nginx
  echo "nginx config deployed and reloaded successfully (previous one kept as $live.previous)."
'
