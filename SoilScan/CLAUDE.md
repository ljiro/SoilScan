# SoilScan — Claude Code Project Guide

## Project Overview

Deep-learning pipeline that predicts soil nutrient levels (N, P, K, optionally pH)
from augmented field photographs. Built for agricultural research in the Cordillera
region, Philippines (Atok, La Trinidad, etc.).

**Current branch:** `model/classification-models`
**Primary task mode:** classification (Low / Medium / High per nutrient)

---

## Repository Layout

```
SoilScan/
├── data/augmented-atok-test-sample/   # 15,048 matched images (3 res × 12 aug types)
├── datamaps/
│   ├── uuid_mapping_report.csv        # PRIMARY label file: uuid, ph, k, p, n
│   └── final_merged_data_cleaned.csv  # rich metadata (GPS, weather, device)
├── experiments/                       # YAML experiment configs (one per run)
├── train/                             # all ML code lives here
│   ├── config.py     # ExperimentConfig dataclass + YAML loader
│   ├── dataset.py    # SoilDataset, build_dataloaders, uuid_aware_split
│   ├── model.py      # build_model() registry
│   ├── metrics.py    # MAE/RMSE/R² and Accuracy/F1/Kappa
│   ├── train.py      # training loop (TensorBoard, AMP, early stopping)
│   ├── evaluate.py   # checkpoint evaluation on test set
│   ├── inference.py  # SoilPredictor class + CLI
│   └── smoke_test.py # 5-batch pipeline sanity check
├── checkpoints/      # auto-created; best model per experiment saved here
├── runs/             # TensorBoard event files
└── requirements.txt
```

---

## Common Commands

```bash
# Verify the full pipeline (fast — 5 batches only)
python train/smoke_test.py

# Train with default config (ResNet-50, classification)
python train/train.py

# Train with a specific experiment YAML
python train/train.py --config experiments/efficientnet_b4.yaml

# Quick smoke-test a specific experiment
python train/smoke_test.py --config experiments/convnext_tiny.yaml

# Evaluate saved checkpoint on test set
python train/evaluate.py --config experiments/baseline_resnet50.yaml

# Save per-sample predictions to CSV
python train/evaluate.py --config experiments/baseline_resnet50.yaml --save-preds results/preds.csv

# Single-image inference
python train/inference.py --image path/to/soil.jpg

# Folder inference → CSV
python train/inference.py --folder data/ --save results/out.csv

# Monitor training in TensorBoard
tensorboard --logdir runs/

# Print resolved config (useful for debugging)
python train/config.py
python train/config.py experiments/efficientnet_b4.yaml
```

---

## Experiment YAML Files

| File | Backbone | img_size | batch | Notes |
|---|---|---|---|---|
| `baseline_resnet50.yaml` | ResNet-50 | 224 | 16 | Start here |
| `efficientnet_b4.yaml` | EfficientNet-B4 | 224 | 8 | Needs `timm` |
| `convnext_tiny.yaml` | ConvNeXt-Tiny | 224 | 16 | Needs `timm` |
| `vit_b16.yaml` | ViT-B/16 | 224 | 8 | Needs `timm` |
| `regression_resnet50.yaml` | ResNet-50 | 224 | 16 | Regression mode, includes pH |

---

## Hardware — GTX 1650 (4 GB VRAM)

- **CUDA PyTorch required** — CPU training is impractical (~50 min/epoch)
- Install: `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124` (must run as Admin since Python is in Program Files)
- All configs are tuned for 4 GB: `batch_size` capped at 8–16, `num_workers=2`
- AMP is enabled everywhere — do not disable it

---

## Key Design Decisions

### UUID-aware splitting
All augmented variants of one original capture share the same UUID and always
land in the same split. **Never bypass this** — splitting by image would leak
data and inflate metrics.

### Image filename convention
`{location}_{barangay}_{date8}_{time6}_{uuid8hex}_{augtype}_{level}.png`

The UUID regex is `_\d{6}_([0-9a-f]{8})_` — anchored after the 6-digit time
to skip the date segment (which is also 8 hex-compatible digits).

### Label encoding
N, P, K are **ordinal 3-class** labels: `0=Low`, `1=Medium`, `2=High`.
pH is a continuous float. The primary label file is `uuid_mapping_report.csv`.
31 rows have NaN in at least one target — these are silently dropped at load time.

### Model registry
All backbone logic is in `train/model.py::build_model()`.
Add new architectures there. Classification uses **one head per nutrient**
(independent CrossEntropyLoss per head), not a shared multi-label head.

### Metrics
All metric functions live in `train/metrics.py` — do not scatter metric
computation across train.py or evaluate.py.

---

## Adding a New Experiment

1. Copy an existing YAML from `experiments/`
2. Change `name`, `model.backbone`, and any hyperparameters
3. Run `python train/smoke_test.py --config experiments/your_new.yaml` first
4. If smoke test passes, run `python train/train.py --config experiments/your_new.yaml`
5. Checkpoint saved to `checkpoints/{name}_best.pt`

---

## Adding a New Backbone

1. Add a branch in `train/model.py::_build_encoder()` returning `(encoder, feature_dim)`
2. Add the name to the `Literal[...]` type hint in `ModelConfig.backbone`
3. Add a YAML in `experiments/`
4. Run `python train/model.py` to smoke-test all architectures

---

## Known Issues / Gotchas

- **Windows terminal encoding** — avoid non-ASCII characters (arrows `→`, checkmarks `✓`) in `print()` calls; the cp1252 codec will raise `UnicodeEncodeError`
- **pin_memory warning on CPU** — harmless; disappears once CUDA torch is installed
- **TensorFlow oneDNN messages** — come from the TensorBoard install, not the training code; suppress with `set TF_ENABLE_ONEDNN_OPTS=0`
- **Concurrent pip installs** — running two pip commands simultaneously on this machine causes file-lock conflicts on `torch._C.pyd`; always run one at a time
