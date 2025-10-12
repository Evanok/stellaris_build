#!/bin/bash

# Configuration
DB_PATH="/home/arthur/work/stellaris_build/backend/stellaris_builds.db"
BACKUP_DIR="/home/arthur/work/stellaris_build/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/stellaris_builds_$DATE.db"

# Créer le dossier de backup s'il n'existe pas
mkdir -p "$BACKUP_DIR"

# Faire le backup (copie atomique avec SQLite)
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

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
