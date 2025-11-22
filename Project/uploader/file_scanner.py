"""
Recursive file and folder scanner with validation.
"""

import os
import re
from typing import Dict, List, Any, Tuple, Optional
from config import (
    FOLDER_NAME_PATTERN, 
    DANGEROUS_PATTERNS, 
    MAX_FILE_SIZE
)


class FileScanner:
    """Scans directories and builds file structure."""
    
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.total_files = 0
        self.total_folders = 0
        self.total_size = 0
        self.skipped_files = []
    
    def reset(self):
        """Reset scanner state."""
        self.errors = []
        self.warnings = []
        self.total_files = 0
        self.total_folders = 0
        self.total_size = 0
        self.skipped_files = []
    
    def validate_folder_name(self, name: str) -> Tuple[bool, Optional[str]]:
        """Validate a folder name for safety and compatibility."""
        if not name or not name.strip():
            return False, "Folder name is empty"
        
        name = name.strip()
        
        # Check length
        if len(name) > 255:
            return False, f"Folder name too long ({len(name)} > 255 chars)"
        
        # Check for path traversal
        if '..' in name or '/' in name or '\\' in name:
            return False, "Path traversal characters not allowed"
        
        # Check for dangerous patterns
        for pattern in DANGEROUS_PATTERNS:
            if pattern.search(name):
                return False, "Potentially dangerous characters detected"
        
        # Check for valid characters (allow Unicode for Arabic, etc.)
        # More permissive pattern for international names
        if not re.match(r'^[^<>:"|?*\x00-\x1f]+$', name):
            return False, "Invalid characters in folder name"
        
        return True, None
    
    def validate_file_name(self, name: str) -> Tuple[bool, Optional[str]]:
        """Validate a file name."""
        if not name or not name.strip():
            return False, "File name is empty"
        
        name = name.strip()
        
        if len(name) > 255:
            return False, f"File name too long ({len(name)} > 255 chars)"
        
        # Check for path traversal
        if '..' in name or '/' in name or '\\' in name:
            return False, "Path traversal characters not allowed"
        
        return True, None
    
    def scan_directory(
        self, 
        root_path: str,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Scan a directory recursively and build structure.
        Returns a dictionary representing the folder hierarchy.
        """
        self.reset()
        
        if not os.path.exists(root_path):
            self.errors.append(f"Directory not found: {root_path}")
            return None
        
        if not os.path.isdir(root_path):
            self.errors.append(f"Not a directory: {root_path}")
            return None
        
        # First pass: count total items for progress
        total_items = sum(len(files) + len(dirs) for _, dirs, files in os.walk(root_path))
        processed = 0
        
        def scan_folder(folder_path: str, relative_path: str = "") -> Dict[str, Any]:
            nonlocal processed
            
            result = {
                'files': [],
                'subfolders': {}
            }
            
            try:
                entries = os.listdir(folder_path)
            except PermissionError:
                self.errors.append(f"Permission denied: {folder_path}")
                return result
            except Exception as e:
                self.errors.append(f"Error reading {folder_path}: {str(e)}")
                return result
            
            # Sort entries (Unicode-aware)
            entries.sort(key=lambda x: x.lower())
            
            for entry in entries:
                entry_path = os.path.join(folder_path, entry)
                entry_relative = os.path.join(relative_path, entry) if relative_path else entry
                
                processed += 1
                if progress_callback and total_items > 0:
                    progress_callback(processed, total_items, f"Scanning: {entry}")
                
                if os.path.isdir(entry_path):
                    # Validate folder name
                    valid, error = self.validate_folder_name(entry)
                    if not valid:
                        self.errors.append(f"Invalid folder '{entry}': {error}")
                        continue
                    
                    self.total_folders += 1
                    
                    # Recursively scan subfolder
                    result['subfolders'][entry] = scan_folder(entry_path, entry_relative)
                    
                elif os.path.isfile(entry_path):
                    # Validate file name
                    valid, error = self.validate_file_name(entry)
                    if not valid:
                        self.warnings.append(f"Skipping file '{entry}': {error}")
                        self.skipped_files.append(entry_path)
                        continue
                    
                    # Check file size
                    try:
                        file_size = os.path.getsize(entry_path)
                    except:
                        self.warnings.append(f"Cannot read file size: {entry}")
                        self.skipped_files.append(entry_path)
                        continue
                    
                    if file_size > MAX_FILE_SIZE:
                        self.warnings.append(
                            f"Skipping '{entry}': exceeds 2GB limit "
                            f"({file_size / 1024 / 1024 / 1024:.2f}GB)"
                        )
                        self.skipped_files.append(entry_path)
                        continue
                    
                    if file_size == 0:
                        self.warnings.append(f"Skipping empty file: {entry}")
                        self.skipped_files.append(entry_path)
                        continue
                    
                    self.total_files += 1
                    self.total_size += file_size
                    
                    # Add file info (file_id and message_id will be added during upload)
                    result['files'].append({
                        'fileName': entry,
                        'filePath': entry_path,
                        'fileSize': file_size,
                        'relativePath': entry_relative
                    })
            
            return result
        
        structure = scan_folder(root_path)
        
        return structure
    
    def get_all_files(self, structure: Dict[str, Any], files: List[Dict] = None) -> List[Dict]:
        """Extract flat list of all files from structure."""
        if files is None:
            files = []
        
        if structure.get('files'):
            files.extend(structure['files'])
        
        if structure.get('subfolders'):
            for subfolder in structure['subfolders'].values():
                self.get_all_files(subfolder, files)
        
        return files
    
    def get_summary(self) -> Dict[str, Any]:
        """Get scan summary."""
        return {
            'total_files': self.total_files,
            'total_folders': self.total_folders,
            'total_size': self.total_size,
            'total_size_mb': round(self.total_size / 1024 / 1024, 2),
            'errors': self.errors,
            'warnings': self.warnings,
            'skipped_files': len(self.skipped_files)
        }
