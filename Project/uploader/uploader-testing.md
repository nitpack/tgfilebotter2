# Phase 3 Testing Guide

## Prerequisites

Before testing the uploader, ensure:

- [ ] Phase 1 backend server is running (`npm start`)
- [ ] You have added the `/api/bot-metadata/:token` endpoint (see `server_update.js`)
- [ ] You have a Telegram bot token (from @BotFather)
- [ ] You have a private Telegram channel with bot as admin
- [ ] Python 3.8+ installed (for development testing)

---

## Test 1: Development Run

### Setup
```bash
cd uploader
pip install -r requirements.txt
python main.py
```

### Expected
- [ ] GUI window opens
- [ ] All controls visible and functional
- [ ] No errors in console

---

## Test 2: Input Validation

### Test Empty Inputs
1. Leave all fields empty
2. Click "Start Upload"

**Expected:**
- [ ] Error message showing missing fields
- [ ] Upload does not start

### Test Invalid Bot Token
1. Enter folder path
2. Enter invalid token (e.g., "invalid")
3. Enter valid channel ID
4. Click "Start Upload"

**Expected:**
- [ ] Error: "Invalid bot token format"

### Test Invalid Channel ID
1. Enter folder path
2. Enter valid bot token
3. Enter invalid channel (e.g., "channel")
4. Click "Start Upload"

**Expected:**
- [ ] Error: "Invalid channel ID format"

---

## Test 3: New Upload (Small Folder)

### Setup
Create test folder:
```
test_folder/
├── file1.txt (any small text file)
├── file2.pdf (any PDF)
└── subfolder/
    └── file3.jpg (any image)
```

### Steps
1. Select test_folder
2. Enter valid bot token
3. Enter valid channel ID
4. Select "New Upload"
5. Click "Start Upload"

### Expected
- [ ] Progress bar updates
- [ ] Log shows scanning progress
- [ ] Log shows "Uploading: file1.txt", etc.
- [ ] Files appear in Telegram channel
- [ ] "Upload successful" message
- [ ] Bot ID shown in log
- [ ] Status shows "pending"

### Verify
- [ ] Check Telegram channel - 3 files uploaded
- [ ] Check server `data/bots/` - new bot JSON created
- [ ] Send `/start` to bot (should work for admin only)

---

## Test 4: Update Mode

### Setup
1. Complete Test 3 first
2. Modify test_folder:
   - Add `file4.txt`
   - Delete `file2.pdf`
   - Modify `file1.txt` (change content)

### Steps
1. Select same test_folder
2. Enter same bot token
3. Enter same channel ID
4. Select "Update Existing"
5. Click "Start Upload"

### Expected
- [ ] Log shows "Fetching existing metadata..."
- [ ] Log shows change detection: "X added, X removed, X modified, X unchanged"
- [ ] Only changed files uploaded
- [ ] Old files deleted from channel
- [ ] "Upload successful" message
- [ ] Change percentage shown

### Verify
- [ ] Channel now has: file1.txt (new), file3.jpg, file4.txt
- [ ] file2.pdf removed from channel
- [ ] Bot still works via Telegram

---

## Test 5: Large Folder

### Setup
Create folder with 50+ files in multiple subfolders.

### Steps
1. Select large folder
2. Complete upload

### Expected
- [ ] Pagination works on server side (if tested via bot)
- [ ] All files uploaded successfully
- [ ] No timeout errors
- [ ] Progress accurate

---

## Test 6: Unicode/Arabic Names

### Setup
Create folder:
```
اختبار/
├── ملف.txt
└── المجلد الفرعي/
    └── صورة.jpg
```

### Steps
1. Select Arabic folder
2. Complete upload

### Expected
- [ ] Folder names validated successfully
- [ ] Files uploaded correctly
- [ ] Names display correctly in Telegram bot
- [ ] Navigation works in bot

---

## Test 7: File Size Limits

### Setup
Create folder with:
- Small file (1 MB)
- Large file (> 2 GB)

### Steps
1. Select folder
2. Start upload

### Expected
- [ ] Small file uploads
- [ ] Large file skipped with warning in log
- [ ] Upload completes with "X files skipped"

---

## Test 8: Cancel Upload

### Steps
1. Start upload with medium-sized folder
2. Click "Cancel" during upload
3. Confirm cancellation

### Expected
- [ ] Upload stops gracefully
- [ ] "Upload cancelled" in log
- [ ] Already uploaded files remain in channel
- [ ] Can start new upload after cancel

---

## Test 9: Server Connection Failure

### Setup
1. Stop backend server (`Ctrl+C`)

### Steps
1. Try to start upload

### Expected
- [ ] Error: "Cannot connect to server"
- [ ] Clear error message
- [ ] No crash

### Cleanup
- Restart backend server

---

## Test 10: Invalid Bot Token (Telegram Side)

### Steps
1. Enter correctly formatted but invalid token
2. Start upload

### Expected
- [ ] Error: "Invalid bot token"
- [ ] Detected during validation phase
- [ ] Upload does not proceed

---

## Test 11: Bot Not Admin in Channel

### Setup
1. Create channel without adding bot as admin

### Steps
1. Use valid bot token
2. Use channel where bot is not admin
3. Start upload

### Expected
- [ ] Error: "Bot is not admin" or "Cannot access channel"
- [ ] Clear error message

---

## Test 12: Build Executable

### Windows (PowerShell)
```powershell
.\build_uploader.ps1
```

### Cross-Platform (Python)
```bash
python build.py
```

### Expected
- [ ] Build completes without errors
- [ ] `dist/FileUploader_v1.0.0.exe` created
- [ ] File size ~25-40 MB
- [ ] Temporary files cleaned up

### Test Executable
- [ ] Double-click exe runs without errors
- [ ] GUI appears and functions correctly
- [ ] Can complete full upload process

---

## Test 13: Network Interruption

### Steps
1. Start large upload
2. Temporarily disconnect network
3. Reconnect network

### Expected
- [ ] Error shown for failed files
- [ ] Retry logic attempts reconnection
- [ ] Graceful failure with clear message

---

## Test 14: Special Characters in Filenames

### Setup
Create folder with files named:
- `file (1).txt`
- `my-doc_v2.pdf`
- `test.file.name.jpg`

### Steps
1. Upload folder

### Expected
- [ ] All files accepted
- [ ] Names preserved correctly
- [ ] Uploads successful

---

## Test 15: Path Traversal Attempt

### Setup
Create folder:
```
test/
└── ..\..\etc\passwd
```

### Expected
- [ ] Folder/file rejected during scan
- [ ] Security error in log
- [ ] Upload blocked

---

## Test Summary

| Test | Description | Status |
|------|-------------|--------|
| 1 | Development Run | ⬜ |
| 2 | Input Validation | ⬜ |
| 3 | New Upload (Small) | ⬜ |
| 4 | Update Mode | ⬜ |
| 5 | Large Folder | ⬜ |
| 6 | Unicode/Arabic | ⬜ |
| 7 | File Size Limits | ⬜ |
| 8 | Cancel Upload | ⬜ |
| 9 | Server Connection | ⬜ |
| 10 | Invalid Token | ⬜ |
| 11 | Bot Not Admin | ⬜ |
| 12 | Build Executable | ⬜ |
| 13 | Network Issues | ⬜ |
| 14 | Special Characters | ⬜ |
| 15 | Path Traversal | ⬜ |

---

## Phase 3 Checklist

Before proceeding to Phase 4:

- [ ] All 15 tests pass
- [ ] GUI is responsive and user-friendly
- [ ] Error messages are clear
- [ ] Executable builds successfully
- [ ] Update mode works correctly
- [ ] Server integration complete
- [ ] Documentation complete

---

## Notes

- Test in fresh Python environment to avoid dependency issues
- Keep test folders small for faster iteration
- Monitor server logs during testing
- Check Telegram channel after each test
- Clear test bots from server between major tests
