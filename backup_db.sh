#!/bin/bash

# Configuration
# Usage: backup_db.sh            nightly backup (crontab): 7 daily + 4 weekly (Sunday)
#        backup_db.sh predeploy  one-off copy before a deploy, own folder, last 5 kept
#                                (so a few deploys in a day never evict a nightly backup)
KIND="${1:-daily}"
DB_PATH="${STELLARIS_DB_PATH:-/home/arthur/apps/stellaris_build/shared/backend/db/stellaris_builds.db}"
BACKUP_ROOT="${STELLARIS_BACKUP_DIR:-/home/arthur/apps/stellaris_build/shared/backups}"
# Google Drive mirror of BACKUP_ROOT (rclone sync: deletes what is not local). Anything
# that is not production (a rehearsal) MUST point it elsewhere, or it wipes prod's history.
GDRIVE_DIR="${STELLARIS_GDRIVE_DIR:-gdrive:backups/stellaris_build}"
case "$KIND" in
  daily)     BACKUP_DIR="$BACKUP_ROOT"; KEEP=7 ;;
  predeploy) BACKUP_DIR="$BACKUP_ROOT/predeploy"; KEEP=5 ;;
  *) echo "Usage: $0 [daily|predeploy]" >&2; exit 64 ;;
esac
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/stellaris_builds_$DATE.db"

ENV_FILE="/home/arthur/.env_cron"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

send_alert() {
    if [[ -z "${GMAIL_USER:-}" || -z "${GMAIL_APP_PASSWORD:-}" ]]; then
        echo "GMAIL_USER/GMAIL_APP_PASSWORD not set, skipping alert email" >&2
        return
    fi
    curl -s --ssl-reqd \
        --url 'smtps://smtp.gmail.com:465' \
        --user "${GMAIL_USER}:${GMAIL_APP_PASSWORD}" \
        --mail-from "$GMAIL_USER" \
        --mail-rcpt "$GMAIL_USER" \
        --upload-file - <<EOF
From: Backup Monitor <${GMAIL_USER}>
To: ${GMAIL_USER}
Subject: [stellaris_build] $1
Content-Type: text/plain

$2
EOF
}

# Créer le dossier de backup s'il n'existe pas
mkdir -p "$BACKUP_DIR"

# Faire le backup (copie atomique avec SQLite)
if ! sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"; then
    send_alert "Backup FAILED" "sqlite3 .backup a échoué pour $DB_PATH le $(date)."
    echo "Backup failed"
    exit 1
fi

# Compresser le backup
gzip "$BACKUP_FILE"

# Keep only the last KEEP backups of this kind
cd "$BACKUP_DIR"
ls -t stellaris_builds_*.db.gz | tail -n +$((KEEP + 1)) | xargs -r rm

# Weekly backup on Sundays (nightly run only)
if [[ "$KIND" == daily && $(date +%u) -eq 7 ]]; then
    WEEKLY_BACKUP="$BACKUP_ROOT/weekly/stellaris_builds_$(date +%Y_week%V).db.gz"
    mkdir -p "$BACKUP_ROOT/weekly"
    cp "$BACKUP_FILE.gz" "$WEEKLY_BACKUP"

    # Garder seulement les 4 derniers backups hebdomadaires
    cd "$BACKUP_ROOT/weekly"
    ls -t stellaris_builds_*.db.gz | tail -n +5 | xargs -r rm
fi

echo "Backup completed: $BACKUP_FILE.gz"

# Sync vers Google Drive (miroir des backups locaux, y compris rotation)
if rclone sync "$BACKUP_ROOT" "$GDRIVE_DIR" --exclude "*.log"; then
    echo "Synced to Google Drive"
else
    send_alert "Google Drive sync FAILED" "rclone sync vers $GDRIVE_DIR a échoué le $(date). Le backup local existe toujours dans $BACKUP_DIR mais n'est plus répliqué sur Drive."
    echo "Google Drive sync FAILED"
    exit 1
fi
