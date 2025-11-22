#!/bin/bash
# ============================================================
# Security Hardening Script
# Additional security measures for production servers
# Run as root: sudo bash security_hardening.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  Security Hardening${NC}"
echo -e "${BLUE}============================================================${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run as root${NC}"
    exit 1
fi

# ============================================================
# 1. SSH Hardening
# ============================================================
echo ""
echo -e "${BLUE}[1/6] Hardening SSH...${NC}"

# Backup original config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Apply secure settings
cat > /etc/ssh/sshd_config.d/hardening.conf << EOF
# Security hardening
PermitRootLogin prohibit-password
PasswordAuthentication yes
PubkeyAuthentication yes
PermitEmptyPasswords no
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
AllowAgentForwarding no
AllowTcpForwarding no
EOF

systemctl restart sshd
echo -e "${GREEN}✓ SSH hardened${NC}"

# ============================================================
# 2. Kernel Security Parameters
# ============================================================
echo ""
echo -e "${BLUE}[2/6] Configuring kernel security...${NC}"

cat > /etc/sysctl.d/99-security.conf << EOF
# IP Spoofing protection
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP broadcast requests
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0

# Ignore send redirects
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0

# Block SYN attacks
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2

# Log Martians
net.ipv4.conf.all.log_martians = 1

# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0

# Disable IPv6 if not needed
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1
EOF

sysctl -p /etc/sysctl.d/99-security.conf > /dev/null
echo -e "${GREEN}✓ Kernel parameters configured${NC}"

# ============================================================
# 3. Enhanced Fail2Ban Rules
# ============================================================
echo ""
echo -e "${BLUE}[3/6] Configuring enhanced Fail2Ban...${NC}"

# Create custom filter for our app
cat > /etc/fail2ban/filter.d/tgbot.conf << EOF
[Definition]
failregex = ^.*Failed login attempt from IP: <HOST>.*$
            ^.*Rate limit exceeded.*IP: <HOST>.*$
            ^.*Malicious.*from IP: <HOST>.*$
ignoreregex =
EOF

# Add jail for our app
cat >> /etc/fail2ban/jail.local << EOF

[tgbot]
enabled = true
port = http,https
filter = tgbot
logpath = /opt/telegram-bot-system/logs/app.log
maxretry = 5
bantime = 1h
findtime = 10m

[caddy]
enabled = true
port = http,https
filter = caddy
logpath = /var/log/caddy/access.log
maxretry = 10
bantime = 1h
EOF

systemctl restart fail2ban
echo -e "${GREEN}✓ Fail2Ban enhanced${NC}"

# ============================================================
# 4. Automatic Security Updates
# ============================================================
echo ""
echo -e "${BLUE}[4/6] Enabling automatic security updates...${NC}"

apt install -y unattended-upgrades apt-listchanges

cat > /etc/apt/apt.conf.d/50unattended-upgrades << EOF
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

cat > /etc/apt/apt.conf.d/20auto-upgrades << EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

echo -e "${GREEN}✓ Automatic security updates enabled${NC}"

# ============================================================
# 5. File Permissions Audit
# ============================================================
echo ""
echo -e "${BLUE}[5/6] Securing file permissions...${NC}"

APP_DIR="/opt/telegram-bot-system"

# Secure the application directory
chown -R tgbot:tgbot "$APP_DIR"
chmod 750 "$APP_DIR"
chmod 700 "$APP_DIR/data"
chmod 600 "$APP_DIR/.env"
chmod -R 640 "$APP_DIR/data/config"/*

# Secure log directory
chmod 750 "$APP_DIR/logs"

echo -e "${GREEN}✓ File permissions secured${NC}"

# ============================================================
# 6. Network Isolation (Optional UFW rules)
# ============================================================
echo ""
echo -e "${BLUE}[6/6] Additional firewall rules...${NC}"

# Rate limit SSH connections
ufw limit ssh/tcp comment 'Rate limit SSH'

# Rate limit HTTP/HTTPS (basic DDoS protection)
# Note: Caddy and fail2ban provide additional protection
ufw reload

echo -e "${GREEN}✓ Firewall rules updated${NC}"

# ============================================================
# Summary
# ============================================================
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  Security Hardening Complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Applied measures:"
echo "  ✓ SSH hardening (rate limiting, key auth preferred)"
echo "  ✓ Kernel security parameters"
echo "  ✓ Enhanced Fail2Ban rules"
echo "  ✓ Automatic security updates"
echo "  ✓ File permissions secured"
echo "  ✓ Firewall rate limiting"
echo ""
echo -e "${YELLOW}Recommendations:${NC}"
echo "  1. Set up SSH key authentication (disable password auth)"
echo "  2. Consider using a VPN for admin access"
echo "  3. Regularly check logs: /var/log/auth.log"
echo "  4. Monitor fail2ban: sudo fail2ban-client status"
echo ""
