#!/bin/bash
# ============================================================
# Automated Backup Script (FIXED VERSION)
# FIXES: Backup verification, integrity checks, error handling
# Runs daily via cron - backs up to local and optionally Telegram
# ============================================================

APP_DIR="/opt/telegram-bot-system"
DATA_DIR="$APP_DIR/data"
BACKUP_DIR="$DATA_DIR/backups"
LOG_FILE="$APP_DIR/logs/backup.log"
RETENTION_DAYS=7

# Timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_NAME="backup_$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========== Starting backup =========="

# Check dependencies
if ! command -v jq &> /dev/null; then
    log "✗ ERROR: jq is not installed. Install with: sudo apt install jq"
    exit 1
fi

# FIXED: Verify source directories exist
if [ ! -d "$DATA_DIR" ]; then
    log "✗ ERROR: Data directory not found: $DATA_DIR"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_PATH"

# Backup bots directory
if [ -d "$DATA_DIR/bots" ]; then
    cp -r "$DATA_DIR/bots" "$BACKUP_PATH/"
    BOT_COUNT=$(ls -1 "$DATA_DIR/bots" 2>/dev/null | wc -l)
    log "✓ Backed up $BOT_COUNT bot files"
else
    log "⚠ No bots directory found"
    BOT_COUNT=0
fi

# Backup config directory
if [ -d "$DATA_DIR/config" ]; then
    cp -r "$DATA_DIR/config" "$BACKUP_PATH/"
    log "✓ Backed up config files"
else
    log "⚠ No config directory found"
fi

# Create manifest
cat > "$BACKUP_PATH/manifest.json" << EOF
{
    "timestamp": "$TIMESTAMP",
    "createdAt": "$(date -Iseconds)",
    "botCount": $BOT_COUNT,
    "server": "$(hostname)"
}
EOF

# Calculate checksum
CHECKSUM=$(find "$BACKUP_PATH" -type f -exec sha256sum {} \; | sha256sum | cut -d' ' -f1)

# Update manifest with checksum
TMP_MANIFEST=$(mktemp)
jq --arg checksum "$CHECKSUM" '. + {checksum: $checksum}' "$BACKUP_PATH/manifest.json" > "$TMP_MANIFEST" 2>/dev/null && mv "$TMP_MANIFEST" "$BACKUP_PATH/manifest.json"

# Compress backup
cd "$BACKUP_DIR" || exit 1
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"

# FIXED: Verify tar file was created
if [ ! -f "$BACKUP_NAME.tar.gz" ]; then
    log "✗ ERROR: Backup file was not created!"
    rm -rf "$BACKUP_PATH"
    exit 1
fi

# FIXED: Verify tar integrity
if tar -tzf "$BACKUP_NAME.tar.gz" > /dev/null 2>&1; then
    log "✓ Backup integrity verified"
else
    log "✗ ERROR: Backup file is corrupted!"
    rm -f "$BACKUP_NAME.tar.gz"
    rm -rf "$BACKUP_PATH"
    exit 1
fi

# FIXED: Verify minimum size (should be at least 1KB)
if command -v stat > /dev/null 2>&1; then
    # Try BSD stat first (macOS), then GNU stat (Linux)
    BACKUP_SIZE_BYTES=$(stat -f%z "$BACKUP_NAME.tar.gz" 2>/dev/null || stat -c%s "$BACKUP_NAME.tar.gz" 2>/dev/null)
    if [ -n "$BACKUP_SIZE_BYTES" ] && [ "$BACKUP_SIZE_BYTES" -lt 1024 ]; then
        log "⚠ WARNING: Backup file is suspiciously small (${BACKUP_SIZE_BYTES} bytes)"
    fi
fi

# Remove temporary directory
rm -rf "$BACKUP_PATH"

BACKUP_SIZE=$(du -h "$BACKUP_NAME.tar.gz" | cut -f1)
log "✓ Created compressed backup: $BACKUP_NAME.tar.gz ($BACKUP_SIZE)"

# FIXED: Verify backup can be extracted (test extraction)
TEMP_TEST_DIR=$(mktemp -d)
if tar -xzf "$BACKUP_NAME.tar.gz" -C "$TEMP_TEST_DIR" > /dev/null 2>&1; then
    log "✓ Backup extraction test passed"
    rm -rf "$TEMP_TEST_DIR"
else
    log "✗ ERROR: Backup extraction test failed!"
    rm -rf "$TEMP_TEST_DIR"
    # Don't delete the backup file - let admin investigate
fi

# Clean old backups (keep last RETENTION_DAYS days)
log "Cleaning backups older than $RETENTION_DAYS days..."
DELETED_COUNT=0
while IFS= read -r old_backup; do
    rm -f "$old_backup"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done < <(find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS)

if [ $DELETED_COUNT -gt 0 ]; then
    log "✓ Deleted $DELETED_COUNT old backup(s)"
fi

REMAINING=$(ls -1 "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | wc -l)
log "✓ $REMAINING backup(s) remaining"

log "========== Backup complete =========="

# Optional: Send notification to admin (if admin bot is configured)
# This will be handled by the Node.js app's backup endpoint
curl -s -X POST "http://localhost:3000/api/admin/backup-notification" \
    -H "Content-Type: application/json" \
    -d "{\"backup\": \"$BACKUP_NAME.tar.gz\", \"size\": \"$BACKUP_SIZE\", \"bots\": $BOT_COUNT}" \
    > /dev/null 2>&1 || true

exit 0
