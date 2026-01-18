@echo off
title SoilScan Setup
color 0A

echo.
echo  ============================================================
echo                     SOILSCAN SETUP
echo  ============================================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [ERROR] Python is not installed!
    echo.
    echo  Please install Python 3.8+ from:
    echo  https://python.org/downloads
    echo.
    echo  IMPORTANT: Check "Add Python to PATH" during installation!
    echo.
    pause
    exit /b 1
)

echo  [OK] Python found
python --version
echo.

:: Create venv if needed
if not exist "venv" (
    echo  Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        color 0C
        echo  [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
    echo  [OK] Virtual environment created
    echo.
)

:: Install dependencies
echo  Installing dependencies (this may take a few minutes)...
echo.
call venv\Scripts\activate.bat
pip install --upgrade pip >nul 2>&1
pip install -r requirements.txt

if errorlevel 1 (
    color 0C
    echo.
    echo  [ERROR] Failed to install dependencies
    echo  Try running as Administrator
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo                    SETUP COMPLETE!
echo  ============================================================
echo.
echo  You can now launch SoilScan by double-clicking:
echo.
echo      SoilScan.pyw
echo.
echo  ============================================================
echo.
pause
