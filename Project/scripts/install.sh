#!/bin/bash
# ============================================================
# Telegram Bot File Management System - Installation Script
# Run as root: sudo bash install.sh
# ============================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="telegram-bot-system"
APP_DIR="/opt/$APP_NAME"
DATA_DIR="$APP_DIR/data"
SERVICE_USER="tgbot"
NODE_VERSION="20"
DOMAIN=""  # Will be set interactively

echo -e "${BLUE}"
echo "============================================================"
echo "  Telegram Bot File Management System - Installer"
echo "============================================================"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run as root (sudo bash install.sh)${NC}"
    exit 1
fi

# Get domain from user
echo -e "${YELLOW}Enter your domain name (e.g., tgfiler.qzz.io):${NC}"
read -r DOMAIN
if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Error: Domain name is required${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Domain: $DOMAIN${NC}"

# Get admin credentials
echo ""
echo -e "${YELLOW}Set admin panel credentials:${NC}"
echo -n "Admin username [admin]: "
read -r ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

echo -n "Admin password (min 12 chars): "
read -rs ADMIN_PASS
echo ""
if [ ${#ADMIN_PASS} -lt 12 ]; then
    echo -e "${RED}Error: Password must be at least 12 characters${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Admin credentials configured${NC}"

# ============================================================
# Step 1: System Update
# ============================================================
echo ""
echo -e "${BLUE}[1/8] Updating system packages...${NC}"
apt update && apt upgrade -y
echo -e "${GREEN}✓ System updated${NC}"

# ============================================================
# Step 2: Install Dependencies
# ============================================================
echo ""
echo -e "${BLUE}[2/8] Installing dependencies...${NC}"

# Install essential packages
apt install -y curl wget git ufw fail2ban

# Install Node.js
if ! command -v node &> /dev/null; then
    echo "Installing Node.js $NODE_VERSION..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
fi
echo -e "${GREEN}✓ Node.js $(node --version) installed${NC}"

# Install Caddy (web server for HTTPS)
if ! command -v caddy &> /dev/null; then
    echo "Installing Caddy..."
    apt install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt update
    apt install -y caddy
fi
echo -e "${GREEN}✓ Caddy installed${NC}"

# ============================================================
# Step 3: Create Service User
# ============================================================
echo ""
echo -e "${BLUE}[3/8] Creating service user...${NC}"

if ! id "$SERVICE_USER" &>/dev/null; then
    useradd -r -s /bin/false -d "$APP_DIR" "$SERVICE_USER"
    echo -e "${GREEN}✓ User '$SERVICE_USER' created${NC}"
else
    echo -e "${YELLOW}User '$SERVICE_USER' already exists${NC}"
fi

# ============================================================
# Step 4: Setup Application Directory
# ============================================================
echo ""
echo -e "${BLUE}[4/8] Setting up application directory...${NC}"

mkdir -p "$APP_DIR"
mkdir -p "$DATA_DIR/bots"
mkdir -p "$DATA_DIR/config"
mkdir -p "$DATA_DIR/backups"
mkdir -p "$APP_DIR/backend"
mkdir -p "$APP_DIR/logs"

echo -e "${GREEN}✓ Directories created${NC}"

# ============================================================
# Step 5: Create Environment File
# ============================================================
echo ""
echo -e "${BLUE}[5/8] Creating configuration...${NC}"

cat > "$APP_DIR/.env" << EOF
# Server Configuration
PORT=3000
NODE_ENV=production
DOMAIN=$DOMAIN

# Admin Credentials (CHANGE THESE!)
ADMIN_USERNAME=$ADMIN_USER
ADMIN_PASSWORD=$ADMIN_PASS

# Paths
DATA_DIR=$DATA_DIR
LOG_DIR=$APP_DIR/logs
EOF

chmod 600 "$APP_DIR/.env"
echo -e "${GREEN}✓ Environment file created${NC}"

# ============================================================
# Step 6: Configure Caddy (HTTPS)
# ============================================================
echo ""
echo -e "${BLUE}[6/8] Configuring Caddy for HTTPS...${NC}"

cat > /etc/caddy/Caddyfile << EOF
# Telegram Bot File Management System
# HTTPS is automatic with Let's Encrypt

$DOMAIN {
    # Proxy to Node.js backend
    reverse_proxy localhost:3000
    
    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }
    
    # Logging
    log {
        output file /var/log/caddy/access.log
        format json
    }
}
EOF

mkdir -p /var/log/caddy
systemctl restart caddy
echo -e "${GREEN}✓ Caddy configured for $DOMAIN${NC}"

# ============================================================
# Step 7: Configure Firewall (UFW)
# ============================================================
echo ""
echo -e "${BLUE}[7/8] Configuring firewall...${NC}"

# Reset UFW to defaults
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (important - don't lock yourself out!)
ufw allow 22/tcp comment 'SSH'

# Allow HTTP and HTTPS (for Caddy)
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Enable UFW
ufw --force enable

echo -e "${GREEN}✓ Firewall configured${NC}"
echo "  - SSH (22): ALLOWED"
echo "  - HTTP (80): ALLOWED"
echo "  - HTTPS (443): ALLOWED"
echo "  - All other incoming: BLOCKED"

# ============================================================
# Step 8: Configure Fail2Ban
# ============================================================
echo ""
echo -e "${BLUE}[8/8] Configuring Fail2Ban...${NC}"

cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 24h
EOF

systemctl restart fail2ban
systemctl enable fail2ban
echo -e "${GREEN}✓ Fail2Ban configured${NC}"

# ============================================================
# Set Permissions
# ============================================================
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
chmod -R 750 "$APP_DIR"
chmod 700 "$DATA_DIR"

# ============================================================
# Summary
# ============================================================
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "Application directory: ${BLUE}$APP_DIR${NC}"
echo -e "Data directory: ${BLUE}$DATA_DIR${NC}"
echo -e "Domain: ${BLUE}$DOMAIN${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Copy your backend files to: $APP_DIR/backend/"
echo "2. Run: cd $APP_DIR/backend && npm install"
echo "3. Run: sudo bash /opt/$APP_NAME/scripts/setup_service.sh"
echo "4. Access admin panel at: https://$DOMAIN/admin"
echo ""
echo -e "${RED}IMPORTANT: Save your admin credentials securely!${NC}"
echo "Username: $ADMIN_USER"
echo "Password: [hidden]"
echo ""
