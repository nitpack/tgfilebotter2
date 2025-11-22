# Phase 3: Windows GUI Uploader

## Overview

A user-friendly Windows application for uploading files to Telegram channels via bots. Built with Python and PyQt5.

## Features

✅ **Simple GUI Interface**
- Browse and select folders
- Enter bot token and channel ID
- Real-time progress tracking
- Detailed log window

✅ **Two Upload Modes**
- **New Upload**: Upload all files as a new bot
- **Update Existing**: Only upload changed files (smart diff)

✅ **Smart Update Detection**
- Compares local files with server metadata
- Uploads only new/modified files
- Removes deleted files from channel
- Preserves unchanged files

✅ **Security**
- Input validation
- Folder name validation (Unicode support)
- Path traversal prevention
- Dangerous pattern detection

✅ **Error Handling**
- Rate limit detection with retry
- Network error recovery
- File size validation (2GB limit)
- Clear error messages

## File Structure

```
uploader/
├── main.py              # Entry point
├── gui.py               # PyQt5 GUI interface
├── uploader.py          # Core upload orchestration
├── telegram_api.py      # Telegram Bot API wrapper
├── file_scanner.py      # Directory scanner
├── json_builder.py      # Metadata builder
├── api_client.py        # Backend server client
├── config.py            # Configuration settings
├── requirements.txt     # Python dependencies
├── build.py             # Python build script
├── build_uploader.ps1   # PowerShell build script
└── README.md            # This file
```

## Quick Start (Development)

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Windows 10/11

### Installation

1. **Install Python dependencies:**
```bash
cd uploader
pip install -r requirements.txt
```

2. **Run the application:**
```bash
python main.py
```

### Usage

1. **Select Folder**: Click "Browse..." and select the folder containing your files
2. **Enter Bot Token**: Paste your Telegram bot token (from @BotFather)
3. **Enter Channel ID**: Enter your private channel ID (@channel or -100...)
4. **Select Mode**: 
   - "New Upload" for first-time upload
   - "Update Existing" to sync changes
5. **Click Start**: Watch the progress and logs

## Building Executable

### Option 1: Python Script

```bash
python build.py
```

### Option 2: PowerShell Script (Windows)

```powershell
.\build_uploader.ps1
```

### Output

Both scripts will create:
```
dist/
└── FileUploader_v1.0.0.exe
```

**File size:** ~25-40 MB (includes PyQt5)

## Configuration

### Server URL

Before distributing to users, update `config.py`:

```python
# Change this to your actual server address
SERVER_URL = "http://your-server-ip:3000"
```

Then rebuild the executable.

### Other Settings

In `config.py`:

```python
# Telegram limits
MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024  # 2GB

# Timeouts
UPLOAD_TIMEOUT = 300  # 5 minutes per file
API_TIMEOUT = 30       # 30 seconds for API calls
```

## How It Works

### New Upload Flow

1. User selects folder
2. Application scans all files and subfolders
3. Validates folder/file names
4. Uploads each file to Telegram channel via bot
5. Collects file_ids and message_ids
6. Sends complete metadata JSON to server
7. Server creates bot with "pending" status

### Update Mode Flow

1. Fetches existing metadata from server
2. Compares with local folder structure
3. Identifies: added, removed, modified, unchanged files
4. Deletes removed/modified files from channel
5. Uploads only new/modified files
6. Merges with existing metadata (preserving unchanged file_ids)
7. Sends updated metadata to server

## API Integration

### Required Server Endpoints

The uploader expects these endpoints on your backend:

```
GET  /health                    # Health check
GET  /api/bot-status/:token     # Get bot status
GET  /api/bot-metadata/:token   # Get full metadata (for update mode)
POST /api/upload                # Upload metadata
```

### Upload Payload

```json
{
  "botToken": "123456789:ABC...",
  "channelId": "@private_channel",
  "botUsername": "@mybot",
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

## Troubleshooting

### "Invalid bot token"
- Ensure token format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
- Token should be exactly 46 characters with `:` separator
- Get from @BotFather on Telegram

### "Cannot access channel"
- Bot must be added to channel as administrator
- Channel ID format: `@channelname` or `-100123456789`
- For private channels, use numeric ID (-100...)

### "Server connection failed"
- Check SERVER_URL in config.py
- Ensure backend server is running
- Check firewall/network settings

### "File too large"
- Telegram limit is 2GB per file
- Large files are automatically skipped
- Check log for skipped files list

### "Rate limited"
- Telegram has upload rate limits
- Uploader automatically waits and retries
- Large uploads may take time

### Build fails with PyInstaller
- Ensure all dependencies installed
- Run in clean Python environment
- Check antivirus isn't blocking

## User Instructions

### For End Users (after you build the exe)

1. **Download** `FileUploader_v1.0.0.exe`
2. **Create Telegram Bot**:
   - Open Telegram, message @BotFather
   - Send `/newbot`
   - Copy the bot token
3. **Create Private Channel**:
   - Create new channel (private)
   - Add your bot as administrator
   - Copy channel username or ID
4. **Run the uploader**:
   - Double-click `FileUploader.exe`
   - Select your files folder
   - Paste bot token and channel ID
   - Click "Start Upload"
5. **Wait for completion**
6. **Register your bot**:
   - Open your bot in Telegram
   - Send the word "register"
   - Wait for admin approval

## Security Notes

- Bot tokens are sent securely to your server
- Tokens stored in your server's data files
- No tokens stored on user's PC after upload
- All inputs validated and sanitized
- Path traversal attempts blocked

## Known Limitations

- Maximum 2GB per file (Telegram limit)
- Very large folders may hit JSON size limits
- Rate limiting may slow uploads
- Update mode requires server endpoint

## Version History

### v1.0.0
- Initial release
- New upload and update modes
- PyQt5 GUI
- Windows executable build

## Support

For issues:
1. Check the log window for detailed errors
2. Verify bot token and channel access
3. Test server connection manually
4. Review this README's troubleshooting section
