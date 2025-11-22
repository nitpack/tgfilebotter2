#!/bin/bash
# ============================================================
# Setup Systemd Service for Auto-Start
# Run as root: sudo bash setup_service.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_NAME="telegram-bot-system"
APP_DIR="/opt/$APP_NAME"
SERVICE_USER="tgbot"

echo -e "${BLUE}Setting up systemd service...${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run as root${NC}"
    exit 1
fi

# Check if backend exists
if [ ! -f "$APP_DIR/backend/server.js" ]; then
    echo -e "${RED}Error: Backend files not found in $APP_DIR/backend/${NC}"
    echo "Please copy your backend files first."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "$APP_DIR/backend/node_modules" ]; then
    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    cd "$APP_DIR/backend"
    sudo -u "$SERVICE_USER" npm install --production
fi

# Create systemd service file
cat > /etc/systemd/system/tgbot.service << EOF
[Unit]
Description=Telegram Bot File Management System
Documentation=https://github.com/your-repo
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$APP_DIR/data $APP_DIR/logs

# Logging
StandardOutput=append:$APP_DIR/logs/app.log
StandardError=append:$APP_DIR/logs/error.log

# Resource limits
LimitNOFILE=65535
MemoryMax=512M

[Install]
WantedBy=multi-user.target
EOF

# Create log rotation config
cat > /etc/logrotate.d/tgbot << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 $SERVICE_USER $SERVICE_USER
    sharedscripts
    postrotate
        systemctl reload tgbot > /dev/null 2>&1 || true
    endscript
}
EOF

# Reload systemd
systemctl daemon-reload

# Enable service to start on boot
systemctl enable tgbot

# Start the service
systemctl start tgbot

# Wait a moment and check status
sleep 3

if systemctl is-active --quiet tgbot; then
    echo -e "${GREEN}✓ Service started successfully!${NC}"
    echo ""
    echo "Useful commands:"
    echo "  sudo systemctl status tgbot    - Check status"
    echo "  sudo systemctl restart tgbot   - Restart service"
    echo "  sudo systemctl stop tgbot      - Stop service"
    echo "  sudo journalctl -u tgbot -f    - View live logs"
    echo "  tail -f $APP_DIR/logs/app.log  - View app logs"
else
    echo -e "${RED}✗ Service failed to start${NC}"
    echo "Check logs with: sudo journalctl -u tgbot -n 50"
    exit 1
fi

echo ""
echo -e "${GREEN}Service setup complete!${NC}"
