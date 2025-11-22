#!/usr/bin/env python3
"""
Build script for creating Windows executable.
Run: python build.py
"""

import os
import sys
import subprocess
import shutil

# Build configuration
APP_NAME = "FileUploader"
APP_VERSION = "1.0.0"
MAIN_SCRIPT = "main.py"
ICON_FILE = "icon.ico"  # Optional: place icon.ico in same folder
OUTPUT_DIR = "dist"
BUILD_DIR = "build"

def check_dependencies():
    """Check if required tools are installed."""
    print("Checking dependencies...")
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("ERROR: Python 3.8 or higher required")
        return False
    print(f"✓ Python {sys.version_info.major}.{sys.version_info.minor}")
    
    # Check PyInstaller
    try:
        import PyInstaller
        print(f"✓ PyInstaller {PyInstaller.__version__}")
    except ImportError:
        print("PyInstaller not found. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)
    
    # Check PyQt5
    try:
        from PyQt5 import QtCore
        print(f"✓ PyQt5 {QtCore.QT_VERSION_STR}")
    except ImportError:
        print("PyQt5 not found. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "PyQt5"], check=True)
    
    # Check requests
    try:
        import requests
        print(f"✓ requests {requests.__version__}")
    except ImportError:
        print("requests not found. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "requests"], check=True)
    
    return True

def clean_build():
    """Clean previous build artifacts."""
    print("\nCleaning previous builds...")
    
    for folder in [BUILD_DIR, OUTPUT_DIR, "__pycache__"]:
        if os.path.exists(folder):
            shutil.rmtree(folder)
            print(f"  Removed {folder}/")
    
    # Remove .spec file
    spec_file = f"{APP_NAME}.spec"
    if os.path.exists(spec_file):
        os.remove(spec_file)
        print(f"  Removed {spec_file}")

def build_executable():
    """Build the Windows executable using PyInstaller."""
    print("\nBuilding executable...")
    
    # PyInstaller command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", APP_NAME,
        "--onefile",           # Single executable
        "--windowed",          # No console window
        "--clean",             # Clean build
        "--noconfirm",         # Overwrite without asking
    ]
    
    # Add icon if exists
    if os.path.exists(ICON_FILE):
        cmd.extend(["--icon", ICON_FILE])
        print(f"  Using icon: {ICON_FILE}")
    
    # Add hidden imports for PyQt5
    hidden_imports = [
        "PyQt5.sip",
        "PyQt5.QtCore",
        "PyQt5.QtGui",
        "PyQt5.QtWidgets",
    ]
    for imp in hidden_imports:
        cmd.extend(["--hidden-import", imp])
    
    # Add data files (config.py needs to be included)
    data_files = ["config.py"]
    for df in data_files:
        if os.path.exists(df):
            cmd.extend(["--add-data", f"{df};."])
    
    # Main script
    cmd.append(MAIN_SCRIPT)
    
    print(f"  Running: {' '.join(cmd)}")
    print()
    
    # Run PyInstaller
    result = subprocess.run(cmd)
    
    return result.returncode == 0

def post_build():
    """Post-build tasks."""
    print("\nPost-build tasks...")
    
    exe_path = os.path.join(OUTPUT_DIR, f"{APP_NAME}.exe")
    
    if os.path.exists(exe_path):
        file_size = os.path.getsize(exe_path) / 1024 / 1024
        print(f"  ✓ Executable created: {exe_path}")
        print(f"  ✓ File size: {file_size:.1f} MB")
        
        # Rename to include version
        final_name = f"{APP_NAME}_v{APP_VERSION}.exe"
        final_path = os.path.join(OUTPUT_DIR, final_name)
        
        if os.path.exists(final_path):
            os.remove(final_path)
        
        os.rename(exe_path, final_path)
        print(f"  ✓ Renamed to: {final_name}")
        
        return final_path
    else:
        print("  ✗ Executable not found!")
        return None

def cleanup_temp():
    """Clean up temporary build files."""
    print("\nCleaning up temporary files...")
    
    # Remove build directory
    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)
        print(f"  Removed {BUILD_DIR}/")
    
    # Remove .spec file
    spec_file = f"{APP_NAME}.spec"
    if os.path.exists(spec_file):
        os.remove(spec_file)
        print(f"  Removed {spec_file}")
    
    # Remove __pycache__
    for root, dirs, files in os.walk("."):
        for d in dirs:
            if d == "__pycache__":
                path = os.path.join(root, d)
                shutil.rmtree(path)
                print(f"  Removed {path}")

def main():
    print("=" * 60)
    print(f"  Building {APP_NAME} v{APP_VERSION}")
    print("=" * 60)
    
    # Change to script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    print(f"Working directory: {script_dir}")
    
    # Check dependencies
    if not check_dependencies():
        print("\n✗ Dependency check failed!")
        return 1
    
    # Clean previous builds
    clean_build()
    
    # Build executable
    if not build_executable():
        print("\n✗ Build failed!")
        return 1
    
    # Post-build tasks
    exe_path = post_build()
    
    # Cleanup
    cleanup_temp()
    
    if exe_path:
        print("\n" + "=" * 60)
        print("  BUILD SUCCESSFUL!")
        print("=" * 60)
        print(f"\n  Output: {exe_path}")
        print(f"\n  You can now distribute this file to users.")
        print("  Remember to update SERVER_URL in config.py before")
        print("  final distribution build!")
        print()
        return 0
    else:
        print("\n✗ Build failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())
