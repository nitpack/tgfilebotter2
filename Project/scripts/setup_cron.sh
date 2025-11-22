#!/bin/bash
# ============================================================
# Setup Cron Jobs for Automated Tasks
# Run as root: sudo bash setup_cron.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/opt/telegram-bot-system"
SCRIPTS_DIR="$APP_DIR/scripts"

echo -e "${BLUE}Setting up automated tasks (cron jobs)...${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run as root${NC}"
    exit 1
fi

# Make scripts executable
chmod +x "$SCRIPTS_DIR/backup.sh"

# Create cron job file
cat > /etc/cron.d/tgbot << EOF
# Telegram Bot System - Automated Tasks
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Daily backup at 2:00 AM
0 2 * * * root $SCRIPTS_DIR/backup.sh >> $APP_DIR/logs/cron.log 2>&1

# Restart service weekly (Sunday 4:00 AM) for memory cleanup
0 4 * * 0 root systemctl restart tgbot >> $APP_DIR/logs/cron.log 2>&1

# Clean old logs monthly (1st of month, 3:00 AM)
0 3 1 * * root find $APP_DIR/logs -name "*.log" -mtime +30 -delete >> $APP_DIR/logs/cron.log 2>&1
EOF

chmod 644 /etc/cron.d/tgbot

# Restart cron to apply changes
systemctl restart cron

echo -e "${GREEN}✓ Cron jobs configured:${NC}"
echo "  - Daily backup at 2:00 AM"
echo "  - Weekly service restart (Sunday 4:00 AM)"
echo "  - Monthly log cleanup"
echo ""
echo "View scheduled tasks: cat /etc/cron.d/tgbot"
echo "View cron logs: tail -f $APP_DIR/logs/cron.log"
