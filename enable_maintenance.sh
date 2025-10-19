#!/bin/bash

# Enable maintenance mode for Stellaris Build website

echo "🔧 Enabling maintenance mode..."

# Stop PM2 app
echo "📛 Stopping PM2 application..."
pm2 stop stellaris-build

# Backup current nginx config
if [ ! -f /etc/nginx/sites-available/stellaris-build.conf.backup ]; then
    echo "💾 Backing up nginx config..."
    sudo cp /etc/nginx/sites-available/stellaris-build.conf /etc/nginx/sites-available/stellaris-build.conf.backup
fi

# Create maintenance nginx config
echo "📝 Creating maintenance nginx config..."
sudo tee /etc/nginx/sites-available/stellaris-build.conf > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name stellaris-build.com www.stellaris-build.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name stellaris-build.com www.stellaris-build.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/stellaris-build.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stellaris-build.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Serve ONLY the maintenance page
    root /home/arthur/work/stellaris_build;

    location / {
        # Always serve maintenance.html for ALL requests
        return 503;
    }

    error_page 503 @maintenance;

    location @maintenance {
        rewrite ^(.*)$ /maintenance.html break;
    }

    location = /maintenance.html {
        internal;
    }
}
EOF

# Test nginx config
echo "🧪 Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    # Reload nginx
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx
    echo ""
    echo "✅ Maintenance mode ENABLED"
    echo "🌐 Visit https://stellaris-build.com to see the maintenance page"
    echo ""
    echo "To disable maintenance mode, run: ./disable_maintenance.sh"
else
    echo "❌ Nginx configuration test failed! Restoring backup..."
    sudo cp /etc/nginx/sites-available/stellaris-build.conf.backup /etc/nginx/sites-available/stellaris-build.conf
    pm2 start stellaris-build
fi
