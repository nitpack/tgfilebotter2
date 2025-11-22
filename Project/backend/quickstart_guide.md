# Quick Start Guide - Phase 1

## 🚀 Get Your Backend Running in 5 Minutes

### Step 1: Upload Files to Linux Server

Upload all files from the `backend/` folder to your Linux server:
```
backend/
├── server.js
├── bot-manager.js
├── storage.js
├── security.js
├── config.js
├── admin-bot.js
└── package.json
```

### Step 2: Install Node.js (if not installed)

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x or higher
npm --version
```

### Step 3: Install Dependencies

```bash
cd backend
npm install
```

This installs:
- express (web server)
- node-telegram-bot-api (Telegram bot library)
- helmet (security headers)
- express-rate-limit (DDoS protection)
- express-validator (input validation)
- validator (data sanitization)

### Step 4: Start the Server

```bash
npm start
```

You should see:
```
✓ Storage directories initialized
✓ Configuration loaded
✓ Bots loaded and initialized
✓ Admin bot ready

🚀 Server running on port 3000
📊 Active bots: 0
⏰ Started at: 2024-01-01T00:00:00.000Z
```

**✅ Your backend is now running!**

---

## 🧪 Test Your Setup

### Create a Test Bot

1. **Create a Telegram Bot:**
   - Open Telegram, search for [@BotFather](https://t.me/BotFather)
   - Send `/newbot`
   - Choose name and username
   - Copy the bot token (looks like: `123456789:ABCdef...`)

2. **Create a Private Channel:**
   - Create a new channel in Telegram
   - Make it private
   - Add your bot as administrator
   - Copy channel username (e.g., `@my_private_channel`)

3. **Upload Bot Metadata:**

```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "YOUR_BOT_TOKEN_HERE",
    "channelId": "@your_channel_here",
    "botUsername": "@yourbot",
    "metadata": {
      "subfolders": {
        "Documents": {
          "files": [],
          "subfolders": {
            "PDFs": {
              "files": [],
              "subfolders": {}
            }
          }
        },
        "Images": {
          "files": [],
          "subfolders": {}
        }
      },
      "files": []
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Bot created successfully. Awaiting admin approval.",
  "botId": "a1b2c3d4e5f6g7h8",
  "status": "pending"
}
```

4. **Test the Bot:**
   - Open Telegram
   - Search for your bot
   - Send `/start`
   - You should see folder buttons (Documents, Images)

**Note:** Bot is in "pending" status, so only YOU can test it for now. Other users won't get responses until approved.

---

## ⚙️ Configure Admin Bot (Optional)

To receive notifications about new bots, security alerts, etc.:

1. **Create Admin Bot:**
   - Create another bot via [@BotFather](https://t.me/BotFather)
   - This bot will send you notifications
   - Copy its token

2. **Create Admin Channel:**
   - Create a private channel for notifications
   - Add your admin bot as administrator
   - Copy channel username

3. **Get Your Telegram User ID:**
   - Message [@userinfobot](https://t.me/userinfobot)
   - Copy your user ID (a number like `123456789`)

4. **Edit Config File:**

```bash
cd data/config
nano admin.json
```

Add:
```json
{
  "telegramUserId": 123456789,
  "botToken": "your-admin-bot-token",
  "channelId": "@your_admin_channel",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

5. **Restart Server:**
```bash
# Press Ctrl+C to stop
npm start
```

**✅ You'll now receive notifications!**

---

## 📝 Common Commands

### Start Server
```bash
npm start
```

### Stop Server
```bash
# Press Ctrl+C
```

### View Logs
```bash
# Server logs are shown in terminal
# Or run in background with output to file:
npm start > server.log 2>&1 &
```

### Check Bot Status
```bash
curl http://localhost:3000/api/bot-status/YOUR_BOT_TOKEN
```

### Approve Bot (Manual - until Phase 2 admin panel)
```bash
curl -X POST http://localhost:3000/api/admin/approve-bot \
  -H "Content-Type: application/json" \
  -d '{"botId": "YOUR_BOT_ID"}'
```

### View Data Files
```bash
# List all bots
ls -la data/bots/

# View bot config
cat data/bots/bot_XXXXX.json

# View system config
cat data/config/system.json

# View admin config
cat data/config/admin.json
```

---

## 🔧 Troubleshooting

### "Cannot find module 'express'"
```bash
# Install dependencies
npm install
```

### "Port 3000 already in use"
```bash
# Kill process on port 3000
sudo kill $(sudo lsof -t -i:3000)

# Or use different port
PORT=3001 npm start
```

### "Admin bot not configured"
- This is just a warning
- Server works fine without admin bot
- You just won't receive Telegram notifications
- Configure it when ready (see above)

### Bot not responding in Telegram
1. Check bot token is correct
2. Verify bot is admin in channel
3. Pending bots only respond to admin User ID
4. Approve bot or set your User ID in admin config

### "Invalid bot token"
- Token format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
- Get from [@BotFather](https://t.me/BotFather)
- Don't include spaces or quotes

---

## 🎯 What You Have Now

✅ **Multi-bot backend server**
- Handles unlimited bots simultaneously
- Approval workflow (pending/approved)
- Owner registration system
- Security & sanitization
- Rate limiting

✅ **File navigation**
- Folder navigation with buttons
- Pagination (30 buttons/page)
- Unicode/Arabic support
- File forwarding from channels

✅ **Admin notifications** (if configured)
- New bot alerts
- Security alerts
- Update notifications
- System status

## 📋 Next Steps

**Phase 2** will add:
- Beautiful web-based admin panel
- Easy bot approval interface
- User banning controls
- Send messages to bot owners
- Security monitoring dashboard
- System settings editor

**Phase 3** will add:
- Windows GUI uploader for end-users
- Easy drag-and-drop file upload
- Automatic folder scanning
- Update detection

**Phase 4** will add:
- Production deployment scripts
- Automatic startup (systemd)
- HTTPS with Let's Encrypt
- Firewall configuration
- Daily backups

---

## 📞 Need Help?

Check the full README.md for:
- Complete API documentation
- Security features explained
- Detailed troubleshooting
- Configuration options

**Your backend is ready for testing! 🎉**