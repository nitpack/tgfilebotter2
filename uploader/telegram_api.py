"""
Telegram Bot API wrapper for file uploads (PRODUCTION-READY - ALL FIXES APPLIED).
"""

import requests
import os
import time
import logging
from typing import Optional, Dict, Any, Callable
from config import MAX_FILE_SIZE, UPLOAD_TIMEOUT

# MAJOR FIX #8: Configure logging to not expose tokens
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TelegramAPI:
    """Handles all Telegram Bot API interactions."""
    
    BASE_URL = "https://api.telegram.org/bot"
    
    def __init__(self, bot_token: str):
        self.bot_token = bot_token
        self.api_url = f"{self.BASE_URL}{bot_token}"
        self._bot_info = None
        
        # MAJOR FIX #8: Safe token prefix extraction
        if len(bot_token) > 12:
            self._token_prefix = bot_token[:4] + "..." + bot_token[10:12]
        else:
            self._token_prefix = "****"
    
    def _sanitize_error(self, error_msg: str) -> str:
        """MAJOR FIX #8: Remove token from error messages."""
        if self.bot_token in str(error_msg):
            error_msg = str(error_msg).replace(self.bot_token, f"{self._token_prefix}****")
        return error_msg
    
    def _log_error(self, message: str, error: Exception = None):
        """MAJOR FIX #8: Log errors without exposing tokens."""
        sanitized_msg = self._sanitize_error(message)
        if error:
            sanitized_error = self._sanitize_error(str(error))
            logger.error(f"{sanitized_msg}: {sanitized_error}")
        else:
            logger.error(sanitized_msg)
    
    def validate_token(self) -> Dict[str, Any]:
        """Validate bot token by calling getMe."""
        try:
            resp = requests.get(
                f"{self.api_url}/getMe",
                timeout=10
            )
            data = resp.json()
            
            if data.get('ok'):
                self._bot_info = data['result']
                return {
                    'valid': True,
                    'username': self._bot_info.get('username'),
                    'bot_id': self._bot_info.get('id')
                }
            else:
                # MAJOR FIX #8: Don't expose token in error
                error_desc = data.get('description', 'Invalid token')
                self._log_error(f"Token validation failed: {error_desc}")
                return {
                    'valid': False,
                    'error': self._translate_error(error_desc)
                }
        except requests.exceptions.Timeout:
            self._log_error("Token validation timed out")
            return {
                'valid': False,
                'error': "Connection timed out. Please check your internet connection."
            }
        except requests.exceptions.RequestException as e:
            self._log_error("Token validation request failed", e)
            return {
                'valid': False,
                'error': f"Connection error: Please check your internet connection."
            }
    
    def check_channel_admin(self, channel_id: str) -> Dict[str, Any]:
        """
        Check if bot is admin in the channel with posting permissions.
        """
        try:
            # First, try to get chat info
            resp = requests.get(
                f"{self.api_url}/getChat",
                params={'chat_id': channel_id},
                timeout=10
            )
            data = resp.json()
            
            if not data.get('ok'):
                error_desc = data.get('description', 'Cannot access channel')
                return {
                    'valid': False,
                    'error': self._translate_error(error_desc)
                }
            
            chat_info = data['result']
            
            # Must verify bot is admin
            if not self._bot_info:
                return {
                    'valid': False,
                    'error': 'Bot information not available. Validate token first.'
                }
            
            # Check bot's member status
            resp = requests.get(
                f"{self.api_url}/getChatMember",
                params={
                    'chat_id': channel_id,
                    'user_id': self._bot_info['id']
                },
                timeout=10
            )
            member_data = resp.json()
            
            if not member_data.get('ok'):
                error_desc = member_data.get('description', 'Unknown error')
                return {
                    'valid': False,
                    'error': self._translate_error(
                        f"Cannot check bot status: {error_desc}"
                    )
                }
            
            status = member_data['result'].get('status')
            
            # Only these statuses can post messages
            if status in ['administrator', 'creator']:
                # Verify posting permissions for administrators
                if status == 'administrator':
                    can_post = member_data['result'].get('can_post_messages', False)
                    if not can_post:
                        return {
                            'valid': False,
                            'error': 'Bot is admin but lacks permission to post messages.\n\n' +
                                   '✓ Solution: In channel settings, edit bot admin permissions and enable "Post Messages".'
                        }
                
                return {
                    'valid': True,
                    'chat_title': chat_info.get('title'),
                    'chat_type': chat_info.get('type'),
                    'status': status
                }
            else:
                return {
                    'valid': False,
                    'error': f'Bot must be administrator in the channel.\n\n' +
                           f'Current status: {status}\n\n' +
                           f'✓ Solution: Add bot as admin with posting rights in channel settings.'
                }
            
        except requests.exceptions.Timeout:
            self._log_error("Channel check timed out")
            return {
                'valid': False,
                'error': "Connection timed out. Please check your internet connection."
            }
        except requests.exceptions.RequestException as e:
            self._log_error("Channel check request failed", e)
            return {
                'valid': False,
                'error': "Connection error. Please check your internet connection."
            }
    
    def _translate_error(self, error_desc: str) -> str:
        """Translate Telegram API errors to user-friendly messages."""
        error_map = {
            'Bad Request: chat not found': 'Channel not found.\n\n✓ Check the channel ID is correct.',
            'Bad Request: have no rights': 'Bot lacks permissions.\n\n✓ Add bot as admin with posting rights.',
            'Bad Request: TOKEN_INVALID': 'Bot token is invalid or revoked.',
            'Bad Request: message is too long': 'File name is too long. Rename the file.',
            'Too Many Requests': 'Too many requests. Please wait and try again.',
            'Forbidden: bot was blocked by the user': 'Bot was blocked by user.',
            'Bad Request: CHAT_WRITE_FORBIDDEN': 'Bot cannot write to this channel.\n\n✓ Add bot as admin.',
        }
        
        for key, friendly_msg in error_map.items():
            if key in error_desc:
                return friendly_msg
        
        return error_desc
    
    def upload_file(
        self,
        channel_id: str,
        file_path: str,
        progress_callback: Optional[Callable[[int, int], None]] = None,
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """
        Upload a file to the channel with retry logic.
        MAJOR FIX #8: Exponential backoff and better error handling.
        """
        if not os.path.exists(file_path):
            return {'success': False, 'error': 'File not found'}
        
        file_size = os.path.getsize(file_path)
        
        if file_size > MAX_FILE_SIZE:
            return {
                'success': False,
                'error': f'File too large ({file_size / 1024 / 1024 / 1024:.2f}GB > 2GB limit)'
            }
        
        if file_size == 0:
            return {'success': False, 'error': 'File is empty'}
        
        file_name = os.path.basename(file_path)
        
        # Retry with exponential backoff
        for attempt in range(max_retries):
            try:
                with open(file_path, 'rb') as f:
                    files = {'document': (file_name, f)}
                    data = {'chat_id': channel_id}
                    
                    # MAJOR FIX #8: Adjust timeout based on file size
                    timeout = min(UPLOAD_TIMEOUT, max(60, file_size / 1024 / 1024 * 2))
                    
                    resp = requests.post(
                        f"{self.api_url}/sendDocument",
                        data=data,
                        files=files,
                        timeout=timeout
                    )
                
                result = resp.json()
                
                if result.get('ok'):
                    message = result['result']
                    doc = message.get('document', {})
                    
                    # Get file_id
                    file_id = doc.get('file_id')
                    if not file_id:
                        # Try other media types
                        for media_type in ['video', 'audio', 'photo', 'animation']:
                            media = message.get(media_type)
                            if media:
                                if isinstance(media, list):
                                    file_id = media[-1].get('file_id')
                                else:
                                    file_id = media.get('file_id')
                                break
                    
                    return {
                        'success': True,
                        'file_id': file_id,
                        'message_id': message['message_id'],
                        'file_name': file_name
                    }
                else:
                    error = result.get('description', 'Upload failed')
                    friendly_error = self._translate_error(error)
                    
                    # Handle rate limiting with retry
                    if 'retry after' in error.lower():
                        retry_after = result.get('parameters', {}).get('retry_after', 30)
                        
                        if attempt < max_retries - 1:
                            logger.warning(f"Rate limited, waiting {retry_after}s before retry {attempt + 1}/{max_retries}")
                            time.sleep(retry_after)
                            continue
                        
                        return {
                            'success': False,
                            'error': f'Rate limited. Retry after {retry_after}s',
                            'retry_after': retry_after
                        }
                    
                    # Retry on temporary errors
                    if attempt < max_retries - 1 and any(err in error.lower() for err in ['timeout', 'network', 'temporary']):
                        wait_time = (2 ** attempt) * 5  # Exponential backoff: 5s, 10s, 20s
                        logger.warning(f"Upload failed, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                        time.sleep(wait_time)
                        continue
                    
                    return {'success': False, 'error': friendly_error}
                    
            except requests.exceptions.Timeout:
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) * 5
                    logger.warning(f"Upload timed out, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                    continue
                
                return {'success': False, 'error': 'Upload timed out. File may be too large or connection slow.'}
                
            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) * 5
                    self._log_error(f"Upload request failed, retrying in {wait_time}s", e)
                    time.sleep(wait_time)
                    continue
                
                self._log_error("Upload request failed after all retries", e)
                return {'success': False, 'error': 'Network error. Please check your internet connection.'}
                
            except Exception as e:
                self._log_error("Unexpected error during upload", e)
                return {'success': False, 'error': f'Unexpected error: {type(e).__name__}'}
        
        return {'success': False, 'error': 'Upload failed after all retries'}
    
    def delete_message(self, channel_id: str, message_id: int) -> bool:
        """Delete a message from the channel."""
        try:
            resp = requests.post(
                f"{self.api_url}/deleteMessage",
                data={
                    'chat_id': channel_id,
                    'message_id': message_id
                },
                timeout=10
            )
            return resp.json().get('ok', False)
        except Exception as e:
            self._log_error(f"Failed to delete message {message_id}", e)
            return False
    
    def get_bot_username(self) -> Optional[str]:
        """Get the bot's username."""
        if self._bot_info:
            return self._bot_info.get('username')
        return None
