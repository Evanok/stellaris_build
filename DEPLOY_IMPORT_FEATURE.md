# Deployment Instructions for .sav Import Feature

## Prerequisites
- Python 3 installed on server (already verified ✓)
- multer package installed (in package.json)

## Deployment Steps

### 1. Commit and Push Code
```bash
git add .
git commit -m "feat: Add .sav file import functionality with auto-cleanup"
git push
```

### 2. On Production Server
```bash
ssh arthur@51.159.55.29
cd ~/work/stellaris_build
```

### 3. Pull Latest Code
```bash
git pull
npm install  # Install multer
```

### 4. Configure nginx for Large File Uploads
```bash
sudo nano /etc/nginx/sites-available/stellaris-build.conf
```

Add this line inside the `server {}` block:
```nginx
    client_max_body_size 100M;
```

Example placement:
```nginx
server {
    listen 443 ssl http2;
    server_name stellaris-build.com www.stellaris-build.com;

    # Add this line:
    client_max_body_size 100M;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/stellaris-build.com/fullchain.pem;
    # ... rest of config
}
```

### 5. Test and Reload nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Rebuild Frontend
```bash
npm run build -w frontend
```

### 7. Restart Backend
```bash
pm2 restart stellaris-build
```

### 8. Setup Cleanup Cron Job (Optional but Recommended)
```bash
# Edit crontab
crontab -e

# Add this line to run cleanup every hour:
0 * * * * /home/arthur/work/stellaris_build/backend/cleanup_uploads.sh >> /home/arthur/work/stellaris_build/backend/cleanup.log 2>&1
```

### 9. Test the Feature
1. Go to https://stellaris-build.com/create
2. Upload a .sav file
3. Verify form is pre-filled
4. Check that uploaded files are cleaned up:
   ```bash
   ls -la ~/work/stellaris_build/backend/uploads/
   ```

## What Gets Cleaned Up

### Immediate Cleanup (after each import):
- ✓ Uploaded .sav file deleted
- ✓ Cache directory `.cache_<filename>` deleted

### Cron Job Cleanup (every hour):
- Files older than 1 hour in uploads/
- Cache directories older than 1 hour

## Troubleshooting

### If imports fail:
```bash
# Check PM2 logs
pm2 logs stellaris-build

# Test Python script manually
cd ~/work/stellaris_build
python3 data-extractor/import_build_from_save.py <test.sav>
```

### If nginx blocks uploads:
```bash
# Check nginx error log
sudo tail -f /var/log/nginx/error.log

# Verify client_max_body_size is set
grep client_max_body_size /etc/nginx/sites-available/stellaris-build.conf
```

### Check disk space:
```bash
df -h
du -sh ~/work/stellaris_build/backend/uploads/
```

## Security Notes

- ✅ Only .sav files accepted (enforced by multer)
- ✅ 50MB max file size (backend)
- ✅ 100MB max nginx limit
- ✅ No absolute server paths exposed in output
- ✅ Automatic cleanup prevents disk filling
- ✅ Files stored temporarily (deleted after processing)
