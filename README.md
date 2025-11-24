[README.md](https://github.com/user-attachments/files/23689809/README.md)
# 🤖 Telegram Bot File Management System

A comprehensive, production-ready system that allows users to create their own Telegram file-sharing bots with a beautiful folder navigation interface. Files are stored on Telegram's servers (not yours), and the system provides a complete moderation workflow for bot approval.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/python-%3E%3D3.8-blue.svg)](https://www.python.org/)

---

## 🌟 Features

### For System Administrators
- 🎛️ **Beautiful Admin Panel** - Web-based dashboard to manage everything
- ✅ **Bot Approval Workflow** - Review and approve all bots before they go public
- 👥 **User Management** - Ban users and automatically disconnect all their bots
- 💬 **Direct Messaging** - Send messages to bot owners through the system
- 📊 **Analytics Dashboard** - Real-time statistics and activity monitoring
- 🔒 **Security Monitoring** - Track attacks, injections, and suspicious activity
- 💾 **Automated Backups** - Daily backups with integrity verification

### For Bot Creators
- 🖥️ **Windows GUI Uploader** - Simple drag-and-drop file upload interface
- 📁 **Folder Navigation** - Organize files in folders and subfolders
- 🔄 **Update Mode** - Only upload changed files (smart diff detection)
- 🌍 **Unicode Support** - Arabic, Chinese, and all international characters
- 📝 **Owner Registration** - Automatic bot owner tracking
- 🔔 **Status Notifications** - Get notified when your bot is approved

### For End Users
- 🔘 **Inline Button Navigation** - Clean, intuitive folder browsing
- 📄 **Instant File Delivery** - Files forwarded directly from Telegram
- 🔍 **Smart Pagination** - Handle large folders with 30 items per page
- 🌐 **No Downloads Required** - Everything works in Telegram

---

## 🏗️ Architecture

```
┌────────────────────┐
│   Windows Users    │ → Upload files via GUI
└─────────┬──────────┘
          │
          ↓ (Metadata)
┌────────────────────┐
│  Node.js Backend   │ → Manages all bots
│   (Port 3000)      │ → Approval workflow
└─────────┬──────────┘
          │
          ↓ (Admin Access)
┌────────────────────┐
│   Admin Web Panel  │ → Moderate bots
│  (HTTPS/Caddy)     │ → Ban users
└────────────────────┘

Files stored on: Telegram Servers (not your server!)
```

**Key Innovation:** Files are uploaded to user's own Telegram channel. Your server only stores JSON metadata (file IDs, folder structure). When a user requests a file, the bot forwards it from the channel. This means:
- ✅ No storage costs for you
- ✅ Infinite scalability (Telegram's infrastructure)
- ✅ Fast file delivery (Telegram's CDN)
- ✅ 2GB per file support (Telegram's limit)

---

## 🚀 Quick Start

### Prerequisites

- **Server:** Linux (Ubuntu 22.04 LTS recommended)
- **Node.js:** 18.0.0 or higher
- **Python:** 3.8+ (for Windows uploader)
- **Domain:** Any domain (we recommend using CloudFlare for free SSL)

### Installation (5 Minutes)

1. **Clone the repository:**
```bash
git clone https://github.com/your-username/telegram-bot-system.git
cd telegram-bot-system
```

2. **Run the installer:**
```bash
cd scripts
sudo bash install.sh
```

The installer will ask for:
- Your domain name (e.g., `yourdomain.com`)
- Admin username
- Admin password (min 12 characters)

3. **Copy backend files:**
```bash
sudo cp -r ~/telegram-bot-system/backend/* /opt/telegram-bot-system/backend/
sudo cp -r ~/telegram-bot-system/scripts/* /opt/telegram-bot-system/scripts/
cd /opt/telegram-bot-system/backend
sudo -u tgbot npm install
```

4. **Setup the service:**
```bash
sudo bash /opt/telegram-bot-system/scripts/setup_service.sh
```

5. **Access your admin panel:**
```
https://yourdomain.com/admin
```

**That's it!** 🎉 Your system is running.

---

## 📖 Documentation

### For Developers
- [📘 Complete Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md) - Full system architecture and component details
- [🔧 Deployment Guide](docs/DEPLOYMENT_GUIDE.md) - Step-by-step production deployment
- [🧪 Testing Guide](docs/TESTING_GUIDE.md) - Comprehensive testing checklist

### For Users (loading ..)
- [📱 Windows Uploader Guide](uploader/QUICKSTART.md) - How to create and upload your bot
- [⚙️ Admin Panel Guide](docs/ADMIN_PANEL_GUIDE.md) - Using the admin dashboard
- [🔒 Security Best Practices](docs/SECURITY.md) - Keeping your system secure

### Privacy & Hosting
- [🌐 CloudFlare Tunnel Setup](docs/CLOUDFLARE_TUNNEL.md) - Hide your IP (FREE)
- [☁️ VPS Recommendations](docs/VPS_RECOMMENDATIONS.md) - Best hosting providers

---

## 🖼️ Screenshots (loading)

### Admin Panel
<details>
<summary>Click to view admin panel screenshots</summary>

**Dashboard:**
```
┌─────────────────────────────────────────────────┐
│  📊 Dashboard Overview                          │
├─────────────────────────────────────────────────┤
│                                                 │
│  Total Bots: 15    Approved: 12    Pending: 3  │
│  Banned Users: 2                                │
│                                                 │
│  Recent Activity:                               │
│  • New bot created: @filesbot (5 min ago)      │
│  • Bot approved: @docsbot (1 hour ago)         │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Bot Management:**
```
┌──────────────────────────────────────────────────┐
│  🤖 Bot Management                               │
├──────────────────────────────────────────────────┤
│                                                  │
│  @filesbot        [Pending]   [Approve] [View]  │
│  @musicbot        [Approved]  [Disconnect]      │
│  @docsbot         [Approved]  [Disconnect]      │
│                                                  │
└──────────────────────────────────────────────────┘
```
</details>

### Windows Uploader
<details>
<summary>Click to view uploader screenshots</summary>

```
┌─────────────────────────────────────────────────┐
│  📁 Telegram Bot File Uploader v1.0             │
├─────────────────────────────────────────────────┤
│                                                 │
│  Folder: [C:\My Files\Documents]  [Browse...]  │
│  Bot Token: [••••••••••••••••••••••]           │
│  Channel ID: [@my_private_channel]             │
│                                                 │
│  ○ New Upload    ● Update Existing             │
│                                                 │
│  [███████████████░░░░░░░░] 75% - 15/20         │
│  Uploading: document5.pdf                      │
│                                                 │
│  [▶ Start Upload]  [✕ Cancel]  [Clear Log]    │
│                                                 │
└─────────────────────────────────────────────────┘
```
</details>

### Bot User Experience
<details>
<summary>Click to view bot interface</summary>

**Telegram Chat:**
```
User: /start

Bot: 👋 Welcome! Use the buttons below to navigate.

     [📁 Documents] [📁 Images] [📁 Videos]
     
User: *clicks Documents*

Bot: 📂 Documents

     [📁 Work]   [📁 Personal]   [📁 Archive]
     [🏠 Main]
     
User: *clicks Work*

Bot: 📁 Sending 5 files from this folder...
     
     *forwards 5 files from channel*
     
     [📁 Reports]   [📁 Contracts]
     [⬅️ Back]      [🏠 Main]
```
</details>

---

## 🛠️ Technology Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express 4.18+
- **Bot Library:** node-telegram-bot-api
- **Security:** helmet, express-rate-limit, express-validator
- **Storage:** JSON files (no database required)

### Frontend (Admin Panel)
- **UI:** Vanilla HTML5/CSS3/JavaScript
- **Authentication:** SHA-256 hashing + session tokens
- **Design:** Responsive, mobile-friendly

### Uploader
- **Language:** Python 3.8+
- **GUI:** PyQt5
- **HTTP:** requests library
- **Build:** PyInstaller

### Infrastructure
- **OS:** Ubuntu 22.04 LTS
- **Web Server:** Caddy (automatic HTTPS)
- **Process Manager:** systemd
- **Firewall:** UFW
- **Security:** fail2ban

---

## 📦 Project Structure

```
telegram-bot-system/
│
├── backend/                    # Node.js Backend Server
│   ├── server.js              # Main entry point
│   ├── bot-manager.js         # Multi-bot handler
│   ├── storage.js             # JSON file operations
│   ├── security.js            # Input sanitization
│   ├── config.js              # Configuration manager
│   ├── admin-bot.js           # Notification system
│   ├── admin-routes.js        # Admin API routes
│   └── public/                # Admin panel static files
│
├── uploader/                  # Windows GUI Uploader
│   ├── main.py               # Entry point
│   ├── gui.py                # PyQt5 interface
│   ├── uploader.py           # Core logic
│   ├── telegram_api.py       # Telegram API wrapper
│   ├── file_scanner.py       # Directory scanner
│   ├── json_builder.py       # Metadata builder
│   └── api_client.py         # Server API client
│
├── scripts/                   # Deployment Scripts
│   ├── install.sh            # Main installer
│   ├── setup_service.sh      # Systemd service
│   ├── backup.sh             # Automated backups
│   ├── setup_cron.sh         # Scheduled tasks
│   ├── security_hardening.sh # Advanced security
│   └── health_check.sh       # System health check
│
└── docs/                      # Documentation
    ├── TECHNICAL_DOCUMENTATION.md
    ├── DEPLOYMENT_GUIDE.md
    └── ...
```

---

## 🔒 Security Features

- ✅ **Input Sanitization** - All inputs validated and sanitized
- ✅ **XSS Prevention** - HTML escaping on all user content
- ✅ **Injection Prevention** - SQL, code, and command injection blocked
- ✅ **Path Traversal Protection** - Directory access controlled
- ✅ **Rate Limiting** - DDoS protection on all endpoints
- ✅ **Authentication** - SHA-256 hashed passwords
- ✅ **Session Management** - Secure token-based sessions (30min timeout)
- ✅ **HTTPS** - Automatic SSL via Caddy/Let's Encrypt
- ✅ **Firewall** - UFW configured (only ports 22, 80, 443 open)
- ✅ **Fail2Ban** - Brute force protection
- ✅ **Security Monitoring** - Real-time attack detection

---

## 📊 Performance

### Expected Performance
- **Concurrent Users:** 100-200 simultaneous
- **Bots Managed:** 10-50 comfortable (up to 500 possible)
- **Response Time:** <100ms for bot interactions
- **Uptime:** 99.9% (with proper deployment)

### Resource Requirements
- **RAM:** 1GB minimum, 2GB recommended
- **CPU:** 1 core minimum, 2 cores recommended
- **Storage:** 10GB minimum (metadata only, no large files)
- **Bandwidth:** 1TB/month minimum

### Scaling Recommendations
- **Under 500 bots:** Current JSON storage works well
- **500-1000 bots:** Consider PostgreSQL/SQLite migration
- **1000+ bots:** Definitely use database + Redis sessions
- **5000+ bots:** Add load balancer + multiple instances
See [MAINTENANCE_GUIDE.md](docs/MAINTENANCE_GUIDE.md) for detailed scaling information.

---

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Backend tests
cd backend
npm test

# Integration tests
npm run test:integration

# Security tests
npm run test:security
```

For manual testing, see [Testing Guide](docs/TESTING_GUIDE.md).

---

## 🚢 Deployment Options

### Option 1: Home Server + CloudFlare Tunnel (FREE)
✅ **Recommended for testing/small scale**
- No VPS costs
- IP address hidden via CloudFlare
- Automatic HTTPS
- See [CloudFlare Tunnel Guide](docs/CLOUDFLARE_TUNNEL.md)

### Option 2: VPS Hosting ($5/month)
✅ **Recommended for production**
- 99.9% uptime
- Better performance
- Professional setup
- See [VPS Recommendations](docs/VPS_RECOMMENDATIONS.md)

### Option 3: Hybrid (Home + CloudFlare + VPN)
✅ **Maximum privacy**
- CloudFlare hides IP from visitors
- VPN hides IP from Telegram
- Complete anonymity

---

## 📝 API Reference

### Public Endpoints

**Upload Bot Metadata**
```http
POST /api/upload
Content-Type: application/json

{
  "botToken": "string",
  "channelId": "string",
  "botUsername": "string",
  "metadata": {object}
}
```

**Check Bot Status**
```http
GET /api/bot-status/:botToken
```

**Get Bot Metadata** (for updates)
```http
GET /api/bot-metadata/:botToken
```

**Response:**
```json
{
  "success": true,
  "botId": "abc123",
  "status": "approved",
  "metadata": { /* full structure */ },
  "lastUpdate": "2024-01-02T00:00:00Z"
}
```

### Admin Endpoints

All require `Authorization: Bearer {token}` header.

- `POST /api/admin/login` - Authenticate
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/bots` - List all bots
- `POST /api/admin/approve-bot` - Approve pending bot
- `POST /api/admin/ban-user` - Ban user
- More in [API Documentation](docs/API.md) (soon)

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/telegram-bot-system.git

# Install dependencies
cd telegram-bot-system/backend
npm install

# Start in development mode
npm run dev

# Run tests
npm test
```

---

## 🚨 Known Issues & Limitations

1. **Session Storage** - In-memory (lost on restart, partially fixed with persistence)
2. **Single Admin** - Only one admin account supported
3. **Windows Only Uploader** - Linux/Mac versions not yet available
4. **JSON Storage** - Limits to ~500 bots comfortably
5. **No Database** - All data in JSON files

See [Issues](https://github.com/nitpacker/tgfilebotter/issues) for planned improvements.

### Recently Fixed:
- ✅ Race conditions in file operations (proper-lockfile added)
- ✅ Circuit breakers for failing bots
- ✅ CSRF protection in admin panel
- ✅ Password salt security requirement enforced
- ✅ Bot status update atomicity
- ✅ Session cleanup and persistence
---

## 🗺️ Roadmap

### Version 1.1 (Planned)
- [ ] Multi-admin support with role-based access
- [ ] PostgreSQL/SQLite database option (recommended for 500+ bots)
- [ ] Bot analytics dashboard
- [ ] Email notifications
- [ ] Webhook mode (instead of polling)

### Version 1.2
- [ ] Linux/Mac uploader versions
- [ ] Mobile uploader (Android/iOS)
- [ ] Bot templates/presets
- [ ] User dashboard for bot owners

### Version 2.0
- [ ] Multi-language support
- [ ] Monetization features
- [ ] Bot themes & customization
- [ ] Advanced analytics
- [ ] API key system for developers

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 [Your Name]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
**The author of this repository is not responsible for any misuse of its code, including but not limited to: Hosting of illegal or copyrighted content!
The code was not written or reviewed by a professional. Expect all kinds of bugs including possible Telegram bans or limitations. The owner of this repository is not in any way responsible for how you use this code or what might happen as a direct or indirect consequense of that use!**

---

## 👌 Acknowledgments

- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) - Telegram Bot API wrapper
- [Express](https://expressjs.com/) - Web framework
- [PyQt5](https://www.riverbankcomputing.com/software/pyqt/) - Python GUI framework
- [Caddy](https://caddyserver.com/) - Automatic HTTPS web server
- [CloudFlare](https://www.cloudflare.com/) - CDN and security
- [Claude](https://www.claude.ai/) - Major code writing and reviewing
---

## 📞 Support & Contact

### Get Help
- 📖 [Documentation](docs/)
- 🐛 [Report Bug](https://github.com/nitpacker/tgfilebotter/issues)
- 💡 [Request Feature](https://github.com/nitpacker/tgfilebotter/issues)
- 💬 [Discussions](https://github.com/nitpacker/tgfilebotter/discussions)

### Community
- 🌟 Star this repo if you find it useful!
- 🔀 Fork it to customize for your needs
- 📣 Share with others who might benefit

---

## 📈 Stats

![GitHub stars](https://img.shields.io/github/stars/nitpacker/tgfilebotter?style=social)
![GitHub forks](https://img.shields.io/github/forks/nitpacker/tgfilebotter?style=social)
![GitHub issues](https://img.shields.io/github/issues/nitpacker/tgfilebotter)
![GitHub pull requests](https://img.shields.io/github/issues-pr/nitpacker/tgfilebotter)

---

<div align="center">

**Made with ❤️ by [nitpacker](https://github.com/nitpacker)**

**⭐ Star this repo if it helped you! ⭐**

[Documentation](docs/) • [Issues](https://github.com/nitpacker/tgfilebotter/issues) • [Pull Requests](https://github.com/nitpacker/tgfilebotter/pulls)

</div>
