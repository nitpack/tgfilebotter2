# Complete Deployment Guide
## Telegram Bot File Management System

This guide will walk you through **every step** from a fresh computer to a fully running, secured server. Written for beginners with no Linux experience.

---

# Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Installing Linux](#2-installing-linux)
3. [First Linux Steps](#3-first-linux-steps)
4. [Transferring Files to Server](#4-transferring-files-to-server)
5. [Running Installation Scripts](#5-running-installation-scripts)
6. [Domain & SSL Setup](#6-domain--ssl-setup)
7. [Security Configuration](#7-security-configuration)
8. [Network Isolation](#8-network-isolation)
9. [Testing Everything](#9-testing-everything)
10. [Configuring the Windows Uploader](#10-configuring-the-windows-uploader)
11. [Daily Operations](#11-daily-operations)
12. [Troubleshooting](#12-troubleshooting)

---

# 1. Pre-Deployment Checklist

## Things You Need Ready

### Hardware
- [ ] A computer to use as server (can be old PC, mini PC, or dedicated server)
- [ ] Minimum specs: 2GB RAM, 20GB storage, any modern CPU
- [ ] Ethernet cable (WiFi works but wired is more reliable)
- [ ] USB drive (8GB+) for Linux installation

### Accounts & Services
- [ ] Domain registered: `tgfiler.qzz.io` ✓ (you have this)
- [ ] DNS configured at afraid.org ✓ (you have this)
- [ ] Telegram account for admin bot (optional but recommended)

### Files You Should Have
From the project, you need these folders:
```
telegram-bot-system/
├── backend/           # Phase 1 & 2 files
│   ├── server.js
│   ├── bot-manager.js
│   ├── storage.js
│   ├── security.js
│   ├── config.js
│   ├── admin-bot.js
│   ├── admin-routes.js
│   ├── package.json
│   └── public/
│       ├── admin-panel.html
│       └── admin-panel.js
├── scripts/           # Phase 4 files (deployment)
│   ├── install.sh
│   ├── setup_service.sh
│   ├── backup.sh
│   ├── setup_cron.sh
│   ├── security_hardening.sh
│   └── health_check.sh
└── uploader/          # Phase 3 files (Windows app)
    └── (all uploader files)
```

### Code Changes You Need to Make

**IMPORTANT:** Before deploying, update these files:

#### 1. In `backend/server.js` - Verify the bot-metadata endpoint exists

After the `/api/bot-status/:botToken` endpoint, you should have:

```javascript
// Bot metadata endpoint (for update mode in uploader)
app.get('/api/bot-metadata/:botToken', async (req, res) => {
  try {
    const botToken = security.sanitizeInput(req.params.botToken);
    const bot = storage.getBotByToken(botToken);

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }

    return res.json({
      success: true,
      botId: bot.id,
      status: bot.status,
      metadata: bot.metadata,
      lastUpdate: bot.lastUpdate,
      createdAt: bot.createdAt
    });

  } catch (error) {
    console.error('Metadata fetch error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error fetching bot metadata'
    });
  }
});
```

**You said you added this - good!**

#### 2. No other code changes needed yet

The admin credentials will be set during installation (not hardcoded in files).

---

# 2. Installing Linux

## Recommended: Ubuntu Server 22.04 LTS

**Why Ubuntu Server 22.04?**
- Long-term support (updates until 2027)
- Most tutorials and help available online
- Easy to use for beginners
- All our scripts are tested on it

## Step-by-Step Installation

### 2.1 Download Ubuntu Server

1. Go to: https://ubuntu.com/download/server
2. Download **Ubuntu Server 22.04.x LTS**
3. You'll get an ISO file (~2GB)

### 2.2 Create Bootable USB

**On Windows:**
1. Download Rufus: https://rufus.ie/
2. Insert USB drive
3. Open Rufus
4. Select your USB drive
5. Click SELECT → choose the Ubuntu ISO
6. Click START
7. Wait for completion (~5-10 minutes)

### 2.3 Install on Server Computer

1. Insert USB into your server computer
2. Turn on/restart the computer
3. Press the boot menu key (usually F12, F2, or Del - shown on screen briefly)
4. Select your USB drive from boot menu
5. Choose "Install Ubuntu Server"

**During installation:**

| Screen | What to Select |
|--------|----------------|
| Language | English |
| Keyboard | Your keyboard layout |
| Network | Select your network (will auto-configure) |
| Proxy | Leave blank (press Enter) |
| Mirror | Leave default (press Enter) |
| Storage | "Use entire disk" |
| Storage config | Continue with defaults |
| Profile | See below |
| SSH | Enable OpenSSH server ✓ |
| Snaps | Skip (don't select anything) |

**Profile Setup:**
- Your name: `Administrator` (or anything)
- Server name: `tgserver` (or anything short)
- Username: `admin` (you'll use this to log in)
- Password: Choose a STRONG password (write it down!)

### 2.4 Complete Installation

1. Wait for installation to finish
2. When prompted, remove USB and press Enter
3. Server will reboot
4. You'll see a login prompt

**Congratulations! Linux is installed.**

---

# 3. First Linux Steps

## 3.1 Logging In

When you see:
```
tgserver login: _
```

Type your username and press Enter, then your password (you won't see characters as you type - this is normal).

## 3.2 Basic Linux Commands

Here are the only commands you need to know:

| Command | What it does |
|---------|--------------|
| `ls` | List files in current folder |
| `cd foldername` | Go into a folder |
| `cd ..` | Go back one folder |
| `pwd` | Show current location |
| `sudo` | Run command as administrator |
| `nano filename` | Edit a text file |
| `cat filename` | Show file contents |
| `clear` | Clear the screen |

## 3.3 Find Your Server's IP Address

Run this command:
```bash
ip addr show | grep "inet "
```

Look for a line like:
```
inet 192.168.1.100/24 ...
```

**Write down this IP address!** (example: `192.168.1.100`)

You'll use this to:
1. Connect remotely from your Windows PC
2. Point your domain to this server

## 3.4 Update the System

Run these commands (one at a time):
```bash
sudo apt update
sudo apt upgrade -y
```

This updates all software. It might take 5-10 minutes.

## 3.5 Connect from Windows (Optional but Recommended)

Working directly on the server is hard. Let's connect from your Windows PC:

1. **Download PuTTY:** https://www.putty.org/
2. Open PuTTY
3. Enter your server's IP address (e.g., `192.168.1.100`)
4. Port: `22`
5. Click "Open"
6. Click "Accept" if asked about key
7. Log in with your username and password

Now you can copy-paste commands easily!

---

# 4. Transferring Files to Server

## 4.1 Install WinSCP (File Transfer Tool)

1. Download WinSCP: https://winscp.net/
2. Install it
3. Open WinSCP

## 4.2 Connect to Server

1. File protocol: `SFTP`
2. Host name: Your server IP (e.g., `192.168.1.100`)
3. Port: `22`
4. User name: Your username
5. Password: Your password
6. Click "Login"

## 4.3 Upload Project Files

**Left side** = Your Windows PC
**Right side** = Your Linux server

1. On the right side, navigate to `/home/admin/` (or your username)
2. Right-click → New → Directory → name it `telegram-bot-system`
3. Double-click to enter the folder
4. On the left side, navigate to where you have the project files
5. Select `backend` folder → drag to right side
6. Select `scripts` folder → drag to right side
7. Wait for upload to complete

Your server should now have:
```
/home/admin/telegram-bot-system/
├── backend/
│   ├── server.js
│   ├── ... (all backend files)
│   └── public/
└── scripts/
    ├── install.sh
    └── ... (all script files)
```

---

# 5. Running Installation Scripts

Now we'll run the scripts that set everything up automatically.

## 5.1 Make Scripts Executable

In your terminal (PuTTY), run:
```bash
cd ~/telegram-bot-system/scripts
chmod +x *.sh
```

## 5.2 Run Main Installation

```bash
sudo bash install.sh
```

**The script will ask you:**

1. **Domain name:** Enter `tgfiler.qzz.io`
2. **Admin username:** Choose a username (e.g., `admin`)
3. **Admin password:** Choose a STRONG password (minimum 12 characters)

**Write these credentials down! You need them to log into the admin panel.**

The script will automatically:
- Install Node.js
- Install Caddy (web server)
- Configure firewall
- Create service user
- Set up directories
- Configure HTTPS

Wait for it to complete (5-15 minutes).

## 5.3 Copy Backend Files to Application Directory

```bash
sudo cp -r ~/telegram-bot-system/backend/* /opt/telegram-bot-system/backend/
sudo cp -r ~/telegram-bot-system/scripts/* /opt/telegram-bot-system/scripts/
sudo chown -R tgbot:tgbot /opt/telegram-bot-system/
```

## 5.4 Install Node.js Dependencies

```bash
cd /opt/telegram-bot-system/backend
sudo -u tgbot npm install
```

Wait for packages to install.

## 5.5 Setup the Service

```bash
sudo bash /opt/telegram-bot-system/scripts/setup_service.sh
```

This makes the app start automatically when server boots.

## 5.6 Setup Automated Tasks

```bash
sudo bash /opt/telegram-bot-system/scripts/setup_cron.sh
```

This sets up daily backups.

## 5.7 Run Security Hardening

```bash
sudo bash /opt/telegram-bot-system/scripts/security_hardening.sh
```

This applies additional security measures.

---
