#!/usr/bin/env bash
# Deploy from the dev machine: ./deploy.sh [deploy|status|rollback]
# Settings: deploy/deploy.conf (+ deploy/.env for the server). Process: ~/work/deploy_kit.
# Rehearsal: DEPLOY_CONF=deploy/staging.conf ./deploy.sh
exec "${DEPLOY_KIT:-$HOME/work/deploy_kit}/deploy.sh" "$(dirname "$0")" "$@"
