"""
Quick smoke test — verifies the full pipeline (data → model → train step →
eval step → metrics) using only 5 batches per phase.

Run this to confirm everything wires together before launching a full training run.

Usage:
    python train/smoke_test.py
    python train/smoke_test.py --config experiments/efficientnet_b4.yaml
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import get_config
from dataset import build_dataloaders
from metrics import classification_report, format_classification_table, regression_report, format_regression_table
from model import build_model
from train import build_criterion, build_scheduler, set_seed, _compute_loss

MAX_BATCHES = 5  # only process this many batches per phase


def run(cfg):
    set_seed(cfg.data.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n[smoke] Device : {device}")
    print(f"[smoke] Backbone: {cfg.model.backbone}  Task: {cfg.data.task}\n")

    # --- Data ---
    train_loader, val_loader, test_loader = build_dataloaders(cfg)

    # --- Model ---
    model = build_model(cfg).to(device)
    criterion = build_criterion(cfg)
    optimizer = torch.optim.AdamW(model.parameters(), lr=cfg.train.lr)

    # --- Train phase (5 batches) ---
    print("[smoke] -- Train phase --")
    model.train()
    for i, (imgs, labels) in enumerate(train_loader):
        if i >= MAX_BATCHES:
            break
        imgs, labels = imgs.to(device), labels.to(device)
        optimizer.zero_grad()
        preds = model(imgs)
        loss = _compute_loss(preds, labels, criterion, cfg.data.task)
        loss.backward()
        optimizer.step()
        print(f"  batch {i+1}/{MAX_BATCHES}  loss={loss.item():.4f}")

    # --- Val phase (5 batches) ---
    print("\n[smoke] -- Val phase --")
    model.eval()
    all_preds, all_labels = [], []
    with torch.no_grad():
        for i, (imgs, labels) in enumerate(val_loader):
            if i >= MAX_BATCHES:
                break
            imgs = imgs.to(device)
            preds = model(imgs)
            if cfg.data.task == "regression":
                all_preds.append(preds.cpu())
            else:
                all_preds.append([p.cpu() for p in preds])
            all_labels.append(labels)

    all_labels_cat = torch.cat(all_labels)

    if cfg.data.task == "regression":
        all_preds_cat = torch.cat(all_preds)
        report = regression_report(all_preds_cat, all_labels_cat.float(), cfg.data.targets)
        print(format_regression_table(report))
    else:
        per_head = [
            torch.cat([b[i] for b in all_preds])
            for i in range(len(cfg.data.targets))
        ]
        report = classification_report(per_head, all_labels_cat, cfg.data.targets)
        print(format_classification_table(report))

    print("\n[smoke] PASSED — pipeline is functional.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=None)
    args = parser.parse_args()

    cfg = get_config(args.config)
    cfg.train.num_workers = 0   # safer for smoke test on any platform
    run(cfg)
