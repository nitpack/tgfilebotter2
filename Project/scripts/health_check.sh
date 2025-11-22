#!/bin/bash
# ============================================================
# System Health Check Script
# Run anytime to verify system status
# Usage: sudo bash health_check.sh
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/opt/telegram-bot-system"
DOMAIN=$(grep DOMAIN "$APP_DIR/.env" 2>/dev/null | cut -d'=' -f2)

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  System Health Check${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

check_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "  ${RED}✗${NC} $1"
}

check_warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

# ============================================================
# Service Status
# ============================================================
echo -e "${BLUE}[Services]${NC}"

if systemctl is-active --quiet tgbot; then
    check_pass "tgbot service: RUNNING"
else
    check_fail "tgbot service: NOT RUNNING"
fi

if systemctl is-active --quiet caddy; then
    check_pass "Caddy (HTTPS): RUNNING"
else
    check_fail "Caddy (HTTPS): NOT RUNNING"
fi

if systemctl is-active --quiet ufw; then
    check_pass "Firewall (UFW): ACTIVE"
else
    check_warn "Firewall (UFW): INACTIVE"
fi

if systemctl is-active --quiet fail2ban; then
    check_pass "Fail2Ban: RUNNING"
else
    check_warn "Fail2Ban: NOT RUNNING"
fi

# ============================================================
# Application Health
# ============================================================
echo ""
echo -e "${BLUE}[Application]${NC}"

# Check if app responds
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    check_pass "Backend API: RESPONDING"
else
    check_fail "Backend API: NOT RESPONDING (HTTP $HTTP_CODE)"
fi

# Check HTTPS
if [ -n "$DOMAIN" ]; then
    HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" 2>/dev/null)
    if [ "$HTTPS_CODE" = "200" ]; then
        check_pass "HTTPS ($DOMAIN): WORKING"
    else
        check_warn "HTTPS ($DOMAIN): NOT WORKING (HTTP $HTTPS_CODE)"
    fi
fi

# ============================================================
# Data & Storage
# ============================================================
echo ""
echo -e "${BLUE}[Storage]${NC}"

# Count bots
BOT_COUNT=$(ls -1 "$APP_DIR/data/bots" 2>/dev/null | wc -l)
check_pass "Bots registered: $BOT_COUNT"

# Check disk space
DISK_USAGE=$(df -h "$APP_DIR" | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_USAGE" -lt 80 ]; then
    check_pass "Disk usage: ${DISK_USAGE}%"
elif [ "$DISK_USAGE" -lt 90 ]; then
    check_warn "Disk usage: ${DISK_USAGE}% (getting full)"
else
    check_fail "Disk usage: ${DISK_USAGE}% (critical!)"
fi

# Check backup age
LATEST_BACKUP=$(ls -t "$APP_DIR/data/backups"/backup_*.tar.gz 2>/dev/null | head -1)
if [ -n "$LATEST_BACKUP" ]; then
    BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 86400 ))
    if [ "$BACKUP_AGE" -lt 2 ]; then
        check_pass "Latest backup: $BACKUP_AGE days ago"
    else
        check_warn "Latest backup: $BACKUP_AGE days ago (consider manual backup)"
    fi
else
    check_warn "No backups found"
fi

# ============================================================
# Security
# ============================================================
echo ""
echo -e "${BLUE}[Security]${NC}"

# Check fail2ban bans
BANNED=$(sudo fail2ban-client status sshd 2>/dev/null | grep "Currently banned" | awk '{print $NF}')
if [ -n "$BANNED" ]; then
    check_pass "IPs currently banned (SSH): $BANNED"
else
    check_pass "IPs currently banned (SSH): 0"
fi

# Check for recent auth failures
AUTH_FAILS=$(grep "Failed password" /var/log/auth.log 2>/dev/null | wc -l)
check_pass "Failed SSH attempts (total): $AUTH_FAILS"

# ============================================================
# Resources
# ============================================================
echo ""
echo -e "${BLUE}[Resources]${NC}"

# Memory
MEM_USED=$(free -m | awk 'NR==2{printf "%.0f", $3*100/$2 }')
if [ "$MEM_USED" -lt 80 ]; then
    check_pass "Memory usage: ${MEM_USED}%"
else
    check_warn "Memory usage: ${MEM_USED}%"
fi

# CPU Load
LOAD=$(uptime | awk -F'load average:' '{print $2}' | cut -d, -f1 | xargs)
check_pass "CPU load (1min): $LOAD"

# Uptime
UPTIME=$(uptime -p)
check_pass "System uptime: $UPTIME"

# ============================================================
# Summary
# ============================================================
echo ""
echo -e "${BLUE}============================================================${NC}"
echo "Health check completed at $(date)"
echo ""
