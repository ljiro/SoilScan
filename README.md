# SoilScan

A batch processing tool for removing backgrounds from soil sample images. Designed for agricultural data collection workflows where soil samples are photographed in white bags or containers.

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Platform](https://img.shields.io/badge/Platform-Windows-lightgrey.svg)

## Features

- **AI-Powered Background Removal** - Uses deep learning (U²Net) for accurate segmentation
- **Batch Processing** - Process entire folders of images at once
- **Interactive Terminal UI** - Easy-to-use menu-driven interface
- **Watch Mode** - Automatically process new images as they're added
- **Preserves Folder Structure** - Maintains your directory organization
- **Transparent PNG Output** - Clean outputs ready for analysis or compositing

## Quick Start

### Windows (Recommended)

1. **Download** or clone this repository
2. **Double-click** `SoilScan.bat`
3. **Select** your input directory (Option 1)
4. **Press 5** to start processing

The tool will automatically set up a Python virtual environment and install dependencies on first run.

### Output Naming Convention

Output folders are automatically named with a **`C-`** prefix (for "Cropped"):

| Input Directory | Output Directory |
|-----------------|------------------|
| `SF-AgriCapture_20260117_1708` | `C-SF-AgriCapture_20260117_1708` |
| `soil_samples_batch1` | `C-soil_samples_batch1` |
| `field_data/images` | `C-field_data` |

This makes it easy to identify which folders contain processed images.

### Command Line

```bash
# Install dependencies
pip install -r requirements.txt

# Basic usage
python soil_bg_remover.py -i path/to/images -o path/to/output

# With alpha matting (better edges)
python soil_bg_remover.py -i path/to/images --alpha-matting

# Watch mode (auto-process new files)
python soil_bg_remover.py -i path/to/images --watch
```

## Requirements

- Python 3.8 or higher
- Windows 10/11 (for batch file UI)
- ~500MB disk space for AI models (downloaded on first run)

### Dependencies

- [Pillow](https://pillow.readthedocs.io/) - Image processing
- [rembg](https://github.com/danielgatis/rembg) - Background removal AI
- [tqdm](https://github.com/tqdm/tqdm) - Progress bars

## Usage

### Interactive Mode (SoilScan.bat)

```
============================================================
                   SOILSCAN v1.0
        Soil Sample Background Remover Tool
============================================================

  Current Settings:
  ---------------------------------------------------------
  [1] Input Directory:  C:\samples\soil_images
  [2] Output Directory: output_cropped
  [3] Alpha Matting:    DISABLED (faster)
  [4] Watch Mode:       DISABLED
  ---------------------------------------------------------

  [5] START PROCESSING
  [6] Help
  [0] Exit

============================================================
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `-i, --input` | Input directory containing images |
| `-o, --output` | Output directory for processed images (default: `output_cropped`) |
| `--alpha-matting` | Enable alpha matting for better edge quality (slower) |
| `--watch` | Watch input directory and process new files automatically |
| `--no-recursive` | Don't process subdirectories |

## Supported Formats

**Input:** JPG, JPEG, PNG, BMP, WEBP

**Output:** PNG (with transparency)

## Example

### Before
![Before](docs/before.jpg)
*Soil sample in white collection bag*

### After
![After](docs/after.png)
*Isolated soil with transparent background*

## Performance

- ~2-3 seconds per image (CPU mode)
- ~0.5 seconds per image (GPU mode with CUDA)
- Processes ~95 images in about 6 minutes on a standard laptop

## Project Structure

```
SoilScan/
├── SoilScan.bat          # Interactive Windows launcher
├── soil_bg_remover.py    # Main processing script
├── requirements.txt      # Python dependencies
├── README.md            # This file
└── output_cropped/      # Default output directory
```

## Troubleshooting

### "Python is not recognized"
Install Python from [python.org](https://www.python.org/downloads/) and ensure "Add to PATH" is checked during installation.

### "Failed to install packages"
Try running as administrator, or manually install:
```bash
pip install Pillow "rembg[cpu]" tqdm
```

### Slow processing
- First run downloads AI models (~150MB), subsequent runs are faster
- Use GPU acceleration: `pip install "rembg[gpu]"` (requires NVIDIA GPU + CUDA)

### Poor edge quality
Enable alpha matting for cleaner edges (Option 3 in the menu, or `--alpha-matting` flag).

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- [rembg](https://github.com/danielgatis/rembg) - Background removal library
- [U²Net](https://github.com/xuebinqin/U-2-Net) - Salient object detection model
