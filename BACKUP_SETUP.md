# Database Backup Setup

This document explains how to set up automatic daily backups for the SQLite database.

## Backup Strategy

- **Daily backups**: Keep the last 7 days
- **Weekly backups**: Keep the last 4 weeks (created every Sunday)
- **Compression**: All backups are gzipped to save space
- **Location**: `~/work/stellaris_build/backups/`

## Setup on Production Server

### 1. Pull the Latest Code

```bash
cd ~/work/stellaris_build
git pull
```

### 2. Verify the Backup Script

The script should be executable. Verify with:

```bash
ls -l backup_db.sh
# Should show: -rwxr-xr-x (executable permissions)
```

If not executable, run:

```bash
chmod +x backup_db.sh
```

### 3. Test the Backup Script

Run it manually to ensure it works:

```bash
./backup_db.sh
```

Check that the backup was created:

```bash
ls -lh backups/
```

You should see a file like `stellaris_builds_20251012_140530.db.gz`

### 4. Setup Automatic Daily Backups

Open the crontab editor:

```bash
crontab -e
```

Add this line to run backups daily at 3:00 AM:

```
0 3 * * * /home/arthur/work/stellaris_build/backup_db.sh >> /home/arthur/work/stellaris_build/backup.log 2>&1
```

Save and exit (Ctrl+X, Y, Enter in nano).

### 5. Verify Cron Job

List your cron jobs to verify:

```bash
crontab -l
```

## Manual Backup

To create a backup manually at any time:

```bash
cd ~/work/stellaris_build
./backup_db.sh
```

## Restore from Backup

To restore the database from a backup:

```bash
# 1. Stop the application
pm2 stop stellaris-build

# 2. Choose a backup file
ls -lh backups/

# 3. Uncompress and restore (replace DATE with actual date)
gunzip -c backups/stellaris_builds_DATE.db.gz > backend/stellaris_builds.db

# 4. Restart the application
pm2 start stellaris-build
```

## View Backup Logs

To see the backup history and any errors:

```bash
tail -n 50 ~/work/stellaris_build/backup.log
```

## Backup File Naming

- **Daily**: `stellaris_builds_YYYYMMDD_HHMMSS.db.gz`
- **Weekly**: `weekly/stellaris_builds_YYYY_weekWW.db.gz`

Example:
- `stellaris_builds_20251012_030000.db.gz` (daily)
- `weekly/stellaris_builds_2025_week41.db.gz` (weekly)

## Backup Retention

The script automatically:
- Keeps the **last 7 daily backups** (deletes older ones)
- Keeps the **last 4 weekly backups** (deletes older ones)

This ensures you always have:
- 7 days of daily restore points
- 4 weeks of weekly restore points
- Without filling up disk space

## Disk Space

A typical backup size:
- Uncompressed: ~500 KB - 5 MB (depending on number of builds)
- Compressed: ~100 KB - 1 MB (gzip compression)

With retention policy (7 daily + 4 weekly):
- **Max disk usage**: ~11 MB (very small)

## Troubleshooting

### Backup script fails

Check permissions:
```bash
ls -l backup_db.sh
# Should be executable (-rwxr-xr-x)
```

Check if sqlite3 is installed:
```bash
which sqlite3
# Should return: /usr/bin/sqlite3
```

If not installed:
```bash
sudo apt install sqlite3
```

### Cron job not running

Check if cron service is running:
```bash
sudo systemctl status cron
```

Check cron logs:
```bash
grep CRON /var/log/syslog | tail -n 20
```

### No backups being created

Check the backup log for errors:
```bash
cat ~/work/stellaris_build/backup.log
```

## Security Notes

- Backups contain all user data and builds
- Keep backups secure (they're in your home directory with restricted permissions)
- Consider encrypting backups if storing offsite
- The `backups/` folder is in `.gitignore` (backups won't be committed to git)
