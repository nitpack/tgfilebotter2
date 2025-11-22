"""
Configuration settings for the uploader application.
"""

# Server Configuration
# Change this to your actual server URL before distribution
SERVER_URL = "http://localhost:3000"

# API Endpoints
API_UPLOAD = f"{SERVER_URL}/api/upload"
API_BOT_STATUS = f"{SERVER_URL}/api/bot-status"

# Telegram Limits
MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024  # 2GB (Telegram limit)
MAX_JSON_SIZE = 10 * 1024 * 1024  # 10MB default (configurable on server)

# Upload Settings
UPLOAD_TIMEOUT = 300  # 5 minutes per file
API_TIMEOUT = 30  # 30 seconds for API calls

# Validation Patterns
import re

# Bot token format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
BOT_TOKEN_PATTERN = re.compile(r'^\d{8,10}:[A-Za-z0-9_-]{35}$')

# Channel ID format: @channelname or -100123456789
CHANNEL_ID_PATTERN = re.compile(r'^(@[a-zA-Z0-9_]{5,32}|-100\d{10,})$')

# Valid folder name characters (Unicode support)
FOLDER_NAME_PATTERN = re.compile(r'^[\w\s\-_().]+$', re.UNICODE)

# Dangerous patterns to reject
DANGEROUS_PATTERNS = [
    re.compile(r'<script', re.IGNORECASE),
    re.compile(r'javascript:', re.IGNORECASE),
    re.compile(r'on\w+\s*=', re.IGNORECASE),
    re.compile(r'\.\.[\\/]'),  # Path traversal
    re.compile(r'__proto__', re.IGNORECASE),
    re.compile(r'\$\{.*\}'),  # Template injection
]

# File types (all allowed, but these are common)
SUPPORTED_EXTENSIONS = None  # None means all extensions allowed

# GUI Settings
WINDOW_WIDTH = 700
WINDOW_HEIGHT = 600
LOG_MAX_LINES = 1000

# Colors for GUI
COLORS = {
    'primary': '#2563eb',
    'success': '#10b981',
    'warning': '#f59e0b',
    'danger': '#ef4444',
    'dark': '#1f2937',
    'light': '#f3f4f6',
    'white': '#ffffff'
}
