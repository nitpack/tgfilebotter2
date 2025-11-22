"""
Client for communicating with the backend server API.
"""

import requests
import json
from typing import Dict, Any, Optional
from config import API_UPLOAD, API_BOT_STATUS, API_TIMEOUT


class APIClient:
    """Handles all communication with the backend server."""
    
    def __init__(self, server_url: str = None):
        if server_url:
            self.upload_url = f"{server_url}/api/upload"
            self.status_url = f"{server_url}/api/bot-status"
        else:
            self.upload_url = API_UPLOAD
            self.status_url = API_BOT_STATUS
    
    def check_connection(self) -> Dict[str, Any]:
        """Check if server is reachable."""
        try:
            # Try health endpoint
            base_url = self.upload_url.rsplit('/api/', 1)[0]
            resp = requests.get(
                f"{base_url}/health",
                timeout=5
            )
            
            if resp.status_code == 200:
                return {'connected': True, 'status': 'Server online'}
            else:
                return {
                    'connected': False, 
                    'error': f'Server returned status {resp.status_code}'
                }
                
        except requests.exceptions.ConnectionError:
            return {'connected': False, 'error': 'Cannot connect to server'}
        except requests.exceptions.Timeout:
            return {'connected': False, 'error': 'Connection timed out'}
        except Exception as e:
            return {'connected': False, 'error': str(e)}
    
    def get_bot_status(self, bot_token: str) -> Dict[str, Any]:
        """
        Get existing bot status and metadata from server.
        Used for update mode to compare with local files.
        """
        try:
            resp = requests.get(
                f"{self.status_url}/{bot_token}",
                timeout=API_TIMEOUT
            )
            
            data = resp.json()
            
            if resp.status_code == 404:
                return {
                    'exists': False,
                    'error': 'Bot not found on server'
                }
            
            if data.get('success'):
                return {
                    'exists': True,
                    'status': data.get('status'),
                    'botId': data.get('botId'),
                    'botUsername': data.get('botUsername'),
                    'ownerRegistered': data.get('ownerRegistered'),
                    'metadata': data.get('metadata')
                }
            else:
                return {
                    'exists': False,
                    'error': data.get('error', 'Unknown error')
                }
                
        except requests.exceptions.RequestException as e:
            return {'exists': False, 'error': f'Connection error: {str(e)}'}
        except json.JSONDecodeError:
            return {'exists': False, 'error': 'Invalid response from server'}
    
    def get_bot_metadata(self, bot_token: str) -> Optional[Dict[str, Any]]:
        """
        Get full bot metadata from server for comparison.
        This endpoint needs to exist on server for update mode.
        """
        try:
            base_url = self.upload_url.rsplit('/api/', 1)[0]
            resp = requests.get(
                f"{base_url}/api/bot-metadata/{bot_token}",
                timeout=API_TIMEOUT
            )
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get('success'):
                    return data.get('metadata')
            
            return None
            
        except:
            return None
    
    def upload_metadata(
        self,
        bot_token: str,
        channel_id: str,
        bot_username: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Upload bot metadata to the server.
        This is called after all files are uploaded to Telegram.
        """
        try:
            payload = {
                'botToken': bot_token,
                'channelId': channel_id,
                'botUsername': bot_username,
                'metadata': metadata
            }
            
            # Check payload size
            payload_json = json.dumps(payload)
            payload_size = len(payload_json.encode('utf-8'))
            
            resp = requests.post(
                self.upload_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=API_TIMEOUT
            )
            
            data = resp.json()
            
            if resp.status_code == 413:
                return {
                    'success': False,
                    'error': f"Metadata too large ({payload_size / 1024 / 1024:.2f}MB). Reduce folder structure."
                }
            
            if resp.status_code == 429:
                return {
                    'success': False,
                    'error': 'Rate limited. Please wait and try again.'
                }
            
            if data.get('success'):
                return {
                    'success': True,
                    'botId': data.get('botId'),
                    'status': data.get('status'),
                    'message': data.get('message'),
                    'isUpdate': data.get('isUpdate', False),
                    'changePercentage': data.get('changePercentage')
                }
            else:
                return {
                    'success': False,
                    'error': data.get('error', 'Upload failed'),
                    'details': data.get('details')
                }
                
        except requests.exceptions.ConnectionError:
            return {'success': False, 'error': 'Cannot connect to server'}
        except requests.exceptions.Timeout:
            return {'success': False, 'error': 'Server request timed out'}
        except json.JSONDecodeError:
            return {'success': False, 'error': 'Invalid response from server'}
        except Exception as e:
            return {'success': False, 'error': f'Error: {str(e)}'}
    
    def validate_server_response(self, response: Dict) -> bool:
        """Validate that server response has expected format."""
        if not isinstance(response, dict):
            return False
        return 'success' in response or 'error' in response
