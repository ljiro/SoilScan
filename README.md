# SoilScan

A GUI application for removing backgrounds from soil sample images. Designed for agricultural data collection workflows.

## Quick Start

1. **Extract** the ZIP to any folder
2. **Double-click** `Setup.bat` (first time only - installs dependencies)
3. **Double-click** `SoilScan.pyw` to launch

## Two Modes

### Normal Mode (Processing)
Select a folder like `SF-AgriCapture_20260117` → Automatically processes images and saves to `C-SF-AgriCapture_20260117`

### Correction Mode (Manual Fix)
Select a folder starting with `C-` (like `C-SF-AgriCapture_20260117`) → App detects this and enters correction mode for manual cropping fixes

## Features

- **AI Background Removal** - Automatic detection and removal using deep learning
- **Manual Crop Tool** - Fix misidentified images with click-and-drag selection
- **Smart Mode Detection** - Automatically switches between processing and correction modes
- **Side-by-Side Preview** - Compare original and cropped images
- **Batch Processing** - Process entire folders with progress tracking
- **Auto-Replacement** - Manual corrections overwrite auto-cropped versions

## Workflow

### Processing New Images
```
1. Launch SoilScan.pyw
2. Click "Browse" and select your image folder (e.g., SF-AgriCapture_20260117)
3. Click "Process All Images"
4. Wait for completion
5. Output saved to C-{folder_name}
```

### Correcting Bad Crops
```
1. Launch SoilScan.pyw
2. Click "Browse" and select the C- folder (e.g., C-SF-AgriCapture_20260117)
3. App enters CORRECTION MODE (orange banner)
4. Click on any image to view
5. Draw rectangle around soil in the Manual Crop area
6. Click "Apply Manual Crop" - replaces the auto-cropped version
7. App auto-advances to next image
```

## Naming Convention

| You Select | Mode | Output |
|------------|------|--------|
| `SF-AgriCapture_20260117` | Normal | `C-SF-AgriCapture_20260117` |
| `C-SF-AgriCapture_20260117` | Correction | Same folder (replaces files) |

## File Structure

```
SoilScan/
├── SoilScan.pyw          # Double-click to launch (no console)
├── Setup.bat             # First-time setup (install dependencies)
├── soilscan_gui.py       # Main application
├── soil_bg_remover.py    # CLI tool (optional)
├── SoilScan.bat          # Terminal UI (optional)
├── requirements.txt      # Dependencies
└── README.md             # This file
```

## Requirements

- Windows 10/11
- Python 3.8+ (download from python.org)
- ~500MB for AI models (auto-downloaded)

## Troubleshooting

**"Python not found"**
- Install Python from https://python.org
- Check "Add Python to PATH" during installation

**App won't start**
- Run `Setup.bat` first
- Try: `python soilscan_gui.py` in terminal to see errors

**Processing is slow**
- First run downloads AI models (~150MB)
- Enable GPU: `pip install rembg[gpu]` (requires NVIDIA + CUDA)

**Poor edge quality**
- Check "Alpha Matting" option (slower but better)

## License

MIT License
