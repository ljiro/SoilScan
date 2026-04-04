"""
Configuration system for SoilScan experiments.

Supports two loading modes:
  1. Programmatic — import and modify the dataclass directly.
  2. YAML-driven  — load an experiment file from experiments/ and override defaults.

Usage
-----
  # default config
  from config import get_config
  cfg = get_config()

  # from a YAML file
  cfg = get_config("../experiments/baseline_resnet50.yaml")
"""

from __future__ import annotations

import yaml
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import List, Literal, Optional


# ---------------------------------------------------------------------------
# Canonical project root (parent of the train/ directory)
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parent.parent


@dataclass
class PathConfig:
    """All file-system paths used by the pipeline."""
    data_dir: Path = ROOT_DIR / "data" / "augmented-atok-test-sample"
    datamap_csv: Path = ROOT_DIR / "datamaps" / "uuid_mapping_report.csv"
    checkpoint_dir: Path = ROOT_DIR / "checkpoints"
    log_dir: Path = ROOT_DIR / "runs"           # TensorBoard logs


@dataclass
class DataConfig:
    """Dataset construction and splitting parameters."""
    targets: List[str] = field(default_factory=lambda: ["n", "p", "k"])
    """Columns in the datamap CSV to predict. Add "ph" to include soil pH."""

    task: Literal["regression", "classification"] = "classification"
    """
    regression   — predict raw continuous nutrient values via MSE/Huber loss.
    classification — predict ordinal Low/Medium/High classes (0/1/2) via
                     CrossEntropy per target head.
    """

    img_size: int = 224
    """Images are resized so the shorter side equals img_size + 32 then
    center-cropped to img_size × img_size."""

    val_split: float = 0.15
    """Fraction of *unique UUIDs* held out for validation."""

    test_split: float = 0.10
    """Fraction of *unique UUIDs* held out for final test evaluation."""

    seed: int = 42


@dataclass
class ModelConfig:
    """Backbone and head configuration."""
    backbone: Literal[
        "resnet50",
        "efficientnet_b4",
        "convnext_tiny",
        "vit_b16",
    ] = "resnet50"
    """
    resnet50        — ResNet-50 pretrained on ImageNet-1k (torchvision).
    efficientnet_b4 — EfficientNet-B4 via timm.
    convnext_tiny   — ConvNeXt-Tiny via timm.
    vit_b16         — Vision Transformer ViT-B/16 via timm.
    """

    pretrained: bool = True
    """Use ImageNet pretrained weights."""

    dropout: float = 0.3
    """Dropout rate applied before the final head."""

    num_classes: int = 3
    """
    Classification only.
    Number of ordinal classes per target (default 3 = Low / Medium / High).
    Ignored when task == "regression".
    """


@dataclass
class TrainConfig:
    """Optimiser, scheduler, and training-loop hyper-parameters."""
    batch_size: int = 16
    epochs: int = 50
    lr: float = 3e-4
    weight_decay: float = 1e-4
    num_workers: int = 2     # Windows uses spawn; 2 is optimal for GTX 1650

    scheduler: Literal["cosine", "step", "plateau"] = "cosine"
    """
    cosine  — CosineAnnealingLR over the full training run.
    step    — StepLR, decays by 0.1 every step_size epochs.
    plateau — ReduceLROnPlateau, monitors val_loss.
    """
    step_size: int = 15       # used only when scheduler == "step"
    patience: int = 7         # used only when scheduler == "plateau"

    early_stopping_patience: int = 10
    """Stop if val_loss does not improve for this many epochs (0 = disabled)."""

    amp: bool = True
    """Enable automatic mixed-precision training (requires CUDA)."""

    label_smoothing: float = 0.1
    """
    Classification only.
    Smoothing factor passed to CrossEntropyLoss (0.0 = no smoothing).
    """


@dataclass
class ExperimentConfig:
    """Top-level experiment configuration (composition of sub-configs)."""
    name: str = "baseline"
    paths: PathConfig = field(default_factory=PathConfig)
    data: DataConfig = field(default_factory=DataConfig)
    model: ModelConfig = field(default_factory=ModelConfig)
    train: TrainConfig = field(default_factory=TrainConfig)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_config(yaml_path: Optional[str | Path] = None) -> ExperimentConfig:
    """
    Return an ExperimentConfig, optionally overriding defaults from a YAML file.

    Parameters
    ----------
    yaml_path : str or Path, optional
        Path to a YAML experiment file (see experiments/).
        Keys mirror the nested dataclass structure:
          name, paths.*, data.*, model.*, train.*

    Returns
    -------
    ExperimentConfig
    """
    cfg = ExperimentConfig()
    if yaml_path is None:
        return cfg

    yaml_path = Path(yaml_path)
    if not yaml_path.exists():
        raise FileNotFoundError(f"Experiment file not found: {yaml_path}")

    with yaml_path.open() as fh:
        overrides = yaml.safe_load(fh) or {}

    _apply_overrides(cfg, overrides)
    return cfg


def _apply_overrides(cfg: ExperimentConfig, overrides: dict) -> None:
    """Recursively apply a nested dict of overrides onto an ExperimentConfig."""
    for key, value in overrides.items():
        if key == "name":
            cfg.name = value
        elif key == "paths":
            _apply_dict(cfg.paths, value, path_fields={"data_dir", "datamap_csv",
                                                        "checkpoint_dir", "log_dir"})
        elif key == "data":
            _apply_dict(cfg.data, value)
        elif key == "model":
            _apply_dict(cfg.model, value)
        elif key == "train":
            _apply_dict(cfg.train, value)
        else:
            raise ValueError(f"Unknown top-level config key: '{key}'")


def _apply_dict(obj, updates: dict, path_fields: set = None) -> None:
    path_fields = path_fields or set()
    for k, v in updates.items():
        if not hasattr(obj, k):
            raise ValueError(f"Unknown config field '{k}' in {type(obj).__name__}")
        if k in path_fields:
            v = Path(v)
        setattr(obj, k, v)


# ---------------------------------------------------------------------------
# CLI: print current config
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys, json

    yaml_arg = sys.argv[1] if len(sys.argv) > 1 else None
    cfg = get_config(yaml_arg)

    # pretty-print as JSON (Path → str)
    def _serialise(obj):
        if isinstance(obj, Path):
            return str(obj)
        raise TypeError(f"Not serialisable: {type(obj)}")

    print(json.dumps(asdict(cfg), indent=2, default=_serialise))
