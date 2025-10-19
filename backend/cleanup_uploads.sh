#!/bin/bash
# Cleanup old uploaded files and cache directories
# Run daily via cron

UPLOAD_DIR="/home/arthur/work/stellaris_build/backend/uploads"

echo "$(date): Starting cleanup of old uploads..."

# Delete uploaded .sav files older than 1 hour
find "$UPLOAD_DIR" -name "*.sav" -type f -mmin +60 -delete 2>/dev/null
deleted_savs=$?

# Delete uploaded temp files older than 1 hour (multer creates files without extension)
find "$UPLOAD_DIR" -type f ! -name ".gitignore" -mmin +60 -delete 2>/dev/null
deleted_temps=$?

# Delete cache directories older than 1 hour
find "$UPLOAD_DIR" -name ".cache_*" -type d -mmin +60 -exec rm -rf {} + 2>/dev/null
deleted_caches=$?

echo "$(date): Cleanup completed"
echo "  - Deleted old .sav files: $deleted_savs"
echo "  - Deleted old temp files: $deleted_temps"
echo "  - Deleted old cache dirs: $deleted_caches"
