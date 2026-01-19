# SoilScan

A GUI application for removing backgrounds from soil sample images. Designed for agricultural data collection workflows.

## Quick Start

1. **Extract** the ZIP to any folder
2. **Double-click** `Setup.bat` (first time only - installs dependencies)
3. **Double-click** `SoilScan.pyw` to launch

## Features

### Processing Modes

| Mode | Use Case | Description |
|------|----------|-------------|
| **AI Full** | Controlled environment (white bag) | Automatic AI background removal |
| **AI + Lasso** | Controlled environment | Draw selection, AI removes background within |
| **ZOOM EDIT** | Detailed work | Fullscreen editing with AI support |
| **FIELD MODE** | Outdoor/field images | Manual lasso or box selection (no AI) |

### Result Editor
Click on any processed result to edit:
- **RESTORE** brush - Bring back parts from original image
- **REMOVE** brush - Erase/make transparent
- **RESTORE ORIGINAL** - Replace with full original image
- **Color traces** - Green (restored) / Red (removed) showing edits

### Other Features
- **GPU Acceleration** - Auto-detects DirectML (AMD/Intel) or CUDA (NVIDIA)
- **CPU/GPU Toggle** - Switch processing mode on the fly
- **Dynamic Resizing** - Images scale with window size
- **Position Counter** - Shows current image number (X/Y)
- **Consistent Dimensions** - All outputs maintain original image size

## Workflow

### Processing New Images (Controlled Environment)
```
1. Launch SoilScan
2. Click "Open Folder" and select image folder
3. For each image:
   - Use "AI Full" for automatic processing, OR
   - Draw lasso + click "AI + Lasso" for selective processing
4. Output saved to C-{folder_name}
```

### Processing Field Images
```
1. Launch SoilScan
2. Click "Open Folder" and select image folder
3. For each image:
   - Click "FIELD MODE"
   - Choose LASSO or BOX selection
   - Draw around soil sample on shovel
   - Click "Apply & Save"
```

### Editing Results
```
1. Click on the Result preview (shows hand cursor)
2. Use RESTORE brush to bring back original pixels
3. Use REMOVE brush to erase unwanted areas
4. Click "Apply & Save" when done
```

## Naming Convention

| You Select | Output |
|------------|--------|
| `SF-AgriCapture_20260117` | `C-SF-AgriCapture_20260117` |

## File Structure

```
SoilScan/
├── SoilScan.pyw              # Double-click to launch (no console)
├── SoilScan.bat              # Launch with console (for debugging)
├── Setup.bat                 # First-time setup
├── soilscan_lite.py          # Main GUI application
├── soil_bg_remover.py        # CLI tool (basic)
├── soil_bg_remover_optimized.py  # CLI tool (parallel processing)
├── soil_bg_remover_turbo.py  # CLI tool (max speed)
├── logo.png                  # Application icon
├── requirements.txt          # Dependencies
└── README.md                 # This file
```

## CLI Tools

### Basic Processing
```bash
python soil_bg_remover.py -i input_folder
```

### Parallel Processing (4-8x faster)
```bash
python soil_bg_remover_optimized.py -i input_folder --workers 8
```

### Maximum Speed (GPU optimized)
```bash
python soil_bg_remover_turbo.py -i input_folder --model u2netp
```

## Requirements

- Windows 10/11
- Python 3.8+
- ~500MB for AI models (auto-downloaded)

## GPU Support

| GPU Type | Provider | Installation |
|----------|----------|--------------|
| AMD Radeon | DirectML | `pip install onnxruntime-directml` |
| NVIDIA | CUDA | `pip install onnxruntime-gpu` |
| Intel | DirectML | `pip install onnxruntime-directml` |

## Troubleshooting

**"Python not found"**
- Install Python from https://python.org
- Check "Add Python to PATH" during installation

**App won't start**
- Run `Setup.bat` first
- Try: `python soilscan_lite.py` in terminal to see errors

**Processing is slow**
- First run downloads AI models (~150MB)
- Check GPU detection in top bar
- Click GPU/CPU button to toggle

## License

MIT License
