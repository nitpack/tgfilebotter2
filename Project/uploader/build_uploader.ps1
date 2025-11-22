# Build Script for File Uploader (PowerShell)
# Run: .\build_uploader.ps1

$ErrorActionPreference = "Stop"

# Configuration
$APP_NAME = "FileUploader"
$APP_VERSION = "1.0.0"
$MAIN_SCRIPT = "main.py"
$OUTPUT_DIR = "dist"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Building $APP_NAME v$APP_VERSION" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check Python installation
Write-Host "Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  OK: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Python not found! Please install Python 3.8+" -ForegroundColor Red
    Write-Host "  Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Install/upgrade pip
Write-Host ""
Write-Host "Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip --quiet
Write-Host "  OK: pip upgraded" -ForegroundColor Green

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow

$dependencies = @("PyQt5", "requests", "pyinstaller")
foreach ($dep in $dependencies) {
    Write-Host "  Installing $dep..." -NoNewline
    python -m pip install $dep --quiet
    Write-Host " OK" -ForegroundColor Green
}

# Clean previous builds
Write-Host ""
Write-Host "Cleaning previous builds..." -ForegroundColor Yellow

$foldersToClean = @("build", "dist", "__pycache__")
foreach ($folder in $foldersToClean) {
    if (Test-Path $folder) {
        Remove-Item -Recurse -Force $folder
        Write-Host "  Removed $folder/" -ForegroundColor Gray
    }
}

$specFile = "$APP_NAME.spec"
if (Test-Path $specFile) {
    Remove-Item $specFile
    Write-Host "  Removed $specFile" -ForegroundColor Gray
}

# Build executable
Write-Host ""
Write-Host "Building executable..." -ForegroundColor Yellow
Write-Host "  This may take a few minutes..." -ForegroundColor Gray
Write-Host ""

$pyinstallerArgs = @(
    "-m", "PyInstaller",
    "--name", $APP_NAME,
    "--onefile",
    "--windowed",
    "--clean",
    "--noconfirm",
    "--hidden-import", "PyQt5.sip",
    "--hidden-import", "PyQt5.QtCore",
    "--hidden-import", "PyQt5.QtGui",
    "--hidden-import", "PyQt5.QtWidgets"
)

# Add icon if exists
if (Test-Path "icon.ico") {
    $pyinstallerArgs += @("--icon", "icon.ico")
    Write-Host "  Using custom icon" -ForegroundColor Gray
}

$pyinstallerArgs += $MAIN_SCRIPT

# Run PyInstaller
& python $pyinstallerArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "  BUILD FAILED!" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    exit 1
}

# Post-build: rename executable
Write-Host ""
Write-Host "Finalizing build..." -ForegroundColor Yellow

$exePath = Join-Path $OUTPUT_DIR "$APP_NAME.exe"
$finalName = "${APP_NAME}_v${APP_VERSION}.exe"
$finalPath = Join-Path $OUTPUT_DIR $finalName

if (Test-Path $exePath) {
    if (Test-Path $finalPath) {
        Remove-Item $finalPath
    }
    Rename-Item $exePath $finalName
    
    $fileSize = [math]::Round((Get-Item $finalPath).Length / 1MB, 1)
    Write-Host "  OK: Created $finalName ($fileSize MB)" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Executable not found!" -ForegroundColor Red
    exit 1
}

# Cleanup temporary files
Write-Host ""
Write-Host "Cleaning up..." -ForegroundColor Yellow

$tempFolders = @("build")
foreach ($folder in $tempFolders) {
    if (Test-Path $folder) {
        Remove-Item -Recurse -Force $folder
        Write-Host "  Removed $folder/" -ForegroundColor Gray
    }
}

if (Test-Path $specFile) {
    Remove-Item $specFile
    Write-Host "  Removed $specFile" -ForegroundColor Gray
}

# Remove __pycache__ folders
Get-ChildItem -Recurse -Directory -Filter "__pycache__" | ForEach-Object {
    Remove-Item -Recurse -Force $_.FullName
    Write-Host "  Removed $($_.FullName)" -ForegroundColor Gray
}

# Success message
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  BUILD SUCCESSFUL!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Output: $finalPath" -ForegroundColor White
Write-Host ""
Write-Host "  IMPORTANT: Before distributing to users, update" -ForegroundColor Yellow
Write-Host "  SERVER_URL in config.py to your actual server address!" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Then rebuild with: .\build_uploader.ps1" -ForegroundColor Gray
Write-Host ""

# Open output folder
Write-Host "Opening output folder..." -ForegroundColor Gray
Start-Process explorer.exe -ArgumentList $OUTPUT_DIR
