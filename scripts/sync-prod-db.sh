#!/bin/bash
# Script to sync production database to local test environment

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Stellaris Build - Production DB Sync ===${NC}\n"

# Check if we're in the project root
if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
    echo -e "${RED}✗ Error: This script must be run from the project root directory${NC}"
    echo -e "${YELLOW}Usage: ./scripts/sync-prod-db.sh${NC}"
    exit 1
fi

# Configuration
PROD_USER="arthur"
PROD_HOST="51.159.55.29"
PROD_DB_PATH="~/work/stellaris_build/backend/stellaris_builds.db"
LOCAL_DB_PATH="./backend/stellaris_builds.db"
BACKUP_DIR="./backend/db_backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup current local database if it exists
if [ -f "$LOCAL_DB_PATH" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/stellaris_builds_local_backup_$TIMESTAMP.db"
    echo -e "${YELLOW}Backing up current local database...${NC}"
    cp "$LOCAL_DB_PATH" "$BACKUP_FILE"
    echo -e "${GREEN}✓ Local database backed up to: $BACKUP_FILE${NC}\n"
fi

# Download production database
echo -e "${YELLOW}Downloading production database...${NC}"
scp "${PROD_USER}@${PROD_HOST}:${PROD_DB_PATH}" "$LOCAL_DB_PATH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Production database synced successfully!${NC}\n"
    echo -e "${GREEN}✓ Done! Your local database now has production data.${NC}"
    echo -e "${YELLOW}Note: Remember to restart your backend server if it's running.${NC}"
else
    echo -e "${RED}✗ Error: Failed to download production database${NC}"
    echo -e "${YELLOW}Make sure you have SSH access to the production server.${NC}"
    exit 1
fi
