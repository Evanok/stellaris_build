#!/bin/bash

# Configuration
DB_PATH="/home/arthur/work/stellaris_build/backend/stellaris_builds.db"
BACKUP_DIR="/home/arthur/work/stellaris_build/backups"
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

# Garder seulement les 7 derniers backups quotidiens
cd "$BACKUP_DIR"
ls -t stellaris_builds_*.db.gz | tail -n +8 | xargs -r rm

# Créer un backup hebdomadaire le dimanche
if [ $(date +%u) -eq 7 ]; then
    WEEKLY_BACKUP="$BACKUP_DIR/weekly/stellaris_builds_$(date +%Y_week%V).db.gz"
    mkdir -p "$BACKUP_DIR/weekly"
    cp "$BACKUP_FILE.gz" "$WEEKLY_BACKUP"

    # Garder seulement les 4 derniers backups hebdomadaires
    cd "$BACKUP_DIR/weekly"
    ls -t stellaris_builds_*.db.gz | tail -n +5 | xargs -r rm
fi

echo "Backup completed: $BACKUP_FILE.gz"

# Sync vers Google Drive (miroir des backups locaux, y compris rotation)
if rclone sync "$BACKUP_DIR" "gdrive:backups/stellaris_build"; then
    echo "Synced to Google Drive"
else
    send_alert "Google Drive sync FAILED" "rclone sync vers gdrive:backups/stellaris_build a échoué le $(date). Le backup local existe toujours dans $BACKUP_DIR mais n'est plus répliqué sur Drive."
    echo "Google Drive sync FAILED"
fi
