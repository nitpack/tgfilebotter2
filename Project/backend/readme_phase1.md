# Telegram Bot File Management System - Phase 1: Backend Server

## Overview

This is Phase 1 of a comprehensive Telegram bot file management system. The backend handles multiple user-created bots with approval workflow, security features, and admin notifications.

## Features Implemented

### Core Functionality
- ✅ Multi-bot management (handles unlimited bots simultaneously)
- ✅ Bot approval workflow (pending/approved/disconnected/banned)
- ✅ Owner registration system (captures Telegram User ID)
- ✅ Admin-only testing for pending bots
- ✅ File navigation with inline keyboard buttons
- ✅ Pagination (30 buttons per page)
- ✅ Unicode/Arabic folder name support
- ✅ Automatic file forwarding from channels

### Security
- ✅ Input sanitization (all inputs validated)
- ✅ JSON validation and size limits
- ✅ Path traversal prevention
- ✅ Injection attack prevention
- ✅ Rate limiting (IP-based)
- ✅ DDoS protection
- ✅ Folder name validation

### Admin Features
- ✅ Admin bot for notifications
- ✅ Security alerts
- ✅ New bot notifications
- ✅ Update change detection (>30% triggers review)
- ✅ System status alerts

### Storage
- ✅ JSON-based file storage
- ✅ Bot configuration management
- ✅ Banned user list
- ✅ Backup system structure
- ✅ Config management (admin & system)

## Project Structure

```
telegram-bot-system/
├── backend/
│   ├── server.js           # Main server entry point
│   ├── bot-manager.js      # Multi-bot handler
│   ├── storage.js          # JSON storage operations
│   ├── security.js         # Input sanitization
│   ├── config.js           # Configuration management
│   ├── admin-bot.js        # Admin notification bot
│   └── package.json        # Dependencies
├── data/
│   ├── bots/               # Bot configs (auto-created)
│   ├── config/             # System config (auto-created)
│   └── backups/            # Backup storage (auto-created)
└── README.md
```

## Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Linux server (Ubuntu/Debian recommended)

### Setup Steps

1. **Clone/Upload files to your Linux server**

2. **Install dependencies**
```bash
cd backend
npm install
```

3. **Start the server**
```bash
npm start
```

The server will:
- Create necessary directories (`/data/bots`, `/data/config`, `/data/backups`)
- Load existing bots from storage
- Start on port 3000 (default)

## Configuration

### Admin Configuration (Optional for Phase 1)

The system works without admin bot configured, but notifications will only log to console.

To enable admin bot notifications later:

1. Create a Telegram bot via [@BotFather](https://t.me/BotFather)
2. Create a private channel and add the bot as admin
3. Get your Telegram User ID (use [@userinfobot](https://t.me/userinfobot))
4. Configure via admin panel (Phase 2) or manually edit `/data/config/admin.json`:

```json
{
  "telegramUserId": 123456789,
  "botToken": "your-admin-bot-token",
  "channelId": "@your_admin_channel",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### System Configuration

Default settings are created automatically in `/data/config/system.json`:

```json
{
  "maxJsonSizeMB": 10,
  "welcomeMessage": "👋 Welcome! Use the buttons below to navigate.",
  "invalidInputMessage": "❌ Invalid input. Please use the buttons.",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## API Endpoints

### Upload Bot Metadata
```http
POST /api/upload
Content-Type: application/json

{
  "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
  "channelId": "@private_channel",
  "botUsername": "@mybot",
  "metadata": {
    "subfolders": {
      "Folder1": {
        "files": [
          {
            "fileName": "document.pdf",
            "fileId": "BQACAgIAAxkBAAIC...",
            "messageId": 123
          }
        ],
        "subfolders": {}
      }
    },
    "files": []
  }
}
```

**Response (New Bot):**
```json
{
  "success": true,
  "message": "Bot created successfully. Awaiting admin approval.",
  "botId": "a1b2c3d4e5f6g7h8",
  "status": "pending"
}
```

**Response (Update):**
```json
{
  "success": true,
  "message": "Bot metadata updated successfully",
  "isUpdate": true,
  "changePercentage": 15.5
}
```

### Check Bot Status
```http
GET /api/bot-status/:botToken
```

**Response:**
```json
{
  "success": true,
  "status": "approved",
  "botId": "a1b2c3d4e5f6g7h8",
  "botUsername": "@mybot",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "ownerRegistered": true
}
```

### Approve Bot (Admin Only - Will be secured in Phase 2)
```http
POST /api/admin/approve-bot
Content-Type: application/json

{
  "botId": "a1b2c3d4e5f6g7h8"
}
```

## Bot Workflow

### 1. Bot Creation
- User uploads bot metadata via uploader (Phase 3)
- Bot created with `status: pending`
- Admin receives notification
- Bot responds only to admin Telegram User ID

### 2. Owner Registration
- Bot owner sends any message containing "register" (case-insensitive)
- System captures owner's Telegram User ID
- Stored for ban enforcement

### 3. Bot Approval
- Admin tests bot functionality
- Admin approves via admin panel (Phase 2)
- Bot becomes public
- All users can interact

### 4. Bot Updates
- Owner runs uploader in "update" mode
- System calculates change percentage
- If changes > 30%, admin notified for review
- Bot stays live during review

### 5. Ban Enforcement
- Admin can ban owner's Telegram User ID
- All bots owned by banned user disconnected
- Banned users cannot create new bots

## Bot Navigation

Users interact with bots via inline keyboard buttons:

1. **Start**: `/start` shows welcome message + main menu
2. **Folders**: Displayed as buttons (max 30 per page)
3. **Files**: Automatically forwarded when folder selected
4. **Navigation**: Back/Next for pagination, Main to return to root

## Security Features

### Input Sanitization
- All text inputs sanitized
- HTML escaped
- Dangerous patterns blocked (script tags, eval, etc.)
- Path traversal prevented

### JSON Validation
- Max size enforced (default 10MB)
- Recursive sanitization
- Prototype pollution prevention
- Malformed structure detection

### Folder Name Validation
- Unicode support (Arabic, etc.)
- Only safe characters allowed
- No path traversal
- Length limits enforced

### Rate Limiting
- Global: 100 requests per 15 minutes
- Upload: 10 requests per hour
- Per-IP tracking
- Automatic cleanup

## Testing

### Manual Testing Steps

1. **Test bot creation:**
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "YOUR_BOT_TOKEN",
    "channelId": "@your_channel",
    "botUsername": "@yourbot",
    "metadata": {
      "subfolders": {
        "Test Folder": {
          "files": [],
          "subfolders": {}
        }
      },
      "files": []
    }
  }'
```

2. **Check bot status:**
```bash
curl http://localhost:3000/api/bot-status/YOUR_BOT_TOKEN
```

3. **Test Telegram bot:**
   - Open Telegram
   - Search for your bot
   - Send `/start`
   - If admin: see test mode message + menu
   - If not admin (pending bot): no response

4. **Test owner registration:**
   - Send message containing "register"
   - Bot should confirm registration

5. **Approve bot:**
```bash
curl -X POST http://localhost:3000/api/admin/approve-bot \
  -H "Content-Type: application/json" \
  -d '{"botId": "YOUR_BOT_ID"}'
```

6. **Test as regular user:**
   - Now non-admin users should get responses
   - Navigate folders via buttons
   - Files automatically forwarded

## Troubleshooting

### Bot not responding
- Check bot token is valid
- Verify bot is admin in channel
- Check bot status (pending bots only respond to admin)
- Review console logs for errors

### Upload fails
- Check JSON size (max 10MB default)
- Verify bot token format
- Check folder name validation
- Review error message in response

### Admin notifications not working
- Admin bot must be configured
- Check admin bot token and channel ID
- Verify bot is admin in admin channel
- Check console logs (will show if not configured)

### Rate limit errors
- Wait for rate limit window to pass
- Check if IP is making too many requests
- Review rate limit settings in code

## What's Next (Phase 2)

Phase 2 will add the Admin Panel with:
- Web-based dashboard
- Authentication system
- Bot approval interface
- User banning controls
- Custom messaging to bot owners
- Security monitoring
- System settings editor
- Backup management

## Support

For issues or questions:
1. Check console logs (`npm start` output)
2. Review `/data/config/` files
3. Check Telegram bot logs
4. Verify admin bot notifications (if configured)

## Notes

- Server must run 24/7 for bots to work
- Use systemd or PM2 for production (coming in Phase 4)
- Keep `/data` directory backed up
- Admin configuration can be added anytime
- Bots automatically reload after server restart