# File Uploader - Quick Start Guide

## For End Users

This guide explains how to use the File Uploader to create your own Telegram file bot.

---

## Step 1: Create Your Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Choose a name for your bot (e.g., "My Files Bot")
4. Choose a username ending in `bot` (e.g., `myfiles_bot`)
5. **Copy the bot token** - it looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

⚠️ **Keep your token secret!** Anyone with it can control your bot.

---

## Step 2: Create Your Private Channel

1. In Telegram, tap the pencil icon → **New Channel**
2. Name it anything (e.g., "My Bot Files Storage")
3. Set it as **Private**
4. Add your bot as **Administrator**:
   - Go to channel settings
   - Manage → Administrators → Add Administrator
   - Search for your bot username
   - Give it permission to post messages
5. **Copy the channel ID**:
   - Option A: Use the channel username (e.g., `@my_storage_channel`)
   - Option B: Forward a message from the channel to @userinfobot to get the numeric ID

---

## Step 3: Prepare Your Files

1. Create a folder on your computer
2. Organize files into subfolders as you want them to appear in the bot menu
3. Example structure:
   ```
   My Bot Files/
   ├── Documents/
   │   ├── manual.pdf
   │   └── guide.pdf
   ├── Images/
   │   ├── photo1.jpg
   │   └── photo2.png
   └── Videos/
       └── intro.mp4
   ```

**Notes:**
- Maximum 2GB per file (Telegram limit)
- Folder names will become bot menu buttons
- Files can be any type

---

## Step 4: Upload Your Files

1. **Run FileUploader.exe**
2. Click **Browse** and select your folder
3. Paste your **Bot Token**
4. Enter your **Channel ID**
5. Select **New Upload** (for first time)
6. Click **Start Upload**
7. Wait for completion ✓

---

## Step 5: Register Your Bot

After upload completes:

1. Open Telegram
2. Search for your bot username
3. Send the message: `register`
4. You'll see: "Registration successful!"

This registers you as the bot owner and submits it for review.

---

## Step 6: Wait for Approval

- Your bot is now pending admin review
- You can test it yourself while waiting
- Once approved, anyone can use your bot

---

## Updating Your Files

If you need to add, remove, or modify files:

1. Make changes to your local folder
2. Run FileUploader.exe again
3. Enter same bot token and channel ID
4. Select **Update Existing**
5. Click **Start Upload**

The uploader will:
- Detect what changed
- Upload only new/modified files
- Remove deleted files
- Keep unchanged files

---

## Troubleshooting

### "Invalid bot token"
- Check you copied the entire token from BotFather
- Format should be: numbers:letters (46 characters total)

### "Cannot access channel"
- Make sure bot is added as admin
- Check channel ID is correct
- For private channels, use @username or -100... format

### "Server connection failed"
- Check your internet connection
- Server may be temporarily unavailable
- Try again later

### "File too large"
- Files over 2GB are automatically skipped
- Split large files or use smaller files

### Upload is slow
- Large files take time
- Telegram has rate limits
- Be patient with big uploads

---

## Using Your Bot

Once approved, users can:

1. Search for your bot in Telegram
2. Send `/start`
3. Navigate folders using buttons
4. Receive files by clicking folder buttons

---

## Tips

✅ **Organize well** - Good folder structure = good user experience

✅ **Clear names** - Use descriptive folder names

✅ **Test first** - Test your bot before sharing widely

✅ **Keep token safe** - Never share your bot token

✅ **Update regularly** - Use update mode for changes

---

## Need Help?

- Check the log window for detailed error messages
- Contact the administrator if issues persist
