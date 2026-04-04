"""
Main training script for SoilScan.

Supports both regression and multi-head classification tasks,
four backbone architectures, TensorBoard logging, early stopping,
AMP (mixed-precision), and checkpoint management.

Usage
-----
  # default config (classification, ResNet-50)
  python train/train.py

  # custom experiment YAML
  python train/train.py --config experiments/efficientnet_b4.yaml

  # quick smoke-test (2 epochs, tiny batch)
  python train/train.py --config experiments/baseline_resnet50.yaml --epochs 2
"""

from __future__ import annotations

import argparse
import logging
import random
import sys
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
from sklearn.utils.class_weight import compute_class_weight
from torch.cuda.amp import GradScaler, autocast
from torch.utils.data import DataLoader
from torch.utils.tensorboard import SummaryWriter
from tqdm import tqdm

# Make train/ importable regardless of cwd
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import ExperimentConfig, get_config
from dataset import build_dataloaders
from metrics import (
    classification_report,
    format_classification_table,
    format_regression_table,
    regression_report,
)
from model import build_model

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("soilscan.train")


# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------

def set_seed(seed: int) -> None:
    """Set all RNG seeds for reproducibility."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


# ---------------------------------------------------------------------------
# Loss builders
# ---------------------------------------------------------------------------

def build_criterion(
    cfg: ExperimentConfig,
    class_weights: Optional[List[torch.Tensor]] = None,
) -> nn.Module | List[nn.Module]:
    """
    Return the loss criterion (or list of per-head criteria).

    regression      → HuberLoss (robust to outliers)
    classification  → CrossEntropyLoss per head (with optional label smoothing
                       and optional per-class weights for imbalanced datasets)
    """
    if cfg.data.task == "regression":
        return nn.HuberLoss()
    else:
        return [
            nn.CrossEntropyLoss(
                weight=class_weights[i] if class_weights else None,
                label_smoothing=cfg.train.label_smoothing,
            )
            for i in range(len(cfg.data.targets))
        ]


# ---------------------------------------------------------------------------
# Scheduler builder
# ---------------------------------------------------------------------------

def build_scheduler(cfg: ExperimentConfig, optimizer: torch.optim.Optimizer):
    """Instantiate the LR scheduler specified in ``cfg.train.scheduler``."""
    name = cfg.train.scheduler
    if name == "cosine":
        return torch.optim.lr_scheduler.CosineAnnealingLR(
            optimizer, T_max=cfg.train.epochs
        )
    elif name == "step":
        return torch.optim.lr_scheduler.StepLR(
            optimizer, step_size=cfg.train.step_size, gamma=0.1
        )
    elif name == "plateau":
        return torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, mode="min", patience=cfg.train.patience, factor=0.5
        )
    else:
        raise ValueError(f"Unknown scheduler: '{name}'")


# ---------------------------------------------------------------------------
# One training epoch
# ---------------------------------------------------------------------------

def train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
    scaler: GradScaler,
    task: str,
    target_names: List[str],
) -> Tuple[float, dict]:
    """
    Run one full pass over the training loader.

    Returns
    -------
    (mean_total_loss, per_target_losses)
        per_target_losses maps each target name to its mean loss.
    """
    model.train()
    total_loss = 0.0
    per_target_totals = [0.0] * len(target_names)

    pbar = tqdm(loader, desc="  Train", leave=False, unit="batch")
    for imgs, labels in pbar:
        imgs   = imgs.to(device, non_blocking=True)
        labels = labels.to(device, non_blocking=True)

        optimizer.zero_grad()

        with autocast(enabled=scaler.is_enabled()):
            preds = model(imgs)
            loss, head_losses = _compute_loss(preds, labels, criterion, task)

        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

        n = imgs.size(0)
        total_loss += loss.item() * n
        for i, hl in enumerate(head_losses):
            per_target_totals[i] += hl * n

        postfix = {t: f"{hl:.3f}" for t, hl in zip(target_names, head_losses)}
        postfix["total"] = f"{loss.item():.3f}"
        pbar.set_postfix(postfix)

    n_samples = len(loader.dataset)
    per_target_losses = {
        t: per_target_totals[i] / n_samples
        for i, t in enumerate(target_names)
    }
    return total_loss / n_samples, per_target_losses


# ---------------------------------------------------------------------------
# Validation / evaluation pass
# ---------------------------------------------------------------------------

@torch.no_grad()
def evaluate_loader(
    model: nn.Module,
    loader: DataLoader,
    criterion,
    device: torch.device,
    task: str,
    target_names: List[str],
) -> Tuple[float, dict, dict]:
    """
    Run a full evaluation pass and return (loss, metrics_dict, per_target_losses).

    Parameters
    ----------
    model : nn.Module
    loader : DataLoader
    criterion : loss or list of losses
    device : torch.device
    task : {"regression", "classification"}
    target_names : list of str

    Returns
    -------
    (mean_loss, report)
        ``report`` has the structure returned by
        :func:`metrics.regression_report` or :func:`metrics.classification_report`.
    """
    model.eval()
    total_loss = 0.0
    per_target_totals = [0.0] * len(target_names)
    all_preds: list = []
    all_labels: list = []

    pbar = tqdm(loader, desc="    Val", leave=False, unit="batch")
    for imgs, labels in pbar:
        imgs   = imgs.to(device, non_blocking=True)
        labels = labels.to(device, non_blocking=True)

        preds = model(imgs)
        loss, head_losses = _compute_loss(preds, labels, criterion, task)
        n = imgs.size(0)
        total_loss += loss.item() * n
        for i, hl in enumerate(head_losses):
            per_target_totals[i] += hl * n
        pbar.set_postfix(loss=f"{loss.item():.4f}")

        if task == "regression":
            all_preds.append(preds.cpu())
        else:
            all_preds.append([p.cpu() for p in preds])
        all_labels.append(labels.cpu())

    all_labels_cat = torch.cat(all_labels)
    n_samples = len(loader.dataset)
    mean_loss = total_loss / n_samples
    per_target_losses = {
        t: per_target_totals[i] / n_samples
        for i, t in enumerate(target_names)
    }

    if task == "regression":
        all_preds_cat = torch.cat(all_preds)
        report = regression_report(all_preds_cat, all_labels_cat.float(), target_names)
    else:
        all_preds_per_head = [
            torch.cat([batch[i] for batch in all_preds])
            for i in range(len(target_names))
        ]
        report = classification_report(all_preds_per_head, all_labels_cat, target_names)

    return mean_loss, report, per_target_losses


# ---------------------------------------------------------------------------
# Loss computation helper
# ---------------------------------------------------------------------------

def _compute_loss(
    preds, labels, criterion, task: str
) -> Tuple[torch.Tensor, List[float]]:
    """
    Returns (total_loss, per_head_losses).

    Classification loss is the *mean* across heads so the value is
    comparable regardless of how many targets are active.
    per_head_losses is a list of scalar floats, one per target.
    """
    if task == "regression":
        loss = criterion(preds, labels.float())
        return loss, [loss.item()]
    else:
        head_losses = [
            head_crit(head_preds, labels[:, i])
            for i, (head_preds, head_crit) in enumerate(zip(preds, criterion))
        ]
        total = torch.stack(head_losses).mean()
        return total, [h.item() for h in head_losses]


# ---------------------------------------------------------------------------
# TensorBoard logging helper
# ---------------------------------------------------------------------------

def _log_to_tb(writer: SummaryWriter, tag_prefix: str, report: dict, step: int):
    """Flatten a nested metrics dict to TensorBoard scalar entries."""
    for target, metrics in report.items():
        for metric_name, value in metrics.items():
            writer.add_scalar(f"{tag_prefix}/{target}/{metric_name}", value, step)


# ---------------------------------------------------------------------------
# Main training loop
# ---------------------------------------------------------------------------

def main(cfg: ExperimentConfig) -> None:
    set_seed(cfg.data.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log.info(f"Device: {device}  |  Experiment: {cfg.name}")

    # --- Data ---
    train_loader, val_loader, _ = build_dataloaders(cfg)

    # --- Model ---
    model = build_model(cfg).to(device)
    log.info(f"Backbone: {cfg.model.backbone}  |  Task: {cfg.data.task}")

    # --- Optimiser + scheduler ---
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=cfg.train.lr,
        weight_decay=cfg.train.weight_decay,
    )
    scheduler = build_scheduler(cfg, optimizer)

    # --- Class weights (classification only) ---
    class_weights = None
    if cfg.data.task == "classification":
        train_labels = np.array([s[1] for s in train_loader.dataset.samples])
        class_weights = []
        for i in range(train_labels.shape[1]):
            col = train_labels[:, i].astype(int)
            classes = np.unique(col)
            weights = compute_class_weight("balanced", classes=classes, y=col)
            w = torch.zeros(cfg.model.num_classes, dtype=torch.float32)
            for cls, val in zip(classes, weights):
                w[cls] = val
            class_weights.append(w.to(device))
        log.info(f"Class weights computed for targets: {cfg.data.targets}")
        for name, w in zip(cfg.data.targets, class_weights):
            log.info(f"  {name.upper()}: {w.cpu().tolist()}")

    criterion = build_criterion(cfg, class_weights)

    # --- AMP ---
    use_amp = cfg.train.amp and device.type == "cuda"
    scaler = GradScaler(enabled=use_amp)

    # --- TensorBoard ---
    log_dir = cfg.paths.log_dir / cfg.name
    writer = SummaryWriter(log_dir=str(log_dir))
    log.info(f"TensorBoard logs → {log_dir}")

    # --- Checkpointing ---
    cfg.paths.checkpoint_dir.mkdir(parents=True, exist_ok=True)
    best_path = cfg.paths.checkpoint_dir / f"{cfg.name}_best.pt"

    best_val_loss = float("inf")
    epochs_no_improve = 0

    # --- Training loop ---
    epoch_pbar = tqdm(range(1, cfg.train.epochs + 1), desc="Epochs", unit="epoch")
    for epoch in epoch_pbar:
        train_loss, train_per_target = train_one_epoch(
            model, train_loader, criterion, optimizer, device, scaler,
            cfg.data.task, cfg.data.targets,
        )
        val_loss, val_report, val_per_target = evaluate_loader(
            model, val_loader, criterion, device, cfg.data.task, cfg.data.targets
        )

        # LR scheduler step
        if cfg.train.scheduler == "plateau":
            scheduler.step(val_loss)
        else:
            scheduler.step()

        current_lr = optimizer.param_groups[0]["lr"]
        epoch_pbar.set_postfix(train=f"{train_loss:.4f}", val=f"{val_loss:.4f}", lr=f"{current_lr:.2e}")

        # Console log — total loss
        log.info(
            f"Epoch {epoch:3d}/{cfg.train.epochs}"
            f"  train={train_loss:.4f}"
            f"  val={val_loss:.4f}"
            f"  lr={current_lr:.2e}"
        )

        # Per-target loss table
        loss_header = f"{'Target':<10}  {'Train Loss':>10}  {'Val Loss':>10}"
        loss_sep = "-" * len(loss_header)
        loss_rows = [loss_header, loss_sep]
        for t in cfg.data.targets:
            loss_rows.append(
                f"{t.upper():<10}  {train_per_target[t]:10.4f}  {val_per_target[t]:10.4f}"
            )
        log.info("\n" + "\n".join(loss_rows))

        if cfg.data.task == "regression":
            log.info("\n" + format_regression_table(val_report))
        else:
            log.info("\n" + format_classification_table(val_report))

        # TensorBoard — total + per-target losses
        writer.add_scalar("loss/train", train_loss, epoch)
        writer.add_scalar("loss/val",   val_loss,   epoch)
        writer.add_scalar("lr",         current_lr, epoch)
        for t in cfg.data.targets:
            writer.add_scalar(f"loss_train/{t}", train_per_target[t], epoch)
            writer.add_scalar(f"loss_val/{t}",   val_per_target[t],   epoch)
        _log_to_tb(writer, "val", val_report, epoch)

        # Checkpoint
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            epochs_no_improve = 0
            torch.save(
                {
                    "epoch": epoch,
                    "model_state": model.state_dict(),
                    "val_loss": val_loss,
                    "val_report": val_report,
                    "cfg": cfg,
                },
                best_path,
            )
            log.info(f"  => Saved best checkpoint (val_loss={val_loss:.4f})")
        else:
            epochs_no_improve += 1

        # Early stopping
        if (
            cfg.train.early_stopping_patience > 0
            and epochs_no_improve >= cfg.train.early_stopping_patience
        ):
            log.info(
                f"Early stopping triggered after {epoch} epochs "
                f"({epochs_no_improve} epochs without improvement)."
            )
            break

    writer.close()
    log.info(f"\nTraining complete. Best val_loss={best_val_loss:.4f}")
    log.info(f"Checkpoint saved to: {best_path}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train SoilScan NPK model")
    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="Path to YAML experiment config (default: built-in defaults)",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=None,
        help="Override number of training epochs",
    )
    args = parser.parse_args()

    cfg = get_config(args.config)
    if args.epochs is not None:
        cfg.train.epochs = args.epochs

    main(cfg)
