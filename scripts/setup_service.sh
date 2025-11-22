#!/bin/bash
# ============================================================
# Setup Systemd Service for Auto-Start
# UPDATED: Aligned with actual project structure
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

# Ensure logs directory exists
mkdir -p "$APP_DIR/logs"
chown "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/logs"

# Create systemd service file
echo -e "${YELLOW}Creating systemd service file...${NC}"

cat > /etc/systemd/system/tgbot.service << 'EOF'
[Unit]
Description=Telegram Bot File Management System
Documentation=https://github.com/your-username/telegram-bot-system
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=tgbot
Group=tgbot
WorkingDirectory=/opt/telegram-bot-system/backend

# Environment variables
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=-/opt/telegram-bot-system/.env

# Start command
ExecStart=/usr/bin/node server.js

# Restart behavior
Restart=always
RestartSec=10
StartLimitInterval=60
StartLimitBurst=3

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunels=true
ProtectKernelModules=true
ProtectControlGroups=true
ReadWritePaths=/opt/telegram-bot-system/data
ReadWritePaths=/opt/telegram-bot-system/logs

# Logging
StandardOutput=append:/opt/telegram-bot-system/logs/app.log
StandardError=append:/opt/telegram-bot-system/logs/error.log
SyslogIdentifier=tgbot

# Resource limits
LimitNOFILE=65535
MemoryMax=512M
CPUQuota=100%

# Process management
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ Service file created${NC}"

# Create log rotation config
echo -e "${YELLOW}Setting up log rotation...${NC}"

cat > /etc/logrotate.d/tgbot << 'EOF'
/opt/telegram-bot-system/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 tgbot tgbot
    sharedscripts
    postrotate
        /bin/systemctl reload tgbot > /dev/null 2>&1 || true
    endscript
}
EOF

echo -e "${GREEN}✓ Log rotation configured${NC}"

# Set proper permissions
echo -e "${YELLOW}Setting file permissions...${NC}"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
chmod -R 750 "$APP_DIR"
chmod 700 "$APP_DIR/data" 2>/dev/null || true

# Reload systemd
echo -e "${YELLOW}Reloading systemd daemon...${NC}"
systemctl daemon-reload

# Enable service to start on boot
echo -e "${YELLOW}Enabling service for auto-start...${NC}"
systemctl enable tgbot

# Start the service
echo -e "${YELLOW}Starting service...${NC}"
systemctl start tgbot

# Wait a moment and check status
sleep 3

if systemctl is-active --quiet tgbot; then
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✓ Service started successfully!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BLUE}Service Status:${NC}"
    systemctl status tgbot --no-pager | head -10
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo ""
    echo "  View status:"
    echo "    sudo systemctl status tgbot"
    echo ""
    echo "  Restart service:"
    echo "    sudo systemctl restart tgbot"
    echo ""
    echo "  Stop service:"
    echo "    sudo systemctl stop tgbot"
    echo ""
    echo "  View live logs:"
    echo "    sudo journalctl -u tgbot -f"
    echo ""
    echo "  View app logs:"
    echo "    tail -f $APP_DIR/logs/app.log"
    echo ""
    echo "  View error logs:"
    echo "    tail -f $APP_DIR/logs/error.log"
    echo ""
    echo -e "${GREEN}Service will automatically start on system boot!${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}✗ Service failed to start${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}Checking logs for errors...${NC}"
    echo ""
    journalctl -u tgbot -n 30 --no-pager
    echo ""
    echo -e "${YELLOW}Common Issues:${NC}"
    echo "  1. Node.js not installed or wrong version"
    echo "  2. Dependencies not installed (run: npm install)"
    echo "  3. Port 3000 already in use"
    echo "  4. File permissions incorrect"
    echo "  5. Environment variables missing"
    echo ""
    echo -e "${YELLOW}Check full logs:${NC}"
    echo "  sudo journalctl -u tgbot -n 50"
    echo ""
    exit 1
fi
