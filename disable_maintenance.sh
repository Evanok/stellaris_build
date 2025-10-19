#!/bin/bash

# Disable maintenance mode for Stellaris Build website

echo "🚀 Disabling maintenance mode..."

# Restore nginx config from backup
if [ -f /etc/nginx/sites-available/stellaris-build.conf.backup ]; then
    echo "📝 Restoring original nginx config..."
    sudo cp /etc/nginx/sites-available/stellaris-build.conf.backup /etc/nginx/sites-available/stellaris-build.conf
else
    echo "❌ Backup config not found! Please restore nginx config manually."
    exit 1
fi

# Test nginx config
echo "🧪 Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    # Reload nginx
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx

    # Start PM2 app
    echo "▶️  Starting PM2 application..."
    pm2 start stellaris-build || pm2 restart stellaris-build

    echo ""
    echo "✅ Maintenance mode DISABLED"
    echo "🌐 Site is now live at https://stellaris-build.com"
    echo ""
    pm2 status
else
    echo "❌ Nginx configuration test failed! Please check the config manually."
    exit 1
fi
