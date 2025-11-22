# Phase 2 Deployment Checklist

## 📋 Pre-Deployment

- [ ] Phase 1 backend is working
- [ ] Server accessible on network
- [ ] Node.js and npm installed
- [ ] All dependencies installed (`npm install`)

---

## 📁 File Organization

### New Files to Add

```
backend/
├── admin-routes.js          ← NEW FILE
└── public/                  ← NEW FOLDER
    ├── admin-panel.html     ← NEW FILE
    └── admin-panel.js       ← NEW FILE
```

### Updated Files

```
backend/
└── server.js                ← UPDATED (replace with new version)
```

### Step-by-Step

1. **Create `public` folder:**
```bash
cd backend
mkdir public
```

2. **Add admin-routes.js:**
   - Copy `admin-routes.js` to `backend/` folder

3. **Add admin panel files:**
   - Copy `admin-panel.html` to `backend/public/`
   - Copy `admin-panel.js` to `backend/public/`

4. **Update server.js:**
   - Backup current `server.js`: `cp server.js server.js.backup`
   - Replace with updated version

5. **Verify file structure:**
```bash
ls -la
# Should see: admin-routes.js, public/
ls -la public/
# Should see: admin-panel.html, admin-panel.js
```

---

## 🔐 Security Configuration

### 1. Change Default Credentials

**⚠️ CRITICAL: Change default admin password!**

**Option A: Environment Variables**
```bash
export ADMIN_USERNAME="your_username"
export ADMIN_PASSWORD="your_strong_password_here"
```

**Option B: .env File**

Create `backend/.env`:
```
ADMIN_USERNAME=your_username
ADMIN_PASSWORD=your_strong_password_here
PORT=3000
```

Install dotenv if not already:
```bash
npm install dotenv
```

Add to top of `server.js`:
```javascript
require('dotenv').config();
```

**Generate Strong Password:**
```bash
# On Linux
openssl rand -base64 32

# Or use a password manager
```

### 2. Configure Admin Bot (Optional but Recommended)

You can do this via admin panel after login, OR manually:

Edit `data/config/admin.json`:
```json
{
  "telegramUserId": 123456789,
  "botToken": "your-admin-bot-token",
  "channelId": "@your_admin_channel",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**How to get these:**
- **telegramUserId**: Message [@userinfobot](https://t.me/userinfobot)
- **botToken**: Create bot via [@BotFather](https://t.me/BotFather)
- **channelId**: Create private channel, add bot as admin

---

## 🚀 Start Server

### Stop Existing Server

If Phase 1 is running:
```bash
# Find process
ps aux | grep node

# Kill it
kill <PID>

# Or if running in terminal, press Ctrl+C
```

### Start with New Code

```bash
cd backend
npm start
```

**Expected output:**
```
✓ Storage directories initialized
✓ Configuration loaded
✓ Bots loaded and initialized
✓ Admin bot ready

🚀 Server running on port 3000
📊 Active bots: X
⏰ Started at: ...
```

---

## 🧪 Testing

### 1. Access Admin Panel

**Open browser:**
```
http://localhost:3000/admin
```

Or if on another device:
```
http://YOUR_SERVER_IP:3000/admin
```

**Expected:**
- Login page loads
- No console errors (F12)
- Clean interface

### 2. Test Login

**Try wrong password first:**
- Enter: admin / wrong_password
- Should see: "Invalid credentials"
- Try 5 times → Should see: "Too many failed attempts"

**Wait 15 minutes or restart server to clear ban**

**Login with correct credentials:**
- Enter your username/password
- Should redirect to dashboard
- Stats should load

### 3. Test Dashboard

- [ ] Stats display (total, approved, pending, banned)
- [ ] Recent activity loads
- [ ] Navigation works (click sidebar items)
- [ ] No JavaScript errors

### 4. Test Bot Management

- [ ] Click "Bot Management"
- [ ] All bots listed (if any exist)
- [ ] Filter dropdown works
- [ ] Action buttons visible
- [ ] Can view bot details

**If no bots:** Create one via API to test:
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "YOUR_TEST_BOT_TOKEN",
    "channelId": "@test_channel",
    "botUsername": "@testbot",
    "metadata": {"subfolders": {}, "files": []}
  }'
```

### 5. Test Approval Workflow

**If you have pending bots:**
- [ ] Click "Approve" on pending bot
- [ ] Confirmation dialog appears
- [ ] Bot status changes to "approved"
- [ ] Success message shows
- [ ] Bot now responds to all users (test in Telegram)

### 6. Test Disconnect

**If you have approved bots:**
- [ ] Click "Disconnect"
- [ ] Bot status changes to "disconnected"
- [ ] Bot stops responding to users

### 7. Test Ban User

**If you have bots with registered owners:**
- [ ] Click "Ban Owner"
- [ ] Enter ban reason
- [ ] All user's bots disconnected
- [ ] User appears in banned list

### 8. Test Settings

- [ ] Click "Settings"
- [ ] Current settings load correctly
- [ ] Change max JSON size → Save → Refresh → Verify change persisted
- [ ] Change welcome message → Test in Telegram bot
- [ ] Update admin config → Save → Check Telegram notifications

### 9. Test Security

- [ ] Multiple failed logins trigger ban
- [ ] Session expires after 30 minutes
- [ ] Invalid tokens rejected
- [ ] Security log accessible

### 10. Test Backups

- [ ] Click "Backups"
- [ ] Click "Create Backup Now"
- [ ] Wait for confirmation
- [ ] Check `data/backups/` folder for new backup
- [ ] Backup history displays

---

## 🔍 Troubleshooting

### Admin panel won't load (404)

**Check files exist:**
```bash
ls backend/public/
# Should show: admin-panel.html, admin-panel.js
```

**Check server.js updated:**
```bash
grep "admin-panel" backend/server.js
# Should find the route
```

### Login fails with correct password

**Check environment variables:**
```bash
echo $ADMIN_USERNAME
echo $ADMIN_PASSWORD
```

**Verify they're loaded in server:**
Add debug line in `admin-routes.js`:
```javascript
console.log('Admin credentials:', this.adminCredentials);
```

### Blank page after login

**Check browser console (F12):**
- Look for JavaScript errors
- Check Network tab for failed requests

**Check server logs:**
- API calls failing?
- Authentication errors?

### Stats showing 0

**Check if bots exist:**
```bash
ls data/bots/
# Should show: bot_*.json files
```

**Test API directly:**
```bash
# First login to get token
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Use token to get stats
curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Admin bot not sending notifications

**Check configuration:**
1. Go to Settings in admin panel
2. Verify admin bot token is valid
3. Verify channel ID is correct
4. Check bot is admin in channel

**Test manually:**
```bash
# Check admin.json
cat data/config/admin.json
```

**Restart server** after changing admin config.

### Session keeps expiring

**Expected behavior:**
- 30 minutes of inactivity → logout
- This is for security

**To extend:**
Edit `admin-routes.js` line ~50:
```javascript
expires: Date.now() + 60 * 60 * 1000 // 60 minutes
```

---

## 🌐 Network Access

### Local Network Only (Recommended for testing)

**Find your server IP:**
```bash
ip addr show
# Look for inet 192.168.x.x
```

**Access from other devices:**
```
http://192.168.x.x:3000/admin
```

**Firewall (if enabled):**
```bash
# Allow port 3000
sudo ufw allow 3000/tcp
```

### Internet Access (Phase 4)

For internet access, you'll need:
- Domain name
- HTTPS (Let's Encrypt)
- Reverse proxy (Caddy)
- Firewall configuration

**Coming in Phase 4!**

---

## 📊 Production Checklist

Before making this production-ready:

- [ ] Changed default admin password
- [ ] Strong password (20+ characters)
- [ ] Admin bot configured
- [ ] Tested all features
- [ ] Backup system tested
- [ ] Security measures verified
- [ ] Session timeout appropriate
- [ ] Rate limiting tested
- [ ] Login ban tested
- [ ] All bots working correctly

---

## 🔄 Updating from Phase 1

### If Phase 1 is already running:

1. **Stop server** (Ctrl+C or kill process)
2. **Backup current files:**
```bash
cp server.js server.js.phase1.backup
```
3. **Add new files** (admin-routes.js, public folder)
4. **Replace server.js**
5. **Set admin credentials** (environment variables)
6. **Restart server:** `npm start`
7. **Test admin panel:** http://localhost:3000/admin
8. **Verify existing bots still work**

### Rollback if Issues

```bash
# Stop server
# Restore backup
cp server.js.phase1.backup server.js
# Remove new files
rm admin-routes.js
rm -rf public/
# Restart
npm start
```

---

## ✅ Post-Deployment Verification

### Essential Tests

- [ ] Can access admin panel
- [ ] Can login successfully
- [ ] Dashboard loads with correct stats
- [ ] Can view all bots
- [ ] Can approve pending bots
- [ ] Bot approval works (test in Telegram)
- [ ] Can disconnect bots
- [ ] Disconnection works (bot stops responding)
- [ ] Settings load correctly
- [ ] Can save configuration
- [ ] Configuration persists after restart
- [ ] Backup creation works
- [ ] Admin notifications working (if configured)

### Security Tests

- [ ] Wrong password rejected
- [ ] 5 failed logins = IP ban
- [ ] Session expires after timeout
- [ ] Invalid token rejected
- [ ] All inputs sanitized
- [ ] No XSS vulnerabilities
- [ ] No SQL injection possible

---

## 📱 Mobile Access

The admin panel is responsive and works on mobile devices:

**On phone/tablet:**
```
http://YOUR_SERVER_IP:3000/admin
```

**Features:**
- Responsive design
- Touch-friendly buttons
- Mobile navigation
- Works on any screen size

---

## 🎉 Deployment Complete!

If all tests pass, your admin panel is ready!

**What you can do now:**
- Approve pending bots
- Manage users
- Send messages to bot owners
- Configure system settings
- Monitor security
- Create backups

**Next: Phase 3 - Windows Uploader**

---

## 📞 Need Help?

**Common resources:**
- Phase 2 README: Full feature documentation
- Phase 1 README: Backend API reference
- Browser console (F12): JavaScript errors
- Server logs: Backend errors
- Telegram admin channel: Notifications

**Debug mode:**
```bash
NODE_ENV=development npm start
# More verbose logging
```