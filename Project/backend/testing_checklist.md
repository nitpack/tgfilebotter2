# Phase 1 Testing Checklist

Use this checklist to verify all features work correctly.

## ✅ Setup Tests

- [ ] Server starts without errors
- [ ] Directories created (`data/bots`, `data/config`, `data/backups`)
- [ ] Default configs created (`admin.json`, `system.json`)
- [ ] Server listens on port 3000
- [ ] Health check works: `curl http://localhost:3000/health`

## ✅ Bot Creation Tests

### Test 1: Create New Bot (Valid)
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "VALID_TOKEN",
    "channelId": "@valid_channel",
    "botUsername": "@testbot",
    "metadata": {"subfolders": {}, "files": []}
  }'
```

**Expected:**
- [ ] Returns `success: true`
- [ ] Returns `botId`
- [ ] Status is `pending`
- [ ] Bot file created in `data/bots/`
- [ ] Admin notification sent (if configured)
- [ ] Console shows "Bot initialized"

### Test 2: Invalid Bot Token
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "invalid",
    "channelId": "@channel",
    "botUsername": "@testbot",
    "metadata": {}
  }'
```

**Expected:**
- [ ] Returns `success: false`
- [ ] Returns error message
- [ ] No bot created

### Test 3: JSON Too Large
Create a JSON with metadata over 10MB.

**Expected:**
- [ ] Returns `413` status
- [ ] Error message mentions size limit
- [ ] No bot created

### Test 4: Malicious JSON
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "VALID_TOKEN",
    "channelId": "@channel",
    "botUsername": "@testbot",
    "metadata": {
      "__proto__": {"admin": true},
      "subfolders": {}
    }
  }'
```

**Expected:**
- [ ] Returns `success: false`
- [ ] Security alert logged
- [ ] No bot created

## ✅ Bot Update Tests

### Test 5: Update Existing Bot (Small Changes)
Upload same bot again with minor changes (< 30%).

**Expected:**
- [ ] Returns `success: true`
- [ ] `isUpdate: true`
- [ ] Change percentage shown
- [ ] No admin notification for small changes
- [ ] Bot file updated

### Test 6: Update with Major Changes (>30%)
Upload same bot with >30% file changes.

**Expected:**
- [ ] Returns `success: true`
- [ ] `isUpdate: true`
- [ ] Change percentage > 30
- [ ] Admin notification sent
- [ ] Bot stays live (not disconnected)

## ✅ Bot Status Tests

### Test 7: Check Bot Status
```bash
curl http://localhost:3000/api/bot-status/YOUR_BOT_TOKEN
```

**Expected:**
- [ ] Returns bot info
- [ ] Shows correct status (pending/approved)
- [ ] Shows owner registration status

### Test 8: Check Non-Existent Bot
```bash
curl http://localhost:3000/api/bot-status/FAKE_TOKEN
```

**Expected:**
- [ ] Returns 404
- [ ] Error message: "Bot not found"

## ✅ Telegram Bot Tests

### Test 9: Pending Bot - Admin Access
With admin User ID configured:
- [ ] Send `/start` to pending bot
- [ ] Receive "ADMIN TEST MODE" message
- [ ] See folder navigation buttons
- [ ] Can navigate folders
- [ ] Files forwarded correctly

### Test 10: Pending Bot - Non-Admin Access
From different Telegram account:
- [ ] Send `/start` to pending bot
- [ ] No response (silently ignored)
- [ ] No error messages

### Test 11: Owner Registration
- [ ] Send message with "register" to bot
- [ ] Receive confirmation message
- [ ] Owner ID saved in bot config
- [ ] Admin notification sent

### Test 12: Folder Navigation
- [ ] `/start` shows main menu
- [ ] Click folder button
- [ ] Files forwarded automatically
- [ ] Subfolders shown as buttons
- [ ] Back/Next buttons work (if >30 items)
- [ ] Main button returns to root

### Test 13: Invalid Input Handling
- [ ] Send random text (not button press)
- [ ] Receive invalid input message
- [ ] Bot doesn't crash

### Test 14: Unicode/Arabic Folder Names
Create bot with Arabic folder names.

**Expected:**
- [ ] Folders displayed correctly
- [ ] Sorting works properly
- [ ] Navigation works
- [ ] No encoding errors

## ✅ Bot Approval Tests

### Test 15: Approve Bot
```bash
curl -X POST http://localhost:3000/api/admin/approve-bot \
  -H "Content-Type: application/json" \
  -d '{"botId": "YOUR_BOT_ID"}'
```

**Expected:**
- [ ] Returns `success: true`
- [ ] Bot status changed to `approved`
- [ ] Admin notification sent
- [ ] Bot now responds to all users

### Test 16: Approved Bot - Public Access
- [ ] Non-admin users can use bot
- [ ] `/start` shows welcome message
- [ ] Folder navigation works
- [ ] Files forwarded correctly

## ✅ Security Tests

### Test 17: Rate Limiting - Upload
Make 11 upload requests within 1 hour.

**Expected:**
- [ ] First 10 succeed
- [ ] 11th request rejected
- [ ] Error message about rate limit

### Test 18: Rate Limiting - Global
Make 101 requests to any endpoint within 15 minutes.

**Expected:**
- [ ] First 100 succeed
- [ ] 101st rejected
- [ ] Rate limit error message

### Test 19: SQL Injection Attempt
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "VALID_TOKEN",
    "channelId": "'; DROP TABLE bots;--",
    "botUsername": "@testbot",
    "metadata": {}
  }'
```

**Expected:**
- [ ] Input sanitized
- [ ] No SQL injection possible (we use JSON, not SQL)
- [ ] Request handled safely

### Test 20: XSS Attempt
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "VALID_TOKEN",
    "channelId": "@channel",
    "botUsername": "@testbot",
    "metadata": {
      "subfolders": {
        "<script>alert(1)</script>": {}
      }
    }
  }'
```

**Expected:**
- [ ] Script tags sanitized/escaped
- [ ] Folder name validation fails
- [ ] No XSS possible

### Test 21: Path Traversal
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "VALID_TOKEN",
    "channelId": "@channel",
    "botUsername": "@testbot",
    "metadata": {
      "subfolders": {
        "../../etc/passwd": {}
      }
    }
  }'
```

**Expected:**
- [ ] Path traversal blocked
- [ ] Validation error returned
- [ ] No file system access outside data dir

## ✅ Admin Bot Tests (if configured)

### Test 22: Admin Bot Connection
**Expected:**
- [ ] Admin bot initializes
- [ ] "Admin bot ready" in console
- [ ] Connection successful

### Test 23: New Bot Notification
Create a new bot.

**Expected:**
- [ ] Notification sent to admin channel
- [ ] Contains bot username
- [ ] Contains bot ID
- [ ] Shows "Pending approval"

### Test 24: Security Alert
Trigger security event (malicious input).

**Expected:**
- [ ] Alert sent to admin channel
- [ ] Contains event details
- [ ] Proper severity level

### Test 25: Update Alert
Update bot with >30% changes.

**Expected:**
- [ ] Notification sent
- [ ] Shows change percentage
- [ ] Suggests review

## ✅ Storage Tests

### Test 26: Bot Data Persistence
- [ ] Create bot
- [ ] Stop server (Ctrl+C)
- [ ] Start server again
- [ ] Bot still works
- [ ] Bot data loaded correctly

### Test 27: Backup Creation
```bash
# In Node.js console or create test script
const storage = require('./storage');
const s = new storage();
const result = await s.createBackup();
console.log(result);
```

**Expected:**
- [ ] Backup directory created
- [ ] Files copied correctly
- [ ] Manifest.json created
- [ ] Checksum calculated

### Test 28: Config Persistence
- [ ] Modify system config
- [ ] Restart server
- [ ] Config settings maintained

## ✅ Edge Case Tests

### Test 29: Empty Folder
Bot with empty folders.

**Expected:**
- [ ] Shows "This folder is empty" message
- [ ] No errors
- [ ] Can navigate back

### Test 30: Large Folder (>30 items)
Bot with 50+ subfolders in one folder.

**Expected:**
- [ ] Pagination works
- [ ] Shows "Page 1/2" indicator
- [ ] Next button appears
- [ ] Can navigate between pages

### Test 31: Deep Nesting
Bot with 10+ levels of nested folders.

**Expected:**
- [ ] All levels accessible
- [ ] Navigation works
- [ ] No stack overflow
- [ ] Performance acceptable

### Test 32: Special Characters in Folder Names
Folders with: `Folder (1)`, `Test-File`, `المجلد العربي`

**Expected:**
- [ ] All display correctly
- [ ] Navigation works
- [ ] No encoding issues

### Test 33: Server Restart with Active Bots
- [ ] Create multiple bots
- [ ] Users actively using bots
- [ ] Restart server
- [ ] All bots reload
- [ ] Users can continue using

### Test 34: Concurrent Requests
Send 10 simultaneous upload requests.

**Expected:**
- [ ] All handled correctly
- [ ] No race conditions
- [ ] All bots created
- [ ] No data corruption

## ✅ Error Handling Tests

### Test 35: Invalid Telegram Token
Bot with invalid token format.

**Expected:**
- [ ] Bot creation fails gracefully
- [ ] Clear error message
- [ ] No server crash

### Test 36: Telegram API Down
Disconnect internet or block Telegram IPs.

**Expected:**
- [ ] Server continues running
- [ ] Error logged
- [ ] Admin alert sent
- [ ] Other bots unaffected

### Test 37: Disk Space Full
Fill up disk space (in test environment).

**Expected:**
- [ ] Graceful failure
- [ ] Error message to user
- [ ] Server doesn't crash

## 📊 Test Summary

**Total Tests:** 37

**Results:**
- [ ] All security tests passed ✅
- [ ] All bot creation tests passed ✅
- [ ] All navigation tests passed ✅
- [ ] All approval workflow tests passed ✅
- [ ] All storage tests passed ✅
- [ ] All edge cases handled ✅

**Issues Found:** _[List any issues]_

**Phase 1 Status:** 
- [ ] **READY FOR PHASE 2** ✅
- [ ] Needs fixes (specify above)

---

## 🔍 Performance Benchmarks

Optional performance tests:

- [ ] Handle 10 bots simultaneously
- [ ] Handle 100 bots simultaneously  
- [ ] 1000 folder navigation requests/min
- [ ] Server restart < 5 seconds
- [ ] Memory usage stable (no leaks)
- [ ] Response time < 1 second (avg)

---

**Testing completed by:** _______________  
**Date:** _______________  
**Sign-off:** Ready for Phase 2 ☐ Yes ☐ No