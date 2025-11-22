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

# 6. Domain & SSL Setup

## 6.1 Understanding the Setup

Your domain flow:
```
User → tgfiler.qzz.io → afraid.org DNS → Your Server IP → Caddy → Node.js App
```

**Caddy automatically handles SSL/HTTPS** - no manual certificate setup needed!

## 6.2 Configure DNS at afraid.org

1. Log into https://freedns.afraid.org/
2. Go to your domain: `tgfiler.qzz.io`
3. Add/Edit an **A Record**:
   - Type: `A`
   - Subdomain: leave blank (or `@`)
   - Destination: Your server's **public** IP

### Finding Your Public IP

On your server, run:
```bash
curl ifconfig.me
```

This shows your PUBLIC IP (different from the 192.168.x.x local IP).

**Example:**
- Public IP: `203.0.113.50`
- Set this in afraid.org

### Wait for DNS Propagation

DNS changes can take 5 minutes to 24 hours to work worldwide.

Test if it's working:
```bash
ping tgfiler.qzz.io
```

If you see your server's IP responding, DNS is working!

## 6.3 Port Forwarding on Your Router

Since your server is at home behind a router, you need to forward ports:

1. **Find your router's admin page:**
   - Usually `192.168.1.1` or `192.168.0.1`
   - Try typing it in a web browser
   - Log in (check router for default password, often on a sticker)

2. **Find "Port Forwarding" section:**
   - Might be under: Advanced → NAT → Port Forwarding
   - Or: Security → Port Forwarding
   - Or: Gaming/Applications

3. **Add these rules:**

| Name | External Port | Internal IP | Internal Port | Protocol |
|------|---------------|-------------|---------------|----------|
| HTTP | 80 | 192.168.1.100* | 80 | TCP |
| HTTPS | 443 | 192.168.1.100* | 443 | TCP |
| SSH | 22 | 192.168.1.100* | 22 | TCP |

*Replace with your server's local IP

4. **Save/Apply the rules**

## 6.4 Test HTTPS

After DNS propagates and ports are forwarded:

```bash
curl -I https://tgfiler.qzz.io/health
```

You should see:
```
HTTP/2 200
```

**Caddy automatically obtained SSL certificates!**

---

# 7. Security Configuration

## 7.1 What's Already Protected

The installation scripts already set up:

| Protection | What it does |
|------------|--------------|
| UFW Firewall | Blocks all ports except 22, 80, 443 |
| Fail2Ban | Bans IPs after failed login attempts |
| SSH Hardening | Limits login attempts |
| Kernel Security | Network attack protections |
| Auto Updates | Security patches install automatically |

## 7.2 Check Firewall Status

```bash
sudo ufw status verbose
```

You should see:
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     LIMIT       Anywhere      # SSH
80/tcp                     ALLOW       Anywhere      # HTTP
443/tcp                    ALLOW       Anywhere      # HTTPS
```

## 7.3 Check Fail2Ban Status

```bash
sudo fail2ban-client status
```

To see banned IPs:
```bash
sudo fail2ban-client status sshd
```

## 7.4 View Failed Login Attempts

```bash
sudo grep "Failed password" /var/log/auth.log | tail -20
```

## 7.5 Change SSH Port (Extra Security - Optional)

Changing SSH from port 22 to something random reduces automated attacks:

1. Edit SSH config:
```bash
sudo nano /etc/ssh/sshd_config
```

2. Find `#Port 22` and change to:
```
Port 2222
```
(Use any number between 1024-65535)

3. Update firewall:
```bash
sudo ufw delete allow 22/tcp
sudo ufw allow 2222/tcp comment 'SSH'
sudo ufw reload
```

4. Update router port forwarding to use new port

5. Restart SSH:
```bash
sudo systemctl restart sshd
```

**Important:** Before closing current session, test the new port works!

```bash
ssh -p 2222 admin@your-server-ip
```

---

# 8. Network Isolation

## 8.1 Why Isolate?

Your server handles internet traffic. You don't want a compromised server to access your other home devices (computers, smart TVs, phones).

## 8.2 Option A: Router VLAN/Guest Network (Best)

Many routers support VLANs or Guest Networks:

1. Create a separate VLAN or Guest Network for your server
2. Connect server to that network
3. Disable "access to local network" for that VLAN/Guest

This completely isolates the server from your home devices.

## 8.3 Option B: Server Firewall Rules (Good)

If your router doesn't support VLANs, add rules on the server:

```bash
# Block server from accessing local network (except router)
sudo iptables -A OUTPUT -d 192.168.1.0/24 -j DROP
sudo iptables -I OUTPUT -d 192.168.1.1 -j ACCEPT  # Allow router
sudo iptables -A INPUT -s 192.168.1.0/24 -j DROP
sudo iptables -I INPUT -s 192.168.1.1 -j ACCEPT   # Allow router

# Save rules
sudo apt install iptables-persistent -y
sudo netfilter-persistent save
```

**Note:** Replace `192.168.1.0/24` with your actual network range.

## 8.4 Option C: Separate Router (Best Security)

If budget allows, buy a cheap second router:

```
Internet → Main Router → Second Router → Server
                      ↓
                Your home devices
```

This physically separates networks.

---

# 9. Testing Everything

## 9.1 Run Health Check

```bash
sudo bash /opt/telegram-bot-system/scripts/health_check.sh
```

All items should show green checkmarks (✓).

## 9.2 Test Backend API

From your server:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","timestamp":"..."}
```

## 9.3 Test HTTPS Access

From any browser, go to:
```
https://tgfiler.qzz.io/health
```

Should show:
```json
{"status":"ok","timestamp":"..."}
```

## 9.4 Test Admin Panel

From any browser, go to:
```
https://tgfiler.qzz.io/admin
```

You should see the login page.

Log in with the credentials you set during installation.

## 9.5 Test Admin Panel Functions

After logging in, verify:

- [ ] Dashboard shows (even if stats are 0)
- [ ] Bot Management page loads
- [ ] Settings page loads
- [ ] Can save settings

## 9.6 Check Service Status

```bash
sudo systemctl status tgbot
```

Should show `active (running)`.

## 9.7 Check Logs

```bash
# Application logs
tail -f /opt/telegram-bot-system/logs/app.log

# Caddy (web server) logs
tail -f /var/log/caddy/access.log
```

Press `Ctrl+C` to stop viewing logs.

---

# 10. Configuring the Windows Uploader

## 10.1 Update Server URL

Now that your server is running, update the uploader:

1. Open `uploader/config.py`
2. Change line 8:
```python
SERVER_URL = "https://tgfiler.qzz.io"
```

3. Save the file

## 10.2 Rebuild the Executable

Open PowerShell in the uploader folder:
```powershell
.\build_uploader.ps1
```

This creates a new `FileUploader_v1.0.0.exe` that connects to your server.

## 10.3 Distribute to Users

Give users:
1. The `FileUploader_v1.0.0.exe`
2. The `QUICKSTART.md` guide (rename to `README.txt`)

## 10.4 Test Upload

1. Run the new FileUploader.exe
2. Create a test folder with a few small files
3. Create a Telegram bot (@BotFather)
4. Create a private channel, add bot as admin
5. Enter credentials in uploader
6. Click "Start Upload"
7. Should complete successfully!

## 10.5 Verify on Server

After upload, check:

1. Admin panel shows the new bot (pending status)
2. Files are in the Telegram channel
3. Bot responds to /start (admin only for pending)

---

# 11. Daily Operations

## 11.1 Common Commands

| Task | Command |
|------|---------|
| Check if running | `sudo systemctl status tgbot` |
| Restart service | `sudo systemctl restart tgbot` |
| Stop service | `sudo systemctl stop tgbot` |
| Start service | `sudo systemctl start tgbot` |
| View live logs | `sudo journalctl -u tgbot -f` |
| View app logs | `tail -f /opt/telegram-bot-system/logs/app.log` |
| Health check | `sudo bash /opt/telegram-bot-system/scripts/health_check.sh` |
| Manual backup | `sudo bash /opt/telegram-bot-system/scripts/backup.sh` |

## 11.2 Approving Bots

1. Go to `https://tgfiler.qzz.io/admin`
2. Log in
3. Click "Bot Management"
4. Click "Approve" on pending bots

## 11.3 Banning Users

1. Admin panel → Bot Management
2. Find the bot
3. Click "Ban Owner"
4. Enter reason
5. All user's bots will be disconnected

## 11.4 Checking Backups

Backups run automatically at 2:00 AM daily.

To verify:
```bash
ls -la /opt/telegram-bot-system/data/backups/
```

To manually backup:
```bash
sudo bash /opt/telegram-bot-system/scripts/backup.sh
```

## 11.5 Updating the Application

If you need to update code:

1. Upload new files to `/home/admin/telegram-bot-system/`
2. Copy to application directory:
```bash
sudo cp -r ~/telegram-bot-system/backend/* /opt/telegram-bot-system/backend/
sudo chown -R tgbot:tgbot /opt/telegram-bot-system/
```
3. Restart service:
```bash
sudo systemctl restart tgbot
```

## 11.6 Server Reboot

The app automatically starts on reboot. To manually reboot:
```bash
sudo reboot
```

After reboot, check:
```bash
sudo systemctl status tgbot
```

---

# 12. Troubleshooting

## Problem: Can't Access Admin Panel

**Check 1:** Is the service running?
```bash
sudo systemctl status tgbot
```

**Check 2:** Is Caddy running?
```bash
sudo systemctl status caddy
```

**Check 3:** DNS working?
```bash
ping tgfiler.qzz.io
```

**Check 4:** Firewall allowing traffic?
```bash
sudo ufw status
```

## Problem: "Connection Refused" Error

**Check:** Is the app listening?
```bash
curl http://localhost:3000/health
```

If this fails, check logs:
```bash
sudo journalctl -u tgbot -n 50
```

## Problem: SSL Certificate Errors

Caddy auto-renews certificates. If issues:
```bash
sudo systemctl restart caddy
sudo journalctl -u caddy -n 50
```

## Problem: Can't SSH into Server

**Check 1:** SSH service running?
```bash
# From console directly on server
sudo systemctl status sshd
```

**Check 2:** Firewall?
```bash
sudo ufw status
```

**Check 3:** Did you change SSH port?
Remember to use `-p PORTNUMBER` if you changed it.

## Problem: App Crashes Repeatedly

Check logs:
```bash
sudo journalctl -u tgbot -n 100
cat /opt/telegram-bot-system/logs/error.log
```

Common causes:
- Missing node_modules: `cd /opt/telegram-bot-system/backend && npm install`
- Permission issues: `sudo chown -R tgbot:tgbot /opt/telegram-bot-system/`
- Environment file missing: Check `/opt/telegram-bot-system/.env` exists

## Problem: Uploader Can't Connect

**Check 1:** Server is accessible externally
```bash
curl https://tgfiler.qzz.io/health
```

**Check 2:** Uploader config.py has correct URL

**Check 3:** Port forwarding configured on router

## Problem: Bot Not Responding

1. Check bot status in admin panel
2. If pending, approve it
3. Check if owner registered
4. Check server logs for errors

## Problem: Out of Disk Space

Check usage:
```bash
df -h
```

Clean old backups:
```bash
sudo find /opt/telegram-bot-system/data/backups -name "*.tar.gz" -mtime +7 -delete
```

Clean old logs:
```bash
sudo find /opt/telegram-bot-system/logs -name "*.log" -mtime +30 -delete
```

---

# Quick Reference Card

## Important URLs
- Admin Panel: `https://tgfiler.qzz.io/admin`
- Health Check: `https://tgfiler.qzz.io/health`

## Important Paths
- App Directory: `/opt/telegram-bot-system/`
- Backend Code: `/opt/telegram-bot-system/backend/`
- Data Files: `/opt/telegram-bot-system/data/`
- Backups: `/opt/telegram-bot-system/data/backups/`
- Logs: `/opt/telegram-bot-system/logs/`
- Environment: `/opt/telegram-bot-system/.env`
- Scripts: `/opt/telegram-bot-system/scripts/`

## Important Services
- Application: `tgbot`
- Web Server: `caddy`
- Firewall: `ufw`
- Security: `fail2ban`

## Quick Commands
```bash
# Status
sudo systemctl status tgbot

# Restart
sudo systemctl restart tgbot

# Logs
sudo journalctl -u tgbot -f

# Health
sudo bash /opt/telegram-bot-system/scripts/health_check.sh

# Backup
sudo bash /opt/telegram-bot-system/scripts/backup.sh
```

---

**Congratulations! Your Telegram Bot File Management System is now fully deployed and secured!** 🎉