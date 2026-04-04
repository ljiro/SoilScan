"""
Evaluate a saved checkpoint on the held-out test set.

Produces a full metrics report (MAE / RMSE / R² for regression;
Accuracy / F1 / Cohen's Kappa for classification) and optionally
saves per-sample predictions to a CSV for downstream analysis.

Usage
-----
  # evaluate best checkpoint for the default experiment
  python train/evaluate.py

  # evaluate a specific checkpoint
  python train/evaluate.py --checkpoint checkpoints/efficientnet_b4_best.pt

  # also save predictions CSV
  python train/evaluate.py --save-preds results/preds.csv
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import pandas as pd
import torch
from torch.utils.data import DataLoader

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
from train import set_seed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("soilscan.evaluate")


# ---------------------------------------------------------------------------
# Inference helpers
# ---------------------------------------------------------------------------

@torch.no_grad()
def run_inference(
    model: torch.nn.Module,
    loader: DataLoader,
    device: torch.device,
    task: str,
    num_targets: int,
):
    """
    Run inference over *loader* and collect predictions and ground-truth labels.

    Returns
    -------
    (all_preds, all_labels)
        For regression: both are Tensors of shape (N, T).
        For classification: ``all_preds`` is a list of T Tensors (N, C);
        ``all_labels`` is a LongTensor (N, T).
    """
    model.eval()
    all_preds_raw: list = []
    all_labels: list = []

    for imgs, labels in loader:
        imgs = imgs.to(device, non_blocking=True)
        preds = model(imgs)

        if task == "regression":
            all_preds_raw.append(preds.cpu())
        else:
            all_preds_raw.append([p.cpu() for p in preds])
        all_labels.append(labels.cpu())

    all_labels_cat = torch.cat(all_labels)

    if task == "regression":
        return torch.cat(all_preds_raw), all_labels_cat
    else:
        per_head = [
            torch.cat([batch[i] for batch in all_preds_raw])
            for i in range(num_targets)
        ]
        return per_head, all_labels_cat


# ---------------------------------------------------------------------------
# Prediction CSV helper
# ---------------------------------------------------------------------------

def save_predictions_csv(
    preds,
    labels: torch.Tensor,
    target_names: list,
    task: str,
    out_path: Path,
) -> None:
    """
    Write per-sample predictions and ground-truth labels to *out_path*.

    Columns for regression  : ``{target}_pred``, ``{target}_true``
    Columns for classification: ``{target}_pred_class``, ``{target}_true_class``
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    rows: dict = {}

    if task == "regression":
        for i, t in enumerate(target_names):
            rows[f"{t}_pred"] = preds[:, i].numpy()
            rows[f"{t}_true"] = labels[:, i].numpy()
    else:
        for i, t in enumerate(target_names):
            rows[f"{t}_pred_class"] = preds[i].argmax(dim=1).numpy()
            rows[f"{t}_true_class"] = labels[:, i].numpy()

    pd.DataFrame(rows).to_csv(out_path, index=False)
    log.info(f"Predictions saved → {out_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(checkpoint_path: Path, cfg: ExperimentConfig, save_preds: Path | None):
    set_seed(cfg.data.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # --- Data (reproduce the same split as training) ---
    _, val_loader, test_loader = build_dataloaders(cfg)
    loader = test_loader  # evaluate on the held-out test set

    # --- Model ---
    model = build_model(cfg).to(device)
    ckpt = torch.load(checkpoint_path, map_location=device)

    # Handle checkpoints saved from the old single-model format
    state_key = "model_state" if "model_state" in ckpt else "state_dict"
    model.load_state_dict(ckpt[state_key])

    epoch_info = ckpt.get("epoch", "?")
    val_loss   = ckpt.get("val_loss", float("nan"))
    log.info(
        f"Loaded checkpoint: epoch={epoch_info}  val_loss={val_loss:.4f}"
        f"  path={checkpoint_path}"
    )

    # --- Inference ---
    preds, labels = run_inference(
        model, loader, device, cfg.data.task, len(cfg.data.targets)
    )

    # --- Metrics ---
    if cfg.data.task == "regression":
        report = regression_report(preds, labels.float(), cfg.data.targets)
        log.info("\n" + format_regression_table(report))
    else:
        report = classification_report(preds, labels, cfg.data.targets)
        log.info("\n" + format_classification_table(report))

    # --- Optionally save preds ---
    if save_preds:
        save_predictions_csv(preds, labels, cfg.data.targets, cfg.data.task, save_preds)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate a SoilScan checkpoint")
    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="YAML experiment config (must match the one used during training)",
    )
    parser.add_argument(
        "--checkpoint",
        type=str,
        default=None,
        help="Path to .pt checkpoint (defaults to checkpoints/{name}_best.pt)",
    )
    parser.add_argument(
        "--save-preds",
        type=str,
        default=None,
        dest="save_preds",
        help="If set, write per-sample predictions to this CSV path",
    )
    args = parser.parse_args()

    cfg = get_config(args.config)

    ckpt_path = (
        Path(args.checkpoint)
        if args.checkpoint
        else cfg.paths.checkpoint_dir / f"{cfg.name}_best.pt"
    )

    save_path = Path(args.save_preds) if args.save_preds else None

    main(ckpt_path, cfg, save_path)
