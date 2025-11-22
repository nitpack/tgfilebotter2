"""
PyQt5 GUI for the File Uploader application.
"""

import sys
import os
from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QLabel, QLineEdit, QPushButton, QTextEdit, QProgressBar,
    QFileDialog, QRadioButton, QButtonGroup, QGroupBox, QMessageBox,
    QFrame, QSplitter, QApplication
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal, QSize
from PyQt5.QtGui import QFont, QColor, QPalette, QIcon

from config import WINDOW_WIDTH, WINDOW_HEIGHT, COLORS, BOT_TOKEN_PATTERN, CHANNEL_ID_PATTERN
from uploader import Uploader, UploadResult

class UploadWorker(QThread):
    """Background worker for upload process."""
    
    log_signal = pyqtSignal(str, str)  # message, level
    progress_signal = pyqtSignal(int, int, str)  # current, total, message
    finished_signal = pyqtSignal(object)  # UploadResult
    
    def __init__(self, bot_token, channel_id, folder_path, is_update_mode):
        super().__init__()
        self.bot_token = bot_token
        self.channel_id = channel_id
        self.folder_path = folder_path
        self.is_update_mode = is_update_mode
        self.uploader = None
    
    def run(self):
        self.uploader = Uploader(
            bot_token=self.bot_token,
            channel_id=self.channel_id,
            folder_path=self.folder_path,
            is_update_mode=self.is_update_mode,
            log_callback=lambda msg, level: self.log_signal.emit(msg, level),
            progress_callback=lambda cur, total, msg: self.progress_signal.emit(cur, total, msg)
        )
        
        result = self.uploader.run()
        self.finished_signal.emit(result)
    
    def cancel(self):
        if self.uploader:
            self.uploader.cancel()


class MainWindow(QMainWindow):
    """Main application window."""
    
    def __init__(self):
        super().__init__()
        self.worker = None
        self.init_ui()
    
    def init_ui(self):
        self.setWindowTitle("Telegram Bot File Uploader v1.0")
        self.setMinimumSize(WINDOW_WIDTH, WINDOW_HEIGHT)
        self.resize(WINDOW_WIDTH, WINDOW_HEIGHT)
        
        # Central widget
        central = QWidget()
        self.setCentralWidget(central)
        
        # Main layout
        layout = QVBoxLayout(central)
        layout.setSpacing(15)
        layout.setContentsMargins(20, 20, 20, 20)
        
        # Title
        title = QLabel("📁 Telegram Bot File Uploader")
        title.setFont(QFont("Segoe UI", 18, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet(f"color: {COLORS['primary']}; margin-bottom: 10px;")
        layout.addWidget(title)
        
        # Configuration section
        config_group = QGroupBox("Configuration")
        config_group.setFont(QFont("Segoe UI", 10))
        config_layout = QGridLayout(config_group)
        config_layout.setSpacing(10)
        
        # Folder selection
        config_layout.addWidget(QLabel("Folder:"), 0, 0)
        self.folder_input = QLineEdit()
        self.folder_input.setPlaceholderText("Select folder to upload...")
        self.folder_input.setReadOnly(True)
        config_layout.addWidget(self.folder_input, 0, 1)
        
        self.browse_btn = QPushButton("Browse...")
        self.browse_btn.clicked.connect(self.browse_folder)
        self.browse_btn.setFixedWidth(100)
        config_layout.addWidget(self.browse_btn, 0, 2)
        
        # Bot token
        config_layout.addWidget(QLabel("Bot Token:"), 1, 0)
        self.token_input = QLineEdit()
        self.token_input.setPlaceholderText("123456789:ABCdefGHIjklMNOpqrsTUVwxyz...")
        self.token_input.setEchoMode(QLineEdit.Password)
        config_layout.addWidget(self.token_input, 1, 1, 1, 2)
        
        # Channel ID
        config_layout.addWidget(QLabel("Channel ID:"), 2, 0)
        self.channel_input = QLineEdit()
        self.channel_input.setPlaceholderText("@your_channel or -100123456789")
        config_layout.addWidget(self.channel_input, 2, 1, 1, 2)
        
        layout.addWidget(config_group)
        
        # Mode selection
        mode_group = QGroupBox("Upload Mode")
        mode_group.setFont(QFont("Segoe UI", 10))
        mode_layout = QHBoxLayout(mode_group)
        
        self.mode_group = QButtonGroup(self)
        
        self.new_upload_radio = QRadioButton("New Upload")
        self.new_upload_radio.setChecked(True)
        self.new_upload_radio.setToolTip("Upload all files as a new bot")
        self.mode_group.addButton(self.new_upload_radio, 0)
        mode_layout.addWidget(self.new_upload_radio)
        
        self.update_radio = QRadioButton("Update Existing")
        self.update_radio.setToolTip("Update existing bot - only upload changed files")
        self.mode_group.addButton(self.update_radio, 1)
        mode_layout.addWidget(self.update_radio)
        
        mode_layout.addStretch()
        layout.addWidget(mode_group)
        
        # Progress section
        progress_group = QGroupBox("Progress")
        progress_group.setFont(QFont("Segoe UI", 10))
        progress_layout = QVBoxLayout(progress_group)
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setMinimum(0)
        self.progress_bar.setMaximum(100)
        self.progress_bar.setValue(0)
        self.progress_bar.setTextVisible(True)
        self.progress_bar.setFormat("%p% - %v/%m")
        progress_layout.addWidget(self.progress_bar)
        
        self.status_label = QLabel("Ready")
        self.status_label.setAlignment(Qt.AlignCenter)
        self.status_label.setStyleSheet("color: #6b7280;")
        progress_layout.addWidget(self.status_label)
        
        layout.addWidget(progress_group)
        
        # Log window
        log_group = QGroupBox("Log")
        log_group.setFont(QFont("Segoe UI", 10))
        log_layout = QVBoxLayout(log_group)
        
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setFont(QFont("Consolas", 9))
        self.log_text.setStyleSheet("""
            QTextEdit {
                background-color: #1f2937;
                color: #f3f4f6;
                border: 1px solid #374151;
                border-radius: 4px;
            }
        """)
        log_layout.addWidget(self.log_text)
        
        layout.addWidget(log_group, 1)  # Give log more space
        
        # Buttons
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(10)
        
        self.start_btn = QPushButton("▶ Start Upload")
        self.start_btn.setFont(QFont("Segoe UI", 11, QFont.Bold))
        self.start_btn.clicked.connect(self.start_upload)
        self.start_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['success']};
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 6px;
            }}
            QPushButton:hover {{
                background-color: #059669;
            }}
            QPushButton:disabled {{
                background-color: #9ca3af;
            }}
        """)
        btn_layout.addWidget(self.start_btn)
        
        self.cancel_btn = QPushButton("✕ Cancel")
        self.cancel_btn.setFont(QFont("Segoe UI", 11))
        self.cancel_btn.clicked.connect(self.cancel_upload)
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['danger']};
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 6px;
            }}
            QPushButton:hover {{
                background-color: #dc2626;
            }}
            QPushButton:disabled {{
                background-color: #9ca3af;
            }}
        """)
        btn_layout.addWidget(self.cancel_btn)
        
        self.clear_btn = QPushButton("Clear Log")
        self.clear_btn.setFont(QFont("Segoe UI", 10))
        self.clear_btn.clicked.connect(self.clear_log)
        self.clear_btn.setStyleSheet("""
            QPushButton {
                background-color: #6b7280;
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 6px;
            }
            QPushButton:hover {
                background-color: #4b5563;
            }
        """)
        btn_layout.addWidget(self.clear_btn)
        
        btn_layout.addStretch()
        layout.addLayout(btn_layout)
        
        # Apply global styles
        self.setStyleSheet("""
            QMainWindow {
                background-color: #f3f4f6;
            }
            QGroupBox {
                font-weight: bold;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                margin-top: 10px;
                padding-top: 10px;
                background-color: white;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px;
            }
            QLineEdit {
                padding: 8px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                background-color: white;
            }
            QLineEdit:focus {
                border-color: #2563eb;
            }
            QRadioButton {
                spacing: 8px;
            }
            QProgressBar {
                border: 1px solid #d1d5db;
                border-radius: 4px;
                text-align: center;
                height: 25px;
            }
            QProgressBar::chunk {
                background-color: #2563eb;
                border-radius: 3px;
            }
        """)
        
        self.log_message("Application ready. Select a folder and enter bot credentials.", "info")
    
    def browse_folder(self):
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Folder to Upload",
            os.path.expanduser("~"),
            QFileDialog.ShowDirsOnly
        )
        if folder:
            self.folder_input.setText(folder)
            self.log_message(f"Selected folder: {folder}", "info")
    
    def validate_inputs(self) -> bool:
        """Validate all inputs before starting upload."""
        errors = []
        
        # Check folder
        folder = self.folder_input.text().strip()
        if not folder:
            errors.append("Please select a folder to upload")
        elif not os.path.isdir(folder):
            errors.append("Selected folder does not exist")
        
        # Check bot token
        token = self.token_input.text().strip()
        if not token:
            errors.append("Please enter your bot token")
        elif not BOT_TOKEN_PATTERN.match(token):
            errors.append("Invalid bot token format")
        
        # Check channel ID
        channel = self.channel_input.text().strip()
        if not channel:
            errors.append("Please enter your channel ID")
        elif not CHANNEL_ID_PATTERN.match(channel):
            errors.append("Invalid channel ID format (use @channel or -100...)")
        
        if errors:
            QMessageBox.warning(
                self,
                "Validation Error",
                "\n".join(f"• {e}" for e in errors)
            )
            return False
        
        return True
    
    def start_upload(self):
        if not self.validate_inputs():
            return
        
        # Confirm if update mode but might be new
        if self.update_radio.isChecked():
            reply = QMessageBox.question(
                self,
                "Update Mode",
                "Update mode will only upload changed files.\n"
                "Make sure this bot already exists on the server.\n\n"
                "Continue with update mode?",
                QMessageBox.Yes | QMessageBox.No
            )
            if reply == QMessageBox.No:
                return
        
        # Disable inputs
        self.set_inputs_enabled(False)
        self.start_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        
        # Reset progress
        self.progress_bar.setValue(0)
        self.progress_bar.setMaximum(100)
        self.status_label.setText("Starting...")
        
        # Clear log
        self.log_text.clear()
        self.log_message("=" * 50, "info")
        self.log_message("Starting upload process...", "info")
        self.log_message("=" * 50, "info")
        
        # Start worker thread
        self.worker = UploadWorker(
            bot_token=self.token_input.text().strip(),
            channel_id=self.channel_input.text().strip(),
            folder_path=self.folder_input.text().strip(),
            is_update_mode=self.update_radio.isChecked()
        )
        
        self.worker.log_signal.connect(self.log_message)
        self.worker.progress_signal.connect(self.update_progress)
        self.worker.finished_signal.connect(self.upload_finished)
        
        self.worker.start()
    
    def cancel_upload(self):
        if self.worker and self.worker.isRunning():
            reply = QMessageBox.question(
                self,
                "Cancel Upload",
                "Are you sure you want to cancel the upload?\n"
                "Files already uploaded will remain in the channel.",
                QMessageBox.Yes | QMessageBox.No
            )
            if reply == QMessageBox.Yes:
                self.log_message("Cancelling upload...", "warning")
                self.worker.cancel()
                self.status_label.setText("Cancelling...")
    
    def upload_finished(self, result: UploadResult):
        self.set_inputs_enabled(True)
        self.start_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)
        
        self.log_message("=" * 50, "info")
        
        if result.success:
            self.progress_bar.setValue(100)
            self.status_label.setText("✓ Upload Complete!")
            self.status_label.setStyleSheet(f"color: {COLORS['success']}; font-weight: bold;")
            
            self.log_message("✓ UPLOAD SUCCESSFUL!", "success")
            self.log_message(f"Bot ID: {result.bot_id}", "info")
            self.log_message(f"Status: {result.status}", "info")
            self.log_message(f"Files uploaded: {result.files_uploaded}", "info")
            if result.files_skipped > 0:
                self.log_message(f"Files skipped (unchanged): {result.files_skipped}", "info")
            
            QMessageBox.information(
                self,
                "Success",
                f"Upload completed successfully!\n\n"
                f"Bot ID: {result.bot_id}\n"
                f"Status: {result.status}\n"
                f"Files uploaded: {result.files_uploaded}"
            )
        else:
            self.status_label.setText("✗ Upload Failed")
            self.status_label.setStyleSheet(f"color: {COLORS['danger']}; font-weight: bold;")
            
            self.log_message(f"✗ UPLOAD FAILED: {result.message}", "error")
            
            if result.errors:
                for err in result.errors:
                    self.log_message(f"  Error: {err}", "error")
            
            QMessageBox.critical(
                self,
                "Upload Failed",
                f"Upload failed!\n\n{result.message}"
            )
        
        self.log_message("=" * 50, "info")
        self.worker = None
    
    def update_progress(self, current: int, total: int, message: str):
        if total > 0:
            self.progress_bar.setMaximum(total)
            self.progress_bar.setValue(current)
            self.progress_bar.setFormat(f"%p% - {current}/{total}")
        self.status_label.setText(message)
    
    def log_message(self, message: str, level: str = "info"):
        colors = {
            "info": "#f3f4f6",
            "success": "#10b981",
            "warning": "#f59e0b",
            "error": "#ef4444"
        }
        color = colors.get(level, colors["info"])
        
        self.log_text.append(f'<span style="color: {color};">{message}</span>')
        
        # Auto-scroll to bottom
        scrollbar = self.log_text.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())
    
    def clear_log(self):
        self.log_text.clear()
        self.log_message("Log cleared.", "info")
    
    def set_inputs_enabled(self, enabled: bool):
        self.folder_input.setEnabled(enabled)
        self.browse_btn.setEnabled(enabled)
        self.token_input.setEnabled(enabled)
        self.channel_input.setEnabled(enabled)
        self.new_upload_radio.setEnabled(enabled)
        self.update_radio.setEnabled(enabled)
    
    def closeEvent(self, event):
        if self.worker and self.worker.isRunning():
            reply = QMessageBox.question(
                self,
                "Confirm Exit",
                "Upload is in progress. Are you sure you want to exit?",
                QMessageBox.Yes | QMessageBox.No
            )
            if reply == QMessageBox.No:
                event.ignore()
                return
            self.worker.cancel()
            self.worker.wait(3000)
        event.accept()
