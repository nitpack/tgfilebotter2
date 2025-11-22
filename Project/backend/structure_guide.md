# Project Structure Guide

## Complete Directory Layout

```
telegram-bot-system/
│
├── backend/                          # Phase 1: Backend Server
│   ├── server.js                     # Main entry point, Express server setup
│   ├── bot-manager.js                # Handles multiple Telegram bots
│   ├── storage.js                    # JSON file storage operations
│   ├── security.js                   # Input sanitization & validation
│   ├── config.js                     # Configuration management
│   ├── admin-bot.js                  # Admin notification system
│   ├── package.json                  # Node.js dependencies
│   ├── .env.example                  # Environment variables template
│   ├── README.md                     # Complete documentation
│   ├── QUICKSTART.md                 # 5-minute setup guide
│   ├── TESTING.md                    # Testing checklist
│   └── STRUCTURE.md                  # This file
│
├── data/                             # Auto-created by server
│   ├── bots/                         # Bot configurations
│   │   ├── bot_a1b2c3d4.json        # Individual bot config
│   │   ├── bot_e5f6g7h8.json        # Another bot
│   │   └── ...                       # One file per bot
│   │
│   ├── config/                       # System configuration
│   │   ├── admin.json                # Admin settings
│   │   ├── system.json               # System settings
│   │   └── banned_users.json         # Banned user list
│   │
│   └── backups/                      # Daily backups
│       ├── backup_2024-01-01/        # Timestamped backups
│       │   ├── bots/                 # Copy of all bots
│       │   ├── config/               # Copy of all configs
│       │   └── manifest.json         # Backup metadata
│       └── backup_2024-01-02/
│
├── admin-panel/                      # Phase 2: Admin Dashboard (Coming)
│   └── [To be built]
│
├── uploader/                         # Phase 3: Windows GUI (Coming)
│   └── [To be built]
│
└── scripts/                          # Phase 4: Deployment (Coming)
    └── [To be built]
```

---

## File Descriptions

### Backend Files (Phase 1)

#### `server.js` - Main Server
**Purpose:** Entry point for the entire backend system  
**Responsibilities:**
- Express server initialization
- Route definitions (API endpoints)
- Middleware setup (security, rate limiting)
- Component initialization
- Graceful shutdown handling

**Key Components:**
- Health check endpoint (`/health`)
- Upload endpoint (`/api/upload`)
- Bot status endpoint (`/api/bot-status/:botToken`)
- Admin endpoints (`/api/admin/*`)

---

#### `bot-manager.js` - Multi-Bot Handler
**Purpose:** Manages multiple Telegram bots simultaneously  
**Responsibilities:**
- Load all bots on startup
- Initialize bot instances
- Handle bot commands (`/start`)
- Process user interactions (buttons, messages)
- Folder navigation logic
- File forwarding from channels
- Bot lifecycle management

**Key Features:**
- Concurrent bot operation
- Approval workflow enforcement
- Owner registration handling
- Pagination system
- Unicode/Arabic support

---

#### `storage.js` - Storage Management
**Purpose:** All file operations and data persistence  
**Responsibilities:**
- JSON file read/write
- Bot CRUD operations
- Configuration management
- Banned user list
- Backup creation
- Data integrity

**Key Operations:**
- `createBot()` - Create new bot
- `updateBot()` - Update bot metadata
- `getBotById()` / `getBotByToken()` - Retrieve bots
- `updateBotStatus()` - Change approval status
- `registerBotOwner()` - Store owner ID
- `createBackup()` - System backup

---

#### `security.js` - Security Layer
**Purpose:** Input validation and attack prevention  
**Responsibilities:**
- Input sanitization
- JSON validation
- Injection prevention
- Folder name validation
- Path traversal blocking
- Rate limiting helpers
- Security event logging

**Protection Against:**
- SQL injection
- XSS attacks
- Path traversal
- Prototype pollution
- Template injection
- Oversized inputs
- Malformed data

---

#### `config.js` - Configuration Manager
**Purpose:** System and admin configuration  
**Responsibilities:**
- Load/save configurations
- Admin settings (User ID, bot token, channel)
- System settings (JSON limits, messages)
- Configuration validation
- Default value management

**Configurable Settings:**
- Max JSON size (default: 10MB)
- Welcome message
- Invalid input message
- Admin Telegram User ID
- Admin bot token & channel

---

#### `admin-bot.js` - Notification System
**Purpose:** Send alerts to admin channel  
**Responsibilities:**
- Admin bot initialization
- Alert formatting
- Notification delivery
- Backup reports
- Security alerts
- Daily reports

**Alert Types:**
- New bot created
- Security events
- Major updates
- System status
- Backup results
- DDoS attempts

---

### Data Files (Auto-Generated)

#### `data/bots/bot_XXXXXXXX.json`
**Purpose:** Individual bot configuration  
**Structure:**
```json
{
  "id": "a1b2c3d4e5f6g7h8",
  "botToken": "123456789:ABC...",
  "channelId": "@private_channel",
  "botUsername": "@mybot",
  "status": "approved",
  "ownerId": 123456789,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "ownerRegisteredAt": "2024-01-01T01:00:00.000Z",
  "lastUpdate": "2024-01-02T00:00:00.000Z",
  "metadata": {
    "subfolders": {
      "Documents": {
        "files": [
          {
            "fileName": "doc.pdf",
            "fileId": "BQACAgIA...",
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

---

#### `data/config/admin.json`
**Purpose:** Admin configuration  
**Structure:**
```json
{
  "telegramUserId": 123456789,
  "botToken": "987654321:XYZ...",
  "channelId": "@admin_channel",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-02T00:00:00.000Z"
}
```

---

#### `data/config/system.json`
**Purpose:** System-wide settings  
**Structure:**
```json
{
  "maxJsonSizeMB": 10,
  "welcomeMessage": "👋 Welcome! Use buttons to navigate.",
  "invalidInputMessage": "❌ Invalid input. Use buttons.",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-02T00:00:00.000Z"
}
```

---

#### `data/config/banned_users.json`
**Purpose:** Banned user list  
**Structure:**
```json
{
  "users": [
    {
      "userId": 111111111,
      "reason": "Illegal content",
      "bannedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "userId": 222222222,
      "reason": "Spam",
      "bannedAt": "2024-01-02T00:00:00.000Z"
    }
  ]
}
```

---

#### `data/backups/backup_TIMESTAMP/manifest.json`
**Purpose:** Backup metadata  
**Structure:**
```json
{
  "timestamp": "2024-01-01T02-00-00-000Z",
  "createdAt": "2024-01-01T02:00:00.000Z",
  "botCount": 15,
  "checksum": "a1b2c3d4e5f6..."
}
```

---

## Data Flow

### Bot Creation Flow
```
User's Uploader
    ↓
POST /api/upload
    ↓
[Security Layer] → Sanitize input
    ↓
[Storage] → Create bot_XXXXX.json
    ↓
[Bot Manager] → Initialize bot instance
    ↓
[Admin Bot] → Send notification
    ↓
Response to uploader
```

### User Interaction Flow
```
Telegram User
    ↓
/start command
    ↓
[Bot Manager] → Check bot status
    ↓
[Bot Manager] → Verify user permissions
    ↓
[Bot Manager] → Send welcome + menu
    ↓
User clicks folder button
    ↓
[Bot Manager] → Navigate metadata
    ↓
[Bot Manager] → Forward files from channel
    ↓
User receives files
```

### Approval Flow
```
Bot created (pending)
    ↓
[Admin Bot] → Notify admin
    ↓
Admin tests bot (only admin can use)
    ↓
Admin approves via admin panel
    ↓
[Storage] → Update bot status
    ↓
[Bot Manager] → Bot now public
    ↓
All users can interact
```

---

## Module Dependencies

```
server.js
├── bot-manager.js
│   ├── storage.js
│   ├── security.js
│   ├── config.js
│   └── admin-bot.js
├── storage.js
├── security.js
├── config.js
│   └── storage.js
└── admin-bot.js
    ├── config.js
    └── storage.js
```

**Key Points:**
- `server.js` is the only entry point
- `storage.js` has no dependencies (lowest level)
- `security.js` is standalone
- `config.js` depends only on storage
- `bot-manager.js` orchestrates everything
- `admin-bot.js` is optional (can be unconfigured)

---

## File Sizes (Typical)

```
server.js          ~10 KB
bot-manager.js     ~15 KB
storage.js         ~12 KB
security.js        ~10 KB
config.js          ~6 KB
admin-bot.js       ~8 KB
package.json       ~1 KB

Total Backend:     ~62 KB (excluding node_modules)
```

```
Bot config file:      ~1-50 KB (depends on folder structure)
System config:        ~0.5 KB
Admin config:         ~0.3 KB
Banned users:         ~1 KB per 100 users
Backup (100 bots):    ~5 MB
```

---

## Security Zones

### Public Access (No Auth)
- `/health` - Health check
- Telegram bot interactions (filtered by approval status)

### Protected (Rate Limited)
- `/api/upload` - 10/hour per IP
- `/api/bot-status` - 100/15min per IP

### Admin Only (Coming in Phase 2)
- `/api/admin/*` - All admin endpoints
- Admin panel interface

---

## Backup Strategy

### What Gets Backed Up
✅ All bot configurations (`data/bots/`)  
✅ All system configs (`data/config/`)  
✅ Banned user lists  
✅ Backup manifests

### What Doesn't Get Backed Up
❌ `node_modules/` (reinstall with npm)  
❌ Server logs (separate logging system)  
❌ Temporary files  
❌ Cache files

### Backup Schedule (Phase 4)
- Daily at 2:00 AM
- Kept for 7 days (configurable)
- Sent to Telegram admin channel
- Stored locally in `data/backups/`

---

## Phase Progression

### Phase 1 (Current) ✅
- Backend server
- Multi-bot management
- Security layer
- Storage system
- Admin notifications

### Phase 2 (Next)
```
admin-panel/
├── index.html
├── dashboard.js
├── auth.js
└── styles.css
```

### Phase 3 (After Phase 2)
```
uploader/
├── main.py
├── gui.py
├── telegram_api.py
└── FileUploader.exe
```

### Phase 4 (Final)
```
scripts/
├── install_and_run.sh
├── setup_firewall.sh
├── auto_backup.sh
└── systemd/
    └── telegram-bots.service
```

---

## Environment Setup

### Development
```bash
NODE_ENV=development
PORT=3000
# Admin bot optional
```

### Production
```bash
NODE_ENV=production
PORT=3000
ADMIN_TELEGRAM_USER_ID=123456789
ADMIN_BOT_TOKEN=...
ADMIN_CHANNEL_ID=@channel
DOMAIN=yourdomain.com
```

---

## Notes for Developers

1. **Adding New Features:**
   - Add logic to appropriate module
   - Update security checks in `security.js`
   - Add storage methods in `storage.js` if needed
   - Update admin notifications if relevant

2. **Modifying Bot Behavior:**
   - Edit `bot-manager.js`
   - Test with pending bot first
   - Verify approval workflow still works

3. **Changing Storage Structure:**
   - Update `storage.js`
   - Add migration logic for existing data
   - Update backup system

4. **Adding Admin Features:**
   - Wait for Phase 2 (admin panel)
   - Or add to `/api/admin/*` endpoints

---

This structure is designed for:
- Easy maintenance
- Clear separation of concerns
- Security at every layer
- Scalability to 100+ bots
- Simple deployment