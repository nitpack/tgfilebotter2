#!/bin/bash
# ============================================================
# Automated Backup Script
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

# Create backup directory
mkdir -p "$BACKUP_PATH"

# Backup bots directory
if [ -d "$DATA_DIR/bots" ]; then
    cp -r "$DATA_DIR/bots" "$BACKUP_PATH/"
    BOT_COUNT=$(ls -1 "$DATA_DIR/bots" 2>/dev/null | wc -l)
    log "✓ Backed up $BOT_COUNT bot files"
else
    log "⚠ No bots directory found"
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
echo "\"checksum\": \"$CHECKSUM\"" >> "$BACKUP_PATH/manifest.json"

# Compress backup
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_PATH"

BACKUP_SIZE=$(du -h "$BACKUP_NAME.tar.gz" | cut -f1)
log "✓ Created compressed backup: $BACKUP_NAME.tar.gz ($BACKUP_SIZE)"

# Clean old backups (keep last RETENTION_DAYS days)
log "Cleaning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
REMAINING=$(ls -1 "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | wc -l)
log "✓ $REMAINING backups remaining"

log "========== Backup complete =========="

# Optional: Send notification to admin (if admin bot is configured)
# This will be handled by the Node.js app's backup endpoint
curl -s -X POST "http://localhost:3000/api/admin/backup-notification" \
    -H "Content-Type: application/json" \
    -d "{\"backup\": \"$BACKUP_NAME.tar.gz\", \"size\": \"$BACKUP_SIZE\", \"bots\": $BOT_COUNT}" \
    > /dev/null 2>&1 || true

exit 0
