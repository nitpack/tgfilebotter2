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
