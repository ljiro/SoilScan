# SoilScan: Deep Learning for Soil Nutrient Prediction from Field Photography

## Abstract

SoilScan is a research-grade deep learning pipeline for predicting soil nutrient levels — specifically Nitrogen (N), Phosphorus (P), Potassium (K), and optionally soil pH — directly from field photographs captured with a mobile device. The dataset was collected across municipalities in the Cordillera Administrative Region of the Philippines (Atok, La Trinidad, and surrounding areas), comprising approximately 15,768 augmented images derived from roughly 1,787 unique GPS-tagged field capture sites. Each image is linked to laboratory-measured soil nutrient labels via a UUID-based mapping system that prevents augmented variants of the same capture from appearing across different data splits. The pipeline supports both ordinal classification (Low / Medium / High) and continuous regression task modes, and exposes four backbone architectures — ResNet-50, EfficientNet-B4, ConvNeXt-Tiny, and Vision Transformer ViT-B/16 — through a unified experiment configuration system. Training is driven by YAML experiment files, with full TensorBoard integration, automatic mixed-precision (AMP), and configurable early stopping.

---

## Table of Contents

1. [Dataset](#dataset)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Experiment Configuration](#experiment-configuration)
5. [Training](#training)
6. [Evaluation](#evaluation)
7. [Inference](#inference)
8. [TensorBoard Monitoring](#tensorboard-monitoring)
9. [Architecture Overview](#architecture-overview)
10. [Results](#results)
11. [Project Structure](#project-structure)
12. [Citation](#citation)
13. [Acknowledgements](#acknowledgements)

---

## Dataset

### Source and Coverage

Field photographs were collected across municipalities in the Cordillera Administrative Region of the Philippines. The primary collection site is Atok, Benguet, with additional samples from La Trinidad and surrounding areas. Each unique capture location is identified by an 8-character hexadecimal UUID derived from the GPS coordinates and capture timestamp.

### Image Filename Convention

Every image follows a structured naming scheme that encodes provenance and augmentation metadata:

```
{location}_{date}_{time}_{uuid8hex}_{augmentation}_{level}.png
```

For example: `atok_20240315_103045_a3f9c12b_blur_2.png`

The 8-character hex UUID (`a3f9c12b` in this example) is the primary key linking each image to its row in `datamaps/uuid_mapping_report.csv`.

### Augmentation Types and Resolutions

The augmented dataset is stored under `data/augmented-atok-test-sample/` and contains images at three resolutions: **640x480**, **1280x720**, and **1920x1080**. Each original capture is augmented with the following 12 transformations:

| Augmentation     | Description                                      |
|------------------|--------------------------------------------------|
| `blur`           | Gaussian blur with variable kernel size          |
| `brightness`     | Global brightness adjustment                     |
| `clahe`          | Contrast Limited Adaptive Histogram Equalization |
| `contrast`       | Global contrast adjustment                       |
| `flip_h`         | Horizontal flip                                  |
| `flip_v`         | Vertical flip                                    |
| `gaussian_noise` | Additive Gaussian noise                          |
| `hue_shift`      | Hue channel rotation in HSV space                |
| `perspective`    | Random perspective warp                          |
| `rotation`       | In-plane rotation                                |
| `saturation`     | Saturation adjustment                            |
| `sharpen`        | Unsharp masking                                  |

### Label Structure

Nutrient labels are stored in `datamaps/uuid_mapping_report.csv` with the following schema:

| Column | Type    | Description                                   |
|--------|---------|-----------------------------------------------|
| `uuid` | string  | 8-character hex UUID matching the filename    |
| `n`    | integer | Nitrogen class: 0 = Low, 1 = Medium, 2 = High |
| `p`    | integer | Phosphorus class: 0 = Low, 1 = Medium, 2 = High |
| `k`    | integer | Potassium class: 0 = Low, 1 = Medium, 2 = High |
| `ph`   | float   | Soil pH (continuous; used in regression mode) |

Additional metadata — including GPS coordinates, weather conditions at capture time, device model, and camera parameters — is available in `datamaps/final_merged_data_cleaned.csv`.

### UUID-Aware Train/Val/Test Splitting

The dataset split is performed at the UUID level, not at the image level. All augmented variants of the same original capture are assigned to the same split (train, validation, or test). This design prevents data leakage that would otherwise occur if augmented copies of the same scene appeared in both the training and evaluation sets. The split is implemented in `train/dataset.py` via the `uuid_aware_split` function, which performs stratified partitioning on the UUID pool before expanding to image paths.

Default split ratios: **75% train / 15% validation / 10% test** (configurable via `data.val_split` and `data.test_split`).

---

## Installation

### Requirements

- Python 3.10 or later
- CUDA-capable GPU recommended (AMP training requires CUDA; CPU-only inference is supported)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-org/SoilScan.git
cd SoilScan

# 2. Create and activate a virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt
```

The `requirements.txt` installs the following core packages:

| Package         | Version   | Purpose                                         |
|-----------------|-----------|-------------------------------------------------|
| `torch`         | >=2.2.0   | Deep learning framework                         |
| `torchvision`   | >=0.17.0  | ResNet-50 backbone and image transforms         |
| `timm`          | >=1.0.3   | EfficientNet-B4, ConvNeXt-Tiny, ViT-B/16        |
| `numpy`         | >=1.26.0  | Numerical operations                            |
| `pandas`        | >=2.2.0   | CSV label loading and prediction export         |
| `Pillow`        | >=10.3.0  | Image loading in dataset and inference          |
| `scikit-learn`  | >=1.4.0   | F1 score, Cohen's Kappa, stratified splitting   |
| `PyYAML`        | >=6.0.1   | YAML experiment config loading                  |
| `tensorboard`   | >=2.16.0  | Training metric visualisation                   |
| `matplotlib`    | >=3.8.0   | Optional plots in `evaluate.py`                 |
| `seaborn`       | >=0.13.0  | Optional plots in `evaluate.py`                 |
| `tqdm`          | >=4.66.0  | Progress bars                                   |

> **Note:** `timm` is required for EfficientNet-B4, ConvNeXt-Tiny, and ViT-B/16 backbones. ResNet-50 uses `torchvision` only and does not require `timm`.

---

## Quick Start

The following four commands train the baseline ResNet-50 classification model, evaluate it on the held-out test set, and run inference on a single image.

```bash
# 1. Train with the baseline ResNet-50 experiment config
python train/train.py --config experiments/baseline_resnet50.yaml

# 2. Evaluate the saved checkpoint on the test set
python train/evaluate.py --config experiments/baseline_resnet50.yaml

# 3. Run inference on a single field photograph
python train/inference.py --image path/to/soil_photo.jpg --config experiments/baseline_resnet50.yaml

# 4. (Optional) Launch TensorBoard to monitor training
tensorboard --logdir runs/
```

---

## Experiment Configuration

### Configuration System

Experiments are defined using a two-layer system:

1. **Python dataclass defaults** (`train/config.py`): `ExperimentConfig` composes four sub-configs — `PathConfig`, `DataConfig`, `ModelConfig`, and `TrainConfig` — each with sensible defaults.
2. **YAML override files** (`experiments/*.yaml`): Any key in the YAML file overrides the corresponding dataclass field. Keys must mirror the nested structure (`data.*`, `model.*`, `train.*`, `paths.*`).

To load and inspect a config programmatically:

```python
from train.config import get_config

cfg = get_config("experiments/baseline_resnet50.yaml")
print(cfg.model.backbone)   # "resnet50"
print(cfg.data.task)        # "classification"
```

To print a full config as JSON from the command line:

```bash
python train/config.py experiments/efficientnet_b4.yaml
```

### Config Key Reference

#### Top-level

| Key    | Type   | Description                                      |
|--------|--------|--------------------------------------------------|
| `name` | string | Experiment name; used as checkpoint and log directory prefix |

#### `data` section

| Key          | Type            | Default              | Description                                                    |
|--------------|-----------------|----------------------|----------------------------------------------------------------|
| `targets`    | list of strings | `["n", "p", "k"]`   | Nutrient targets to predict. Add `"ph"` for regression mode.  |
| `task`       | string          | `"classification"`   | `"classification"` or `"regression"`                          |
| `img_size`   | int             | `224`                | Crop size in pixels. Images are resize-then-center-cropped.   |
| `val_split`  | float           | `0.15`               | Fraction of unique UUIDs held out for validation.             |
| `test_split` | float           | `0.10`               | Fraction of unique UUIDs held out for final testing.          |
| `seed`       | int             | `42`                 | Random seed for split and training reproducibility.           |

#### `model` section

| Key          | Type    | Default     | Description                                                              |
|--------------|---------|-------------|--------------------------------------------------------------------------|
| `backbone`   | string  | `"resnet50"` | One of `resnet50`, `efficientnet_b4`, `convnext_tiny`, `vit_b16`        |
| `pretrained` | bool    | `true`      | Load ImageNet pretrained weights.                                        |
| `dropout`    | float   | `0.3`       | Dropout rate applied before each task head.                             |
| `num_classes`| int     | `3`         | Classes per target (classification only; ignored in regression mode).   |

#### `train` section

| Key                       | Type   | Default    | Description                                                        |
|---------------------------|--------|------------|--------------------------------------------------------------------|
| `batch_size`              | int    | `32`       | Mini-batch size.                                                   |
| `epochs`                  | int    | `50`       | Maximum number of training epochs.                                 |
| `lr`                      | float  | `3e-4`     | Initial learning rate for AdamW.                                   |
| `weight_decay`            | float  | `1e-4`     | L2 regularisation coefficient.                                     |
| `num_workers`             | int    | `4`        | DataLoader worker processes.                                       |
| `scheduler`               | string | `"cosine"` | LR scheduler: `"cosine"`, `"step"`, or `"plateau"`.               |
| `step_size`               | int    | `15`       | Epoch interval for StepLR decay (used when `scheduler = "step"`). |
| `patience`                | int    | `7`        | ReduceLROnPlateau patience (used when `scheduler = "plateau"`).   |
| `early_stopping_patience` | int    | `10`       | Stop training if val loss does not improve for this many epochs. Set to `0` to disable. |
| `amp`                     | bool   | `true`     | Enable automatic mixed-precision (requires CUDA).                  |
| `label_smoothing`         | float  | `0.1`      | Label smoothing for CrossEntropyLoss (classification only; ignored in regression mode). |

#### `paths` section

| Key              | Type | Default                              | Description                          |
|------------------|------|--------------------------------------|--------------------------------------|
| `data_dir`       | Path | `data/augmented-atok-test-sample/`   | Root directory of augmented images.  |
| `datamap_csv`    | Path | `datamaps/uuid_mapping_report.csv`   | UUID-to-label mapping file.          |
| `checkpoint_dir` | Path | `checkpoints/`                       | Directory for saved model weights.   |
| `log_dir`        | Path | `runs/`                              | TensorBoard event file directory.    |

### Provided Experiment Files

| File                              | Backbone        | Task           | Input Size | Notes                                              |
|-----------------------------------|-----------------|----------------|------------|----------------------------------------------------|
| `experiments/baseline_resnet50.yaml`   | ResNet-50       | Classification | 224x224    | Recommended starting point; no timm required.     |
| `experiments/efficientnet_b4.yaml`     | EfficientNet-B4 | Classification | 380x380    | Higher capacity; requires ~6 GB VRAM.             |
| `experiments/convnext_tiny.yaml`       | ConvNeXt-Tiny   | Classification | 224x224    | Strong accuracy/compute trade-off.                |
| `experiments/vit_b16.yaml`             | ViT-B/16        | Classification | 224x224    | Attention-based; use lower LR (`5e-5`).           |
| `experiments/regression_resnet50.yaml` | ResNet-50       | Regression     | 224x224    | Treats N, P, K, pH as continuous regression targets. |

---

## Training

### Basic Usage

```bash
# Default config (ResNet-50 classification, built-in defaults)
python train/train.py

# Specific experiment
python train/train.py --config experiments/efficientnet_b4.yaml

# Override epochs for a quick smoke test
python train/train.py --config experiments/baseline_resnet50.yaml --epochs 2
```

### Training Behaviour

- The optimiser is **AdamW** with the learning rate and weight decay specified in the config.
- The **best checkpoint** (by validation loss) is saved automatically to `checkpoints/{name}_best.pt`.
- **Early stopping** halts training if validation loss does not improve within `early_stopping_patience` epochs.
- **AMP** (automatic mixed-precision with `torch.cuda.amp`) is enabled by default when a CUDA device is available, and is a no-op on CPU.
- Metrics are printed to stdout each epoch in a tabular format and logged to TensorBoard.

### Loss Functions

| Task             | Loss                                                              |
|------------------|-------------------------------------------------------------------|
| Classification   | Per-head `CrossEntropyLoss` with configurable label smoothing; head losses are summed. |
| Regression       | `HuberLoss` (delta=1.0), shared across all targets.              |

---

## Evaluation

Evaluate a saved checkpoint on the held-out test set:

```bash
# Evaluate best checkpoint for a given experiment
python train/evaluate.py --config experiments/baseline_resnet50.yaml

# Evaluate a specific checkpoint file
python train/evaluate.py \
    --config experiments/efficientnet_b4.yaml \
    --checkpoint checkpoints/efficientnet_b4_best.pt

# Save per-sample predictions to CSV for downstream analysis
python train/evaluate.py \
    --config experiments/baseline_resnet50.yaml \
    --save-preds results/test_predictions.csv
```

The evaluation script reproduces the same UUID-aware split as training (using the same seed), ensuring the test set is identical to what was held out during training.

### Metrics Reported

**Classification mode:**

| Metric        | Description                                                    |
|---------------|----------------------------------------------------------------|
| Accuracy      | Top-1 accuracy per target (N, P, K)                           |
| Macro F1      | Macro-averaged F1-score per target (treats each class equally) |
| Cohen's Kappa | Inter-rater agreement per target; penalises ordinal confusions |

**Regression mode:**

| Metric | Description                          |
|--------|--------------------------------------|
| MAE    | Mean Absolute Error per target       |
| RMSE   | Root Mean Squared Error per target   |
| R²     | Coefficient of determination per target |

---

## Inference

### Single Image

```bash
python train/inference.py \
    --image path/to/field_photo.jpg \
    --config experiments/baseline_resnet50.yaml
```

Output:

```
Image: path/to/field_photo.jpg
  n: Low
  n_confidence: 0.8312
  p: Medium
  p_confidence: 0.6741
  k: Low
  k_confidence: 0.7958
```

### Folder of Images

```bash
python train/inference.py \
    --folder path/to/images/ \
    --config experiments/baseline_resnet50.yaml \
    --save results/batch_predictions.csv
```

If `--save` is omitted, predictions are printed to stdout as a formatted table.

### Specifying a Checkpoint

By default, inference loads `checkpoints/{name}_best.pt` where `{name}` is the experiment name from the config file. To override:

```bash
python train/inference.py \
    --image soil.jpg \
    --config experiments/efficientnet_b4.yaml \
    --checkpoint checkpoints/efficientnet_b4_best.pt
```

### Programmatic Use

```python
from train.inference import SoilPredictor

predictor = SoilPredictor(
    checkpoint_path="checkpoints/baseline_resnet50_best.pt",
    config_path="experiments/baseline_resnet50.yaml",
)

result = predictor.predict("field_photo.jpg")
# {"n": "Low", "n_confidence": 0.83, "p": "Medium", "p_confidence": 0.67, ...}

batch_results = predictor.predict_batch(["img1.jpg", "img2.jpg"])
```

---

## TensorBoard Monitoring

TensorBoard event files are written to `runs/{experiment_name}/` during training.

```bash
tensorboard --logdir runs/
```

The following scalars are logged each epoch:

| Tag                           | Description                                      |
|-------------------------------|--------------------------------------------------|
| `loss/train`                  | Mean training loss                               |
| `loss/val`                    | Mean validation loss                             |
| `lr`                          | Current learning rate                            |
| `val/{target}/{metric}`       | Per-target validation metrics (e.g., `val/n/accuracy`, `val/p/f1`) |

To compare multiple experiments, point `--logdir` at the parent directory:

```bash
tensorboard --logdir runs/
```

All experiment subdirectories will appear as separate runs in the TensorBoard UI.

---

## Architecture Overview

### Model Registry

The `build_model()` factory in `train/model.py` is the single entry point for model construction. It reads the backbone name and task from `ExperimentConfig` and returns a fully constructed `nn.Module`.

```python
from train.config import get_config
from train.model import build_model

cfg = get_config("experiments/vit_b16.yaml")
model = build_model(cfg)
```

### Encoder Backends

| Backbone        | Library      | ImageNet Weights Source     | Feature Dim |
|-----------------|--------------|-----------------------------|-------------|
| `resnet50`      | torchvision  | ImageNet-1K V2              | 2048        |
| `efficientnet_b4` | timm       | ImageNet-1K                 | 1792        |
| `convnext_tiny` | timm         | ImageNet-1K                 | 768         |
| `vit_b16`       | timm         | ImageNet-21K / ImageNet-1K  | 768         |

All encoders are loaded with their original classification head replaced by `nn.Identity()`, so they output a flat feature vector of dimension `feature_dim`.

### Multi-Head Classification Design

In classification mode, the model uses one independent linear head per nutrient target:

```
Input image (3 x H x W)
        |
   [Shared Encoder]        <- frozen or fine-tuned backbone
        |
   Feature vector (D,)
        |
   +----------+----------+
   |          |          |
 [Head-N]  [Head-P]  [Head-K]    <- one nn.Linear per target
   |          |          |
 (3 logits) (3 logits) (3 logits)
```

Each head produces `num_classes` logits (default: 3 for Low / Medium / High). The heads are independent, which allows each nutrient to have a different number of classes if required, and each head receives its own CrossEntropyLoss gradient signal.

In regression mode, a single shared head outputs a vector of length `num_targets`:

```
Feature vector (D,)
        |
   [Dropout → Linear(D, T)]
        |
   (T continuous values)
```

Regression targets can include pH as a fourth output by setting `targets: [n, p, k, ph]` in the config.

### Class Mapping

| Integer Label | String Label |
|---------------|--------------|
| 0             | Low          |
| 1             | Medium       |
| 2             | High         |

---

## Results

> **Note:** The table below contains placeholder rows. Results will be populated as experiments are completed. Replace the placeholder values with actual test-set metrics.

### Classification (N, P, K — Accuracy / Macro F1 / Cohen's Kappa)

| Experiment              | Backbone        | N Acc | N F1 | N Kappa | P Acc | P F1 | P Kappa | K Acc | K F1 | K Kappa |
|-------------------------|-----------------|-------|------|---------|-------|------|---------|-------|------|---------|
| `baseline_resnet50`     | ResNet-50       | —     | —    | —       | —     | —    | —       | —     | —    | —       |
| `efficientnet_b4`       | EfficientNet-B4 | —     | —    | —       | —     | —    | —       | —     | —    | —       |
| `convnext_tiny`         | ConvNeXt-Tiny   | —     | —    | —       | —     | —    | —       | —     | —    | —       |
| `vit_b16`               | ViT-B/16        | —     | —    | —       | —     | —    | —       | —     | —    | —       |

### Regression (N, P, K, pH — MAE / RMSE / R²)

| Experiment              | Backbone  | N MAE | N R² | P MAE | P R² | K MAE | K R² | pH MAE | pH R² |
|-------------------------|-----------|-------|------|-------|------|-------|------|--------|-------|
| `regression_resnet50`   | ResNet-50 | —     | —    | —     | —    | —     | —    | —      | —     |

All results are reported on the held-out test set (10% of unique UUIDs, seed=42).

---

## Project Structure

```
SoilScan/
├── data/
│   └── augmented-atok-test-sample/
│       ├── 640x480/          # 12 augmentation types x 3 resolutions
│       ├── 1280x720/
│       └── 1920x1080/
├── datamaps/
│   ├── uuid_mapping_report.csv        # primary label file: uuid, ph, k, p, n
│   ├── final_merged_data_cleaned.csv  # rich metadata: GPS, weather, device, camera
│   └── com_field_data_df4_sorted.csv  # raw field log
├── experiments/
│   ├── baseline_resnet50.yaml         # ResNet-50 classification (recommended start)
│   ├── efficientnet_b4.yaml           # EfficientNet-B4 classification
│   ├── convnext_tiny.yaml             # ConvNeXt-Tiny classification
│   ├── vit_b16.yaml                   # ViT-B/16 classification
│   └── regression_resnet50.yaml       # ResNet-50 regression (N, P, K, pH)
├── train/
│   ├── config.py      # ExperimentConfig dataclass + YAML loader
│   ├── dataset.py     # SoilDataset, build_dataloaders, uuid_aware_split
│   ├── model.py       # build_model() registry and task head definitions
│   ├── metrics.py     # MAE/RMSE/R² (regression), Accuracy/F1/Kappa (classification)
│   ├── train.py       # main training loop: AMP, early stopping, TensorBoard, checkpointing
│   ├── evaluate.py    # checkpoint evaluation on test set + optional CSV export
│   └── inference.py   # SoilPredictor class + CLI for single image or folder
├── checkpoints/       # auto-created; stores best checkpoint per experiment ({name}_best.pt)
├── runs/              # TensorBoard event files, one subdirectory per experiment
└── requirements.txt
```

---

## Citation

If you use SoilScan or the associated dataset in your research, please cite:

```bibtex
@misc{soilscan2024,
  author    = {TO BE FILLED},
  title     = {SoilScan: Deep Learning for Soil Nutrient Prediction from Field Photography},
  year      = {2024},
  url       = {https://github.com/your-org/SoilScan},
  note      = {TO BE FILLED}
}
```

---

## Acknowledgements

- **Dataset collection** was conducted in the Cordillera Administrative Region of the Philippines. The authors thank the farmers and local government units of Atok and La Trinidad, Benguet, for access and cooperation.
- **Backbone implementations** are provided by [torchvision](https://github.com/pytorch/vision) and [timm](https://github.com/huggingface/pytorch-image-models).
- TO BE FILLED: funding sources, institutional affiliations, and any additional collaborators.
