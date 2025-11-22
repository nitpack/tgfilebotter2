# Phase 2: Admin Panel - Complete Guide

## 🎨 What's New in Phase 2

Phase 2 adds a beautiful, secure web-based admin panel for managing your entire bot network.

### ✅ Features Added

**🔐 Authentication System**
- Secure login with username/password
- Session management (30-minute auto-expire)
- Rate limiting (5 failed attempts = 15min ban)
- Admin activity logging

**📊 Dashboard Overview**
- Real-time statistics
- Total bots, approved, pending, banned users
- Recent activity feed
- System health status

**🤖 Bot Management**
- View all bots with status filters
- Approve pending bots
- Disconnect problematic bots
- Ban bot owners
- View detailed bot information
- Test bot links

**👥 User Management**
- View banned users list
- Ban/unban users
- When user banned → all their bots disconnected
- Ban reason tracking

**✉️ Messaging System**
- Send custom messages to bot owners
- One-way communication (secure)
- Message sanitization
- Select bot from dropdown

**⚙️ System Settings**
- Edit welcome message
- Edit invalid input message
- Change max JSON size (1-50 MB)
- Update admin credentials
- Admin Telegram User ID
- Admin bot token & channel

**🔒 Security Monitor**
- Real-time security events
- Attack attempt logging
- Rate limit violations
- Injection attempt tracking

**💾 Backup Management**
- View backup history
- Manual backup trigger
- Backup status display
- Automatic daily backups

---

## 📁 File Structure

```
backend/
├── server.js                    # Main server (UPDATED)
├── bot-manager.js
├── storage.js
├── security.js
├── config.js
├── admin-bot.js
├── admin-routes.js              # NEW: Admin API endpoints
├── package.json
└── public/                      # NEW: Admin panel files
    ├── admin-panel.html         # Admin panel interface
    └── admin-panel.js           # Frontend logic
```

---

## 🚀 Setup Instructions

### Step 1: Update Your Backend

If you already have Phase 1 installed:

1. **Add new files:**
   - `admin-routes.js` → Place in `backend/` folder
   - Create `public/` folder in `backend/`
   - `admin-panel.html` → Place in `backend/public/`
   - `admin-panel.js` → Place in `backend/public/`

2. **Update existing file:**
   - Replace `server.js` with the updated version

3. **Restart server:**
```bash
cd backend
npm start
```

### Step 2: Set Admin Credentials (Important!)

**Default credentials (CHANGE THESE!):**
- Username: `admin`
- Password: `admin123`

**To change credentials:**

Edit environment variables before starting server:

```bash
export ADMIN_USERNAME="your_username"
export ADMIN_PASSWORD="your_secure_password"
npm start
```

Or create `.env` file:
```
ADMIN_USERNAME=your_username
ADMIN_PASSWORD=your_secure_password
```

**Security Note:** The password is hashed with SHA-256 before storage.

---

## 🌐 Accessing the Admin Panel

### On Your Local Network

If server is on `192.168.1.100`:

```
http://192.168.1.100:3000/admin
```

### From Internet (with domain)

Once you set up domain + HTTPS (Phase 4):

```
https://yourdomain.com/admin
```

**Current access (testing):**
```
http://localhost:3000/admin
```

---

## 📖 Using the Admin Panel

### 1. Login

<img src="login-screen" alt="Login">

- Enter username and password
- If wrong 5 times → 15 minute IP ban
- You'll receive Telegram notification (if admin bot configured)

### 2. Dashboard Overview

**Stats at a glance:**
- Total Bots
- Approved (active and public)
- Pending (awaiting your review)
- Banned Users

**Recent Activity:**
- New bot creations
- Approvals
- Security events

### 3. Bot Management

**Filter bots by status:**
- All Bots
- Pending only
- Approved only
- Disconnected only

**Actions per bot:**
- **Approve** (pending bots) → Makes bot public
- **Disconnect** (approved bots) → Temporarily disable
- **Ban Owner** → Permanently ban user + disconnect all their bots
- **Details** → View full bot information

**Bot Details Modal:**
- Bot username
- Status badge
- Owner Telegram ID
- Channel ID
- Creation date
- Total files count
- Total folders count

### 4. User Management

**Banned Users List:**
- User ID
- Ban reason
- Ban date/time
- **Unban** button

**Banning a user:**
1. Go to Bot Management
2. Click "Ban Owner" on any of their bots
3. Enter ban reason
4. Confirm

**Effect:**
- User added to banned list
- All their bots disconnected
- Cannot create new bots (enforced in uploader)
- Admin notification sent

### 5. Messaging

**Send message to bot owner:**
1. Select bot from dropdown (only bots with registered owners shown)
2. Type your message
3. Click "Send Message"

**Message delivery:**
- Sent via the bot to owner's private chat
- Prefixed with "📨 Message from Administrator:"
- One-way only (owner can't reply through bot)

**Use cases:**
- Rejection reasons
- Policy violations
- Update requests
- General notifications

### 6. System Settings

**Admin Configuration:**
- **Admin Telegram User ID** → Your Telegram ID (for testing pending bots)
- **Admin Bot Token** → Token for notification bot
- **Admin Channel ID** → Where notifications are sent

**System Configuration:**
- **Max JSON Size** → 1-50 MB (default: 10 MB)
- **Welcome Message** → Shown when users send /start
- **Invalid Input Message** → Shown for non-button text

**Tip:** Change welcome message to include your contact info or rules.

### 7. Security Monitor

**Events tracked:**
- Failed login attempts
- Malicious JSON uploads
- Injection attempts
- Path traversal attempts
- Rate limit violations

**Event display:**
- Timestamp
- Event type
- Details
- Severity (High/Medium/Low)

**Color coding:**
- 🔴 High severity (red border)
- 🟡 Medium severity (yellow border)
- 🔵 Low severity (blue border)

### 8. Backups

**Manual backup:**
- Click "Create Backup Now"
- Wait for confirmation
- Check Telegram for notification (if configured)

**Backup history:**
- Shows all past backups
- Date/time created
- Number of bots backed up
- Checksum for integrity

**Automatic backups:**
- Daily at 2:00 AM (Phase 4)
- Stored in `data/backups/`
- Sent to admin Telegram channel

---

## 🔒 Security Features

### Login Security
- ✅ Rate limiting (5 attempts = 15min ban)
- ✅ Password hashing (SHA-256)
- ✅ Session tokens (32-byte random)
- ✅ 30-minute session timeout
- ✅ Failed login tracking per IP
- ✅ Admin notification on login

### Session Management
- Sessions stored in server memory
- Automatic expiry after 30 minutes of inactivity
- Token required for all admin API calls
- Invalid tokens rejected

### Input Sanitization
- All admin inputs sanitized
- XSS prevention
- Injection prevention
- Message content validated

### API Protection
- All admin endpoints require authentication
- Invalid sessions rejected
- Rate limiting enforced
- Error messages sanitized

---

## 🐛 Troubleshooting

### Can't login

**"Invalid credentials"**
- Check username and password
- Default: admin / admin123
- Remember: case-sensitive

**"Too many failed attempts"**
- Wait 15 minutes
- Your IP is temporarily banned
- Admin receives security alert

### Admin panel not loading

**404 Not Found**
- Make sure you added the `public/` folder
- Verify files are in correct location:
  - `backend/public/admin-panel.html`
  - `backend/public/admin-panel.js`

**Blank page**
- Check browser console (F12)
- Server might not be running
- Check server logs for errors

### "Session expired" message

- Your session timed out (30 minutes)
- Simply login again
- No data is lost

### Bot actions not working

**"Unauthorized"**
- Your session expired
- Refresh page and login

**"Bot not found"**
- Bot might have been deleted
- Refresh the bots list

### Admin bot not sending notifications

**Check configuration:**
1. Go to Settings
2. Verify all admin fields filled
3. Admin Bot Token must be valid
4. Admin Channel ID must exist
5. Bot must be admin in channel

**Test admin bot:**
- Save admin config
- Check console for "Admin bot initialized"
- Try creating a backup
- Should receive notification

### Stats showing 0

- Refresh the page
- Check if bots exist in `data/bots/`
- Verify server is running
- Check console for errors

---

## 🎨 Customization

### Change Admin Panel Port

```bash
PORT=8080 npm start
```

Then access at: `http://localhost:8080/admin`

### Change Session Timeout

Edit `admin-routes.js`:
```javascript
expires: Date.now() + 60 * 60 * 1000 // 60 minutes
```

### Change Failed Login Threshold

Edit `admin-routes.js`:
```javascript
if (attempts.count >= 10) { // Was 5
  attempts.blockedUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
}
```

### Custom Styling

The admin panel uses inline CSS. To customize:

1. Open `backend/public/admin-panel.html`
2. Find the `<style>` section
3. Modify CSS variables in `:root`:

```css
:root {
  --primary: #2563eb;      /* Main color */
  --success: #10b981;      /* Success color */
  --warning: #f59e0b;      /* Warning color */
  --danger: #ef4444;       /* Danger color */
}
```

---

## 🚦 API Endpoints Reference

All admin endpoints require `Authorization: Bearer {token}` header.

### Authentication
```
POST /api/admin/login
Body: { username, password }
Response: { success: true, token: "..." }
```

```
GET /api/admin/verify
Response: { success: true }
```

### Statistics
```
GET /api/admin/stats
Response: { success: true, stats: { total, approved, pending, bannedUsers } }
```

### Bots
```
GET /api/admin/bots?status=all
Response: { success: true, bots: [...] }

GET /api/admin/bot/:botId
Response: { success: true, bot: {...} }

POST /api/admin/disconnect-bot
Body: { botId }
Response: { success: true }
```

### Users
```
POST /api/admin/ban-user
Body: { userId, reason }
Response: { success: true, botsDisconnected: N }

GET /api/admin/banned-users
Response: { success: true, users: [...] }

POST /api/admin/unban-user
Body: { userId }
Response: { success: true }
```

### Messaging
```
POST /api/admin/send-message
Body: { botId, message }
Response: { success: true }
```

### Configuration
```
GET /api/admin/config/admin
Response: { success: true, config: {...} }

POST /api/admin/config/admin
Body: { telegramUserId, botToken, channelId }
Response: { success: true }

GET /api/admin/config/system
Response: { success: true, config: {...} }

POST /api/admin/config/system
Body: { maxJsonSizeMB, welcomeMessage, invalidInputMessage }
Response: { success: true }
```

### Backups
```
POST /api/admin/create-backup
Response: { success: true, backupDir, manifest: {...} }

GET /api/admin/backups
Response: { success: true, backups: [...] }
```

---

## ✅ Testing Phase 2

### Login Test
- [ ] Can login with correct credentials
- [ ] Wrong password rejected
- [ ] 5 failed attempts = IP ban
- [ ] Session expires after 30 minutes
- [ ] Admin notification sent on login

### Dashboard Test
- [ ] Stats display correctly
- [ ] Recent activity shows
- [ ] Navigation works
- [ ] All pages accessible

### Bot Management Test
- [ ] All bots listed
- [ ] Filter by status works
- [ ] Can approve pending bot
- [ ] Can disconnect approved bot
- [ ] Can view bot details
- [ ] Ban owner works

### User Management Test
- [ ] Banned users listed
- [ ] Can unban user
- [ ] Banning disconnects all user bots

### Messaging Test
- [ ] Bot list loads
- [ ] Can send message
- [ ] Message received by bot owner
- [ ] Message formatted correctly

### Settings Test
- [ ] Current settings load
- [ ] Can update admin config
- [ ] Can update system config
- [ ] Changes persist after restart

### Security Test
- [ ] Invalid token rejected
- [ ] Expired session rejected
- [ ] Security events logged
- [ ] Input sanitized

### Backup Test
- [ ] Can create backup manually
- [ ] Backup history displays
- [ ] Backup notification sent

---

## 🎯 What's Next - Phase 3

Phase 3 will add the **Windows GUI Uploader** (Python + PyQt5):
- Beautiful drag-and-drop interface
- Folder scanning and upload
- Progress tracking
- Update mode with change detection
- Simple .exe file for users

---

## 📞 Support

**Admin panel issues:**
- Check browser console (F12)
- Check server logs
- Verify authentication
- Ensure files in correct location

**Need help?**
- Review this documentation
- Check Phase 1 README for backend issues
- Verify all files uploaded correctly

---

**Phase 2 Complete! 🎉**

You now have a fully functional admin panel to manage your bot network. Test all features before proceeding to Phase 3.