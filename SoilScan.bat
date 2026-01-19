@echo off
title SoilScan - Soil Sample Background Remover

:: Check if venv exists
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create venv. Make sure Python is installed.
        pause
        exit /b 1
    )
)

:: Activate and check packages
call venv\Scripts\activate.bat

pip show rembg >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install Pillow "rembg[cpu]" tqdm onnxruntime-directml
)

:: Run the GUI
python soilscan_lite.py

pause
