"""
SoilDataset — maps augmented soil images to nutrient labels via UUID.

Filename convention
-------------------
Augmented images follow the pattern::

    {location}_{date}_{time}_{uuid}_{augmentation}_{level}.png

The UUID is the 8-char hex segment captured by ``UUID_RE``.

Task modes
----------
regression
    Labels are raw float values loaded from the CSV (N, P, K are ordinal
    integers 0 / 1 / 2 in the current dataset, treated as continuous here).

classification
    Labels are integer class indices (LongTensor) suitable for CrossEntropyLoss.
    Values 0 / 1 / 2 map to Low / Medium / High nutrient level.

Transforms
----------
Training uses random spatial augmentations (flip, crop jitter, colour jitter)
on top of the standard ImageNet normalisation.
Validation / test uses a deterministic centre-crop only.

Usage
-----
  from config import get_config
  from dataset import build_dataloaders

  cfg = get_config()
  train_loader, val_loader, test_loader = build_dataloaders(cfg)
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

from config import ExperimentConfig

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

UUID_RE = re.compile(r"_\d{6}_([0-9a-f]{8})_")
# Skips the date segment (YYYYMMDD, all digits) by anchoring after
# the 6-digit time component (HHMMSS), then capturing the 8-char hex UUID.

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]


# ---------------------------------------------------------------------------
# Transform factories
# ---------------------------------------------------------------------------

def _train_transform(img_size: int) -> transforms.Compose:
    """
    Augmentation pipeline for training.

    Applies random horizontal flip, random resized crop (±10 % scale jitter),
    colour jitter, and ImageNet normalisation.
    """
    return transforms.Compose([
        transforms.Resize(img_size + 32),
        transforms.RandomResizedCrop(img_size, scale=(0.8, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2,
                               saturation=0.1, hue=0.05),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def _eval_transform(img_size: int) -> transforms.Compose:
    """Deterministic centre-crop pipeline for validation and test."""
    return transforms.Compose([
        transforms.Resize(img_size + 32),
        transforms.CenterCrop(img_size),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


# ---------------------------------------------------------------------------
# Data loading helpers
# ---------------------------------------------------------------------------

def load_label_map(csv_path: Path, targets: List[str]) -> dict[str, np.ndarray]:
    """
    Parse the UUID-mapping CSV and return a dict of
    ``{uuid_str: np.array([val_target_0, val_target_1, …])}``.

    Parameters
    ----------
    csv_path : Path
        Path to ``uuid_mapping_report.csv`` (or the cleaned variant).
    targets : list of str
        Column names to use as labels (e.g. ``["n", "p", "k"]``).

    Returns
    -------
    dict
        Keys are 8-char hex UUID strings; values are float32 arrays.
    """
    df = pd.read_csv(csv_path)
    df["uuid"] = df["uuid"].astype(str).str.strip()

    missing = [t for t in targets if t not in df.columns]
    if missing:
        raise ValueError(
            f"Target column(s) {missing} not found in {csv_path}. "
            f"Available columns: {list(df.columns)}"
        )

    # Drop any row where at least one target value is missing
    before = len(df)
    df = df.dropna(subset=targets).reset_index(drop=True)
    dropped = before - len(df)
    if dropped:
        print(f"[dataset] dropped {dropped} rows with NaN in targets {targets}")

    label_map: dict[str, np.ndarray] = {}
    for _, row in df.iterrows():
        label_map[row["uuid"]] = np.array(
            [row[t] for t in targets], dtype=np.float32
        )
    return label_map


def collect_samples(
    data_dir: Path,
    label_map: dict[str, np.ndarray],
) -> List[Tuple[Path, np.ndarray]]:
    """
    Recursively walk *data_dir* and collect (image_path, label) pairs for
    every PNG whose UUID is present in *label_map*.

    Parameters
    ----------
    data_dir : Path
        Root of the augmented image tree.
    label_map : dict
        UUID → label array mapping from :func:`load_label_map`.

    Returns
    -------
    list of (Path, np.ndarray)
    """
    samples: List[Tuple[Path, np.ndarray]] = []
    skipped = 0
    for img_path in sorted(data_dir.rglob("*.png")):
        m = UUID_RE.search(img_path.name)
        if m is None:
            skipped += 1
            continue
        uuid = m.group(1)
        if uuid not in label_map:
            skipped += 1
            continue
        samples.append((img_path, label_map[uuid]))
    if skipped:
        print(f"[dataset] skipped {skipped} images (UUID not in label map)")
    return samples


def uuid_aware_split(
    samples: List[Tuple[Path, np.ndarray]],
    val_fraction: float,
    test_fraction: float,
    seed: int,
) -> Tuple[
    List[Tuple[Path, np.ndarray]],
    List[Tuple[Path, np.ndarray]],
    List[Tuple[Path, np.ndarray]],
]:
    """
    Split *samples* into train / val / test ensuring no UUID leaks across splits.

    All augmented variants of a single original capture share the same UUID and
    will therefore always fall in the same split — preventing data leakage.

    Parameters
    ----------
    samples : list of (Path, ndarray)
    val_fraction : float
        Fraction of unique UUIDs held out for validation.
    test_fraction : float
        Fraction of unique UUIDs held out for final testing.
    seed : int

    Returns
    -------
    (train_samples, val_samples, test_samples)
    """
    import random

    uuid_to_samples: dict[str, list] = {}
    for path, label in samples:
        m = UUID_RE.search(path.name)
        uid = m.group(1) if m else path.name
        uuid_to_samples.setdefault(uid, []).append((path, label))

    uuids = sorted(uuid_to_samples.keys())
    rng = random.Random(seed)
    rng.shuffle(uuids)

    n = len(uuids)
    n_test = max(1, int(n * test_fraction))
    n_val  = max(1, int(n * val_fraction))

    test_uuids  = set(uuids[:n_test])
    val_uuids   = set(uuids[n_test: n_test + n_val])
    train_uuids = set(uuids[n_test + n_val:])

    def _gather(uid_set):
        return [s for uid in uid_set for s in uuid_to_samples[uid]]

    return _gather(train_uuids), _gather(val_uuids), _gather(test_uuids)


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

class SoilDataset(Dataset):
    """
    PyTorch Dataset for soil NPK prediction from augmented field images.

    Parameters
    ----------
    samples : list of (Path, ndarray)
        Collected by :func:`collect_samples`.
    transform : torchvision transform, optional
        Applied to each PIL image before returning.
    task : {"regression", "classification"}
        Determines the label dtype:
        - ``"regression"``     → FloatTensor
        - ``"classification"`` → LongTensor (class indices)
    """

    def __init__(
        self,
        samples: List[Tuple[Path, np.ndarray]],
        transform: Optional[transforms.Compose] = None,
        task: str = "classification",
    ):
        self.samples = samples
        self.transform = transform
        self.task = task

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        img_path, label = self.samples[idx]
        img = Image.open(img_path).convert("RGB")
        if self.transform:
            img = self.transform(img)

        if self.task == "classification":
            return img, torch.tensor(label, dtype=torch.long)
        else:
            return img, torch.tensor(label, dtype=torch.float32)


# ---------------------------------------------------------------------------
# High-level builder
# ---------------------------------------------------------------------------

def build_dataloaders(
    cfg: ExperimentConfig,
) -> Tuple[DataLoader, DataLoader, DataLoader]:
    """
    Build train, val, and test DataLoaders from the experiment config.

    Parameters
    ----------
    cfg : ExperimentConfig

    Returns
    -------
    (train_loader, val_loader, test_loader)
    """
    label_map = load_label_map(cfg.paths.datamap_csv, cfg.data.targets)
    all_samples = collect_samples(cfg.paths.data_dir, label_map)
    print(f"[dataset] {len(label_map)} UUIDs in label map, "
          f"{len(all_samples)} matched images")

    train_s, val_s, test_s = uuid_aware_split(
        all_samples,
        val_fraction=cfg.data.val_split,
        test_fraction=cfg.data.test_split,
        seed=cfg.data.seed,
    )
    print(f"[dataset] split  train={len(train_s)}  val={len(val_s)}  test={len(test_s)}")

    img_size = cfg.data.img_size
    task = cfg.data.task

    train_ds = SoilDataset(train_s, transform=_train_transform(img_size), task=task)
    val_ds   = SoilDataset(val_s,   transform=_eval_transform(img_size),  task=task)
    test_ds  = SoilDataset(test_s,  transform=_eval_transform(img_size),  task=task)

    loader_kwargs = dict(
        batch_size=cfg.train.batch_size,
        num_workers=cfg.train.num_workers,
        pin_memory=True,
    )

    train_loader = DataLoader(train_ds, shuffle=True,  **loader_kwargs)
    val_loader   = DataLoader(val_ds,   shuffle=False, **loader_kwargs)
    test_loader  = DataLoader(test_ds,  shuffle=False, **loader_kwargs)

    return train_loader, val_loader, test_loader


# ---------------------------------------------------------------------------
# Quick sanity check
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    from config import get_config

    cfg = get_config()
    train_loader, val_loader, test_loader = build_dataloaders(cfg)

    imgs, labels = next(iter(train_loader))
    print(f"Image batch : {imgs.shape}")
    print(f"Label batch : {labels.shape}  dtype={labels.dtype}")
    print(f"Label sample: {labels[0].tolist()} (targets={cfg.data.targets})")
