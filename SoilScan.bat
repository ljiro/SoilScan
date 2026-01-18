@echo off
setlocal EnableDelayedExpansion

:: ============================================
:: SoilScan - Soil Sample Background Remover
:: Terminal UI for batch processing
:: ============================================

title SoilScan - Soil Sample Background Remover
color 0A

:: Default paths
set "INPUT_DIR="
set "OUTPUT_DIR="
set "ALPHA_MATTING=0"
set "WATCH_MODE=0"

:MAIN_MENU
cls
echo.
echo  ============================================================
echo                    SOILSCAN v1.0
echo         Soil Sample Background Remover Tool
echo  ============================================================
echo.
echo   Current Settings:
echo   ---------------------------------------------------------
if "!INPUT_DIR!"=="" (
    echo   [1] Input Directory:  ^(not set^)
    echo   [2] Output Directory: ^(auto: C-{input_folder}^)
) else (
    echo   [1] Input Directory:  !INPUT_DIR!
    if "!OUTPUT_DIR!"=="" (
        echo   [2] Output Directory: C-!INPUT_NAME! ^(auto^)
    ) else (
        echo   [2] Output Directory: !OUTPUT_DIR!
    )
)
if "!ALPHA_MATTING!"=="1" (
    echo   [3] Alpha Matting:    ENABLED ^(better edges, slower^)
) else (
    echo   [3] Alpha Matting:    DISABLED ^(faster^)
)
if "!WATCH_MODE!"=="1" (
    echo   [4] Watch Mode:       ENABLED ^(auto-process new files^)
) else (
    echo   [4] Watch Mode:       DISABLED
)
echo   ---------------------------------------------------------
echo.
echo   [5] START PROCESSING
echo   [6] Help
echo   [0] Exit
echo.
echo  ============================================================
echo.
set /p "CHOICE=  Select option (0-6): "

if "%CHOICE%"=="1" goto SELECT_INPUT
if "%CHOICE%"=="2" goto SELECT_OUTPUT
if "%CHOICE%"=="3" goto TOGGLE_ALPHA
if "%CHOICE%"=="4" goto TOGGLE_WATCH
if "%CHOICE%"=="5" goto START_PROCESS
if "%CHOICE%"=="6" goto SHOW_HELP
if "%CHOICE%"=="0" goto EXIT_APP
goto MAIN_MENU

:SELECT_INPUT
cls
echo.
echo  ============================================================
echo                 SELECT INPUT DIRECTORY
echo  ============================================================
echo.
echo   Enter the full path to your images folder, or drag and
echo   drop a folder here.
echo.
echo   Example: C:\Users\Name\Documents\SF-AgriCapture_20260117
echo.
echo   The output will automatically be named:
echo   C-{folder_name} ^(e.g., C-SF-AgriCapture_20260117^)
echo.
echo   Type 'back' to return to main menu.
echo.
echo  ============================================================
echo.
set /p "INPUT_PATH=  Enter path: "

if /i "!INPUT_PATH!"=="back" goto MAIN_MENU

:: Remove surrounding quotes if present
set "INPUT_PATH=!INPUT_PATH:"=!"

:: Remove trailing backslash if present
if "!INPUT_PATH:~-1!"=="\" set "INPUT_PATH=!INPUT_PATH:~0,-1!"

:: Validate directory exists
if not exist "!INPUT_PATH!" (
    echo.
    echo   [ERROR] Directory does not exist: !INPUT_PATH!
    echo.
    pause
    goto SELECT_INPUT
)

:: Check if it's a directory
pushd "!INPUT_PATH!" 2>nul
if errorlevel 1 (
    echo.
    echo   [ERROR] Not a valid directory: !INPUT_PATH!
    echo.
    pause
    goto SELECT_INPUT
)
popd

set "INPUT_DIR=!INPUT_PATH!"

:: Extract folder name for auto output naming
for %%I in ("!INPUT_PATH!") do set "INPUT_NAME=%%~nxI"

:: Check if it's a generic folder name like "images"
if /i "!INPUT_NAME!"=="images" (
    for %%I in ("!INPUT_PATH!\..") do set "INPUT_NAME=%%~nxI"
)
if /i "!INPUT_NAME!"=="image" (
    for %%I in ("!INPUT_PATH!\..") do set "INPUT_NAME=%%~nxI"
)
if /i "!INPUT_NAME!"=="photos" (
    for %%I in ("!INPUT_PATH!\..") do set "INPUT_NAME=%%~nxI"
)

:: Reset output to auto-generate
set "OUTPUT_DIR="

echo.
echo   [OK] Input directory set to: !INPUT_DIR!
echo   [OK] Output will be: C-!INPUT_NAME!
timeout /t 2 >nul
goto MAIN_MENU

:SELECT_OUTPUT
cls
echo.
echo  ============================================================
echo                 SELECT OUTPUT DIRECTORY
echo  ============================================================
echo.
if "!OUTPUT_DIR!"=="" (
    echo   Current: C-!INPUT_NAME! ^(auto-generated^)
) else (
    echo   Current: !OUTPUT_DIR!
)
echo.
echo   Enter a custom output path, or press Enter to use auto.
echo   The folder will be created if it doesn't exist.
echo.
echo   Auto-naming: C-{input_folder_name}
echo   Example: SF-AgriCapture_20260117 -^> C-SF-AgriCapture_20260117
echo.
echo   Type 'auto' to reset to automatic naming.
echo   Type 'back' to return to main menu.
echo.
echo  ============================================================
echo.
set /p "OUTPUT_PATH=  Enter path (or press Enter for auto): "

if /i "!OUTPUT_PATH!"=="back" goto MAIN_MENU
if /i "!OUTPUT_PATH!"=="auto" (
    set "OUTPUT_DIR="
    echo.
    echo   [OK] Output will be auto-generated: C-!INPUT_NAME!
    timeout /t 2 >nul
    goto MAIN_MENU
)
if "!OUTPUT_PATH!"=="" (
    set "OUTPUT_DIR="
    goto MAIN_MENU
)

:: Remove surrounding quotes if present
set "OUTPUT_PATH=!OUTPUT_PATH:"=!"

set "OUTPUT_DIR=!OUTPUT_PATH!"
echo.
echo   [OK] Output directory set to: !OUTPUT_DIR!
timeout /t 2 >nul
goto MAIN_MENU

:TOGGLE_ALPHA
if "!ALPHA_MATTING!"=="0" (
    set "ALPHA_MATTING=1"
) else (
    set "ALPHA_MATTING=0"
)
goto MAIN_MENU

:TOGGLE_WATCH
if "!WATCH_MODE!"=="0" (
    set "WATCH_MODE=1"
) else (
    set "WATCH_MODE=0"
)
goto MAIN_MENU

:SHOW_HELP
cls
echo.
echo  ============================================================
echo                        HELP
echo  ============================================================
echo.
echo   SOILSCAN removes white/light backgrounds from soil sample
echo   images, leaving only the soil with a transparent background.
echo.
echo   OUTPUT NAMING:
echo     By default, output folders are named with a "C-" prefix
echo     to indicate "Cropped". For example:
echo       Input:  SF-AgriCapture_20260117_1708
echo       Output: C-SF-AgriCapture_20260117_1708
echo.
echo   OPTIONS:
echo.
echo   Input Directory
echo     The folder containing your original soil sample images.
echo     Supports: JPG, JPEG, PNG, BMP, WEBP
echo     Subfolders are processed automatically.
echo.
echo   Output Directory
echo     Where processed images will be saved as PNG files
echo     with transparent backgrounds. Folder structure is
echo     preserved from the input directory.
echo     Default: C-{input_folder_name}
echo.
echo   Alpha Matting
echo     Improves edge quality around the soil samples.
echo     Recommended for final/production use.
echo     Slower processing time.
echo.
echo   Watch Mode
echo     Continuously monitors the input folder for new images
echo     and processes them automatically. Useful for live
echo     data collection pipelines.
echo.
echo  ============================================================
echo.
pause
goto MAIN_MENU

:START_PROCESS
cls
echo.
echo  ============================================================
echo                   PROCESSING SETUP
echo  ============================================================
echo.

:: Validate input directory
if "!INPUT_DIR!"=="" (
    echo   [ERROR] Input directory not set!
    echo.
    echo   Please select an input directory first ^(Option 1^).
    echo.
    pause
    goto MAIN_MENU
)

:: Check if virtual environment exists
if not exist "venv" (
    echo   Creating Python virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo.
        echo   [ERROR] Failed to create virtual environment.
        echo   Make sure Python is installed and in your PATH.
        echo.
        pause
        goto MAIN_MENU
    )
    echo   [OK] Virtual environment created.
    echo.
)

:: Activate and check packages
echo   Checking dependencies...
call venv\Scripts\activate.bat

pip show rembg >nul 2>&1
if errorlevel 1 (
    echo   Installing required packages ^(this may take a few minutes^)...
    pip install Pillow "rembg[cpu]" tqdm
    if errorlevel 1 (
        echo.
        echo   [ERROR] Failed to install packages.
        echo.
        pause
        goto MAIN_MENU
    )
    echo   [OK] Packages installed.
    echo.
)

:: Build command arguments
set "ARGS=-i "!INPUT_DIR!""

:: Add output if custom (otherwise Python script auto-generates)
if not "!OUTPUT_DIR!"=="" (
    set "ARGS=!ARGS! -o "!OUTPUT_DIR!""
)

if "!ALPHA_MATTING!"=="1" (
    set "ARGS=!ARGS! --alpha-matting"
)

if "!WATCH_MODE!"=="1" (
    set "ARGS=!ARGS! --watch"
)

:: Calculate output path for display
if "!OUTPUT_DIR!"=="" (
    for %%I in ("!INPUT_DIR!") do set "DISPLAY_OUTPUT=C-%%~nxI"
    :: Get parent directory of input
    for %%I in ("!INPUT_DIR!\..") do set "PARENT_DIR=%%~fI"
    set "FULL_OUTPUT=!PARENT_DIR!\!DISPLAY_OUTPUT!"
) else (
    set "FULL_OUTPUT=!OUTPUT_DIR!"
)

echo.
echo  ============================================================
echo                   STARTING PROCESSING
echo  ============================================================
echo.
echo   Input:  !INPUT_DIR!
echo   Output: !FULL_OUTPUT!
if "!ALPHA_MATTING!"=="1" echo   Alpha Matting: ENABLED
if "!WATCH_MODE!"=="1" echo   Watch Mode: ENABLED
echo.
echo  ============================================================
echo.

:: Run the Python script
python soil_bg_remover.py !ARGS!

echo.
echo  ============================================================
echo                   PROCESSING COMPLETE
echo  ============================================================
echo.
echo   Output saved to: !FULL_OUTPUT!
echo.
pause
goto MAIN_MENU

:EXIT_APP
cls
echo.
echo  ============================================================
echo   Thank you for using SoilScan!
echo  ============================================================
echo.
timeout /t 2 >nul
exit /b 0
