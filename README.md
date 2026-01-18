# SoilScan

A GUI application for removing backgrounds from soil sample images. Designed for agricultural data collection workflows where soil samples are photographed in white bags or containers.

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Platform](https://img.shields.io/badge/Platform-Windows-lightgrey.svg)

## Features

- **AI-Powered Background Removal** - Uses deep learning (U²Net) for accurate segmentation
- **Full GUI Application** - No terminal required, intuitive visual interface
- **Manual Crop Corrections** - Fix misidentified images with click-and-drag selection
- **Side-by-Side Preview** - Compare original and cropped images instantly
- **Batch Processing** - Process entire folders with progress tracking
- **Auto-Replacement** - Manual corrections automatically replace auto-cropped versions
- **Preserves Folder Structure** - Maintains your directory organization

## Screenshot

```
┌─────────────────────────────────────────────────────────────────────┐
│  Input: [C:\data\SF-AgriCapture_20260117_1708] [Browse]             │
│  Output: [C:\data\C-SF-AgriCapture_20260117_1708] [Browse]          │
├──────────┬────────────────────────────────────┬─────────────────────┤
│ Images   │     Original    │  Cropped Result  │      Actions        │
│──────────│                 │                  │─────────────────────│
│ ✅ img1  │   ┌─────────┐   │   ┌─────────┐   │ [Process All]       │
│ ✅ img2  │   │         │   │   │  🟤     │   │ [Process Selected]  │
│ ⏳ img3  │   │  🟤     │   │   │  soil   │   │                     │
│ ⏳ img4  │   │  soil   │   │   │         │   │ ◀ Prev    Next ▶    │
│ ❌ img5  │   │         │   │   └─────────┘   │                     │
│          │   └─────────┘   │                  │ ☐ Alpha Matting     │
├──────────┴────────────────────────────────────┴─────────────────────┤
│  Manual Crop (click and drag to select)           [Apply Manual]    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    [Selection Canvas]                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  Ready │                                          ████████░░ 80%    │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Windows

1. **Download** or clone this repository
2. **Run** `setup.bat` to install dependencies (first time only)
3. **Double-click** `SoilScan.pyw` to launch the application
4. **Select** your input directory
5. **Click** "Process All Images" to begin

### Manual Installation

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the application
python soilscan_gui.py
```

## Output Naming Convention

Output folders are automatically named with a **`C-`** prefix (for "Cropped"):

| Input Directory | Output Directory |
|-----------------|------------------|
| `SF-AgriCapture_20260117_1708` | `C-SF-AgriCapture_20260117_1708` |
| `soil_samples_batch1` | `C-soil_samples_batch1` |
| `field_data/images` | `C-field_data` |

## Workflow

### 1. Automatic Processing
1. Select your input directory containing soil images
2. Output directory auto-generates with `C-` prefix
3. Click "Process All Images"
4. Wait for batch processing to complete

### 2. Review Results
1. Browse images in the left panel
2. Use filters: All, Pending, Processed, Errors
3. Click any image to see original vs cropped comparison

### 3. Manual Corrections
If the auto-crop didn't work well:
1. Select the problematic image
2. In the "Manual Crop" section at the bottom, draw a rectangle around the soil
3. Click "Apply Manual Crop"
4. The manual version replaces the auto-cropped version

## Requirements

- Python 3.8 or higher
- Windows 10/11
- ~500MB disk space for AI models (downloaded on first run)

### Dependencies

- [Pillow](https://pillow.readthedocs.io/) - Image processing
- [rembg](https://github.com/danielgatis/rembg) - Background removal AI
- [tkinter](https://docs.python.org/3/library/tkinter.html) - GUI framework (built-in)

## File Structure

```
SoilScan/
├── soilscan_gui.py       # Main GUI application
├── SoilScan.pyw          # Double-click launcher (no console)
├── SoilScan.bat          # Terminal UI version (alternative)
├── soil_bg_remover.py    # CLI processing script
├── setup.bat             # First-time setup script
├── requirements.txt      # Python dependencies
├── README.md             # This file
└── LICENSE               # MIT License
```

## Command Line Alternative

For users who prefer command line:

```bash
# Basic usage
python soil_bg_remover.py -i path/to/images

# With custom output
python soil_bg_remover.py -i path/to/images -o path/to/output

# With alpha matting (better edges)
python soil_bg_remover.py -i path/to/images --alpha-matting

# Watch mode (auto-process new files)
python soil_bg_remover.py -i path/to/images --watch
```

Or use `SoilScan.bat` for an interactive terminal UI.

## Troubleshooting

### Application doesn't start
- Make sure Python 3.8+ is installed
- Run `setup.bat` to install dependencies
- Try running `python soilscan_gui.py` from command line to see errors

### Processing is slow
- First run downloads AI models (~150MB), subsequent runs are faster
- Enable GPU acceleration: `pip install "rembg[gpu]"` (requires NVIDIA GPU + CUDA)

### Poor edge quality
- Enable "Alpha Matting" checkbox for cleaner edges (slower processing)

### Auto-crop failed on some images
- Use the manual crop tool to correct misidentified images
- Draw a rectangle around the soil area
- Click "Apply Manual Crop" to save

## Performance

- ~2-3 seconds per image (CPU mode)
- ~0.5 seconds per image (GPU mode with CUDA)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- [rembg](https://github.com/danielgatis/rembg) - Background removal library
- [U²Net](https://github.com/xuebinqin/U-2-Net) - Salient object detection model
