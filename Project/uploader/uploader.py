"""
Core upload orchestration logic.
"""

import time
from typing import Dict, Any, Optional, Callable, List
from telegram_api import TelegramAPI
from file_scanner import FileScanner
from json_builder import JsonBuilder
from api_client import APIClient

class UploadResult:
    """Container for upload results."""
    def __init__(self):
        self.success = False
        self.bot_id = None
        self.status = None
        self.message = ""
        self.files_uploaded = 0
        self.files_skipped = 0
        self.files_failed = 0
        self.errors = []
        self.warnings = []

class Uploader:
    """Orchestrates the complete upload process."""
    
    def __init__(
        self,
        bot_token: str,
        channel_id: str,
        folder_path: str,
        is_update_mode: bool = False,
        log_callback: Callable[[str, str], None] = None,
        progress_callback: Callable[[int, int, str], None] = None
    ):
        self.bot_token = bot_token
        self.channel_id = channel_id
        self.folder_path = folder_path
        self.is_update_mode = is_update_mode
        self.log = log_callback or (lambda msg, level: print(f"[{level}] {msg}"))
        self.progress = progress_callback or (lambda cur, total, msg: None)
        
        self.telegram = TelegramAPI(bot_token)
        self.scanner = FileScanner()
        self.json_builder = JsonBuilder()
        self.api_client = APIClient()
        
        self._cancelled = False
        self._current_structure = None
        self._existing_metadata = None
        self._changes = None
    
    def cancel(self):
        """Cancel the upload process."""
        self._cancelled = True
    
    def is_cancelled(self) -> bool:
        return self._cancelled
    
    def validate_inputs(self) -> Dict[str, Any]:
        """Validate bot token and channel before starting."""
        self.log("Validating bot token...", "info")
        
        # Validate bot token
        token_result = self.telegram.validate_token()
        if not token_result.get('valid'):
            return {
                'valid': False,
                'error': f"Invalid bot token: {token_result.get('error')}"
            }
        
        bot_username = token_result.get('username')
        self.log(f"✓ Bot validated: @{bot_username}", "success")
        
        # Validate channel access
        self.log("Checking channel access...", "info")
        channel_result = self.telegram.check_channel_admin(self.channel_id)
        if not channel_result.get('valid'):
            return {
                'valid': False,
                'error': f"Channel error: {channel_result.get('error')}"
            }
        
        self.log(f"✓ Channel access confirmed: {channel_result.get('chat_title', self.channel_id)}", "success")
        
        # Check server connection
        self.log("Checking server connection...", "info")
        server_result = self.api_client.check_connection()
        if not server_result.get('connected'):
            return {
                'valid': False,
                'error': f"Server error: {server_result.get('error')}"
            }
        
        self.log("✓ Server connection OK", "success")
        
        return {
            'valid': True,
            'bot_username': f"@{bot_username}"
        }
    
    def run(self) -> UploadResult:
        """Execute the complete upload process."""
        result = UploadResult()
        
        try:
            # Step 1: Validate inputs
            validation = self.validate_inputs()
            if not validation.get('valid'):
                result.message = validation.get('error')
                result.errors.append(validation.get('error'))
                return result
            
            bot_username = validation.get('bot_username')
            
            if self._cancelled:
                result.message = "Upload cancelled"
                return result
            
            # Step 2: Scan local directory
            self.log("Scanning directory...", "info")
            self._current_structure = self.scanner.scan_directory(
                self.folder_path,
                lambda cur, total, msg: self.progress(cur, total, msg)
            )
            
            if self._current_structure is None:
                result.message = "Failed to scan directory"
                result.errors.extend(self.scanner.errors)
                return result
            
            summary = self.scanner.get_summary()
            self.log(
                f"✓ Found {summary['total_files']} files in {summary['total_folders']} folders "
                f"({summary['total_size_mb']} MB)",
                "success"
            )
            
            if summary['errors']:
                for err in summary['errors']:
                    self.log(f"⚠ {err}", "warning")
                    result.warnings.append(err)
            
            if summary['warnings']:
                for warn in summary['warnings']:
                    self.log(f"⚠ {warn}", "warning")
                    result.warnings.append(warn)
            
            if self._cancelled:
                result.message = "Upload cancelled"
                return result
            
            # Step 3: Handle update mode
            files_to_upload = []
            files_to_delete = []
            
            if self.is_update_mode:
                self.log("Update mode: Fetching existing metadata...", "info")
                self._existing_metadata = self.api_client.get_bot_metadata(self.bot_token)
                
                if self._existing_metadata:
                    self.log("✓ Existing metadata retrieved", "success")
                    
                    # Compare structures
                    self._changes = self.json_builder.compare_structures(
                        self._existing_metadata,
                        self._current_structure
                    )
                    
                    change_pct = self.json_builder.calculate_change_percentage(self._changes)
                    change_summary = self._changes['summary']
                    
                    self.log(
                        f"Changes detected: {change_summary['added_count']} added, "
                        f"{change_summary['removed_count']} removed, "
                        f"{change_summary['modified_count']} modified, "
                        f"{change_summary['unchanged_count']} unchanged "
                        f"({change_pct:.1f}% change)",
                        "info"
                    )
                    
                    # Merge to preserve existing file_ids for unchanged files
                    self._current_structure = self.json_builder.merge_with_existing(
                        self._existing_metadata,
                        self._changes,
                        self._current_structure
                    )
                    
                    files_to_upload = self.json_builder.get_files_to_upload(self._current_structure)
                    files_to_delete = self.json_builder.get_files_to_delete(self._changes)
                    
                    result.files_skipped = change_summary['unchanged_count']
                    
                else:
                    self.log("⚠ No existing metadata found, treating as new upload", "warning")
                    files_to_upload = self.scanner.get_all_files(self._current_structure)
            else:
                files_to_upload = self.scanner.get_all_files(self._current_structure)
            
            if self._cancelled:
                result.message = "Upload cancelled"
                return result
            
            # Step 4: Delete removed/modified files from channel (update mode)
            if files_to_delete:
                self.log(f"Removing {len(files_to_delete)} old files from channel...", "info")
                for file_info in files_to_delete:
                    if self._cancelled:
                        break
                    msg_id = file_info.get('messageId')
                    if msg_id:
                        self.telegram.delete_message(self.channel_id, msg_id)
                self.log("✓ Old files removed", "success")
            
            # Step 5: Upload files to Telegram
            total_files = len(files_to_upload)
            
            if total_files == 0:
                self.log("No new files to upload", "info")
            else:
                self.log(f"Uploading {total_files} files to Telegram...", "info")
                
                for idx, file_info in enumerate(files_to_upload):
                    if self._cancelled:
                        result.message = "Upload cancelled"
                        return result
                    
                    file_path = file_info.get('filePath')
                    file_name = file_info.get('fileName')
                    
                    self.progress(idx + 1, total_files, f"Uploading: {file_name}")
                    self.log(f"[{idx + 1}/{total_files}] Uploading: {file_name}", "info")
                    
                    # Upload with retry logic
                    upload_result = self._upload_with_retry(file_path)
                    
                    if upload_result.get('success'):
                        # Update structure with file_id and message_id
                        self.json_builder.update_file_ids(
                            self._current_structure,
                            file_path,
                            upload_result['file_id'],
                            upload_result['message_id']
                        )
                        result.files_uploaded += 1
                    else:
                        error_msg = f"Failed to upload {file_name}: {upload_result.get('error')}"
                        self.log(f"✗ {error_msg}", "error")
                        result.errors.append(error_msg)
                        result.files_failed += 1
                
                self.log(f"✓ Uploaded {result.files_uploaded} files", "success")
            
            if self._cancelled:
                result.message = "Upload cancelled"
                return result
            
            # Step 6: Send metadata to server
            self.log("Sending metadata to server...", "info")
            
            cleaned_metadata = self.json_builder.clean_metadata_for_server(self._current_structure)
            
            server_result = self.api_client.upload_metadata(
                self.bot_token,
                self.channel_id,
                bot_username,
                cleaned_metadata
            )
            
            if server_result.get('success'):
                result.success = True
                result.bot_id = server_result.get('botId')
                result.status = server_result.get('status')
                result.message = server_result.get('message', 'Upload completed successfully!')
                
                self.log(f"✓ {result.message}", "success")
                self.log(f"Bot ID: {result.bot_id}", "info")
                self.log(f"Status: {result.status}", "info")
                
                if server_result.get('isUpdate'):
                    self.log(f"Change percentage: {server_result.get('changePercentage', 0):.1f}%", "info")
            else:
                result.message = f"Server error: {server_result.get('error')}"
                result.errors.append(result.message)
                self.log(f"✗ {result.message}", "error")
                
                if server_result.get('details'):
                    for detail in server_result['details']:
                        self.log(f"  - {detail.get('msg', detail)}", "error")
            
            return result
            
        except Exception as e:
            result.message = f"Unexpected error: {str(e)}"
            result.errors.append(result.message)
            self.log(f"✗ {result.message}", "error")
            return result
    
    def _upload_with_retry(self, file_path: str, max_retries: int = 3) -> Dict[str, Any]:
        """Upload a file with retry logic for rate limiting."""
        for attempt in range(max_retries):
            if self._cancelled:
                return {'success': False, 'error': 'Cancelled'}
            
            result = self.telegram.upload_file(self.channel_id, file_path)
            
            if result.get('success'):
                return result
            
            # Handle rate limiting
            retry_after = result.get('retry_after')
            if retry_after and attempt < max_retries - 1:
                self.log(f"Rate limited, waiting {retry_after}s...", "warning")
                time.sleep(retry_after)
                continue
            
            # Other errors - retry with backoff
            if attempt < max_retries - 1:
                wait_time = (attempt + 1) * 5
                self.log(f"Upload failed, retrying in {wait_time}s...", "warning")
                time.sleep(wait_time)
            
        return result
