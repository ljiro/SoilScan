"""
Pairwise cosine-similarity matrix over encoder embeddings of test-set images.

One image is sampled per unique UUID (deterministically — first alphabetically)
so the matrix reflects similarity between distinct field capture sites, not
between augmented variants of the same scene.

Images are sorted by a chosen nutrient target (default: first in config) so
intra-class and inter-class clustering patterns are immediately visible.

Usage
-----
  python train/similarity_matrix.py \\
      --checkpoint checkpoints/baseline_resnet50_20240315_103045/best.pt \\
      --config experiments/baseline_resnet50.yaml

  # Sort by phosphorus class:
  python train/similarity_matrix.py \\
      --checkpoint checkpoints/... \\
      --config experiments/baseline_resnet50.yaml \\
      --sort-by p

  # Use validation split, save to a custom path:
  python train/similarity_matrix.py \\
      --checkpoint checkpoints/... \\
      --config experiments/... \\
      --split val \\
      --output results/val_similarity_n.png
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import get_config
from dataset import (
    UUID_RE,
    SoilDataset,
    _eval_transform,
    collect_samples,
    load_label_map,
    uuid_aware_split,
)
from model import build_model

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CLASS_NAMES  = {0: "Low", 1: "Medium", 2: "High"}
CLASS_COLORS = {0: "#4575b4", 1: "#fdae61", 2: "#d73027"}   # blue / orange / red


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _one_per_uuid(samples: list) -> list:
    """
    Keep one (path, label) pair per unique UUID.

    Augmented variants of the same capture share a UUID and would produce
    trivially high similarity; this step removes that confound so every
    point in the matrix represents a unique field site.
    """
    seen: dict[str, tuple] = {}
    for path, label in sorted(samples, key=lambda s: s[0].name):
        m = UUID_RE.search(Path(path).name)
        uid = m.group(1) if m else str(path)
        if uid not in seen:
            seen[uid] = (path, label)
    return list(seen.values())


@torch.no_grad()
def extract_embeddings(
    model: torch.nn.Module,
    samples: list,
    img_size: int,
    batch_size: int,
    device: torch.device,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Forward-pass all samples through the encoder and return L2-normalised
    feature vectors.

    Returns
    -------
    embeddings : ndarray, shape (N, D)
    labels     : ndarray, shape (N, T)  — one column per target
    """
    dataset = SoilDataset(
        samples,
        transform=_eval_transform(img_size),
        task="classification",
    )
    loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=False,
    )

    all_embs: list[torch.Tensor]   = []
    all_labels: list[torch.Tensor] = []

    for imgs, lbls in tqdm(loader, desc="Extracting embeddings", unit="batch"):
        imgs = imgs.to(device)
        embs = model.encoder(imgs)
        embs = F.normalize(embs, p=2, dim=1)
        all_embs.append(embs.cpu())
        all_labels.append(lbls.cpu())

    return (
        torch.cat(all_embs).numpy(),    # (N, D)
        torch.cat(all_labels).numpy(),  # (N, T)
    )


def compute_similarity(embeddings: np.ndarray) -> np.ndarray:
    """Pairwise cosine similarity (L2-normalised dot product). Shape: (N, N)."""
    return (embeddings @ embeddings.T).clip(-1.0, 1.0)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

def print_stats(
    sim: np.ndarray,
    labels: np.ndarray,
    target_names: list[str],
) -> None:
    """Print mean intra-class and inter-class similarities for every target."""
    print("\n── Similarity statistics ───────────────────────────────────")
    for t_idx, t_name in enumerate(target_names):
        cls_labels = labels[:, t_idx].astype(int)
        print(f"\n  Target: {t_name.upper()}")
        print(f"  {'Pair':<22}  {'Mean':>7}  {'Std':>7}  {'N pairs':>8}")
        print(f"  {'-'*50}")
        for ci in range(3):
            for cj in range(ci, 3):
                idx_i = np.where(cls_labels == ci)[0]
                idx_j = np.where(cls_labels == cj)[0]
                if len(idx_i) == 0 or len(idx_j) == 0:
                    continue
                if ci == cj:
                    # upper triangle only — skip self-similarity diagonal
                    block = sim[np.ix_(idx_i, idx_i)]
                    vals  = block[np.triu_indices_from(block, k=1)]
                else:
                    vals = sim[np.ix_(idx_i, idx_j)].flatten()
                if len(vals) == 0:
                    continue
                label = f"{CLASS_NAMES[ci]} ↔ {CLASS_NAMES[cj]}"
                print(
                    f"  {label:<22}  {vals.mean():>7.4f}  {vals.std():>7.4f}"
                    f"  {len(vals):>8,}"
                )
    print()


# ---------------------------------------------------------------------------
# Plot
# ---------------------------------------------------------------------------

def plot_similarity_matrix(
    sim: np.ndarray,
    labels: np.ndarray,
    target_names: list[str],
    sort_by: str,
    out_path: Path,
) -> None:
    """
    Save a cosine-similarity heatmap sorted and annotated by nutrient class.

    Parameters
    ----------
    sim          : (N, N) similarity matrix
    labels       : (N, T) integer class labels
    target_names : list of target strings (e.g. ["n", "p", "k"])
    sort_by      : target name to sort rows/cols by
    out_path     : destination PNG file
    """
    t_idx = target_names.index(sort_by)
    cls_labels = labels[:, t_idx].astype(int)

    # Sort by class, then by secondary class stability
    order = np.argsort(cls_labels, kind="stable")
    sim_sorted    = sim[np.ix_(order, order)]
    sorted_labels = cls_labels[order]

    # Per-class counts and cumulative positions
    class_counts = [int((sorted_labels == c).sum()) for c in range(3)]
    cum_counts   = np.cumsum(class_counts)
    n = len(sorted_labels)

    # ── Figure ────────────────────────────────────────────────────────────
    fig_px  = max(480, min(1400, n * 4))
    fig_in  = fig_px / 100
    fig, ax = plt.subplots(figsize=(fig_in + 2.0, fig_in))

    im = ax.imshow(
        sim_sorted,
        aspect="auto",
        cmap="RdBu_r",
        vmin=-1,
        vmax=1,
        interpolation="nearest",
    )
    cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("Cosine similarity", fontsize=10)

    # Class boundary lines
    for pos in cum_counts[:-1]:
        if 0 < pos < n:
            ax.axhline(pos - 0.5, color="white", linewidth=1.5, linestyle="--", alpha=0.85)
            ax.axvline(pos - 0.5, color="white", linewidth=1.5, linestyle="--", alpha=0.85)

    # Coloured spans along the left edge for each class
    start = 0
    for cls_id, count in enumerate(class_counts):
        if count == 0:
            start += count
            continue
        # axes-coordinate span: imshow row 0 is at the TOP (y=1 in axes coords)
        ymax = 1.0 - start / n
        ymin = 1.0 - (start + count) / n
        ax.axhspan(
            start - 0.5, start + count - 0.5,
            xmin=-0.01, xmax=0.0,
            color=CLASS_COLORS[cls_id],
            clip_on=False,
            linewidth=0,
        )
        mid_axes_y = 1.0 - (start + count / 2) / n
        ax.text(
            -0.025, mid_axes_y,
            CLASS_NAMES[cls_id],
            ha="right", va="center",
            transform=ax.transAxes,
            fontsize=8,
            color=CLASS_COLORS[cls_id],
            fontweight="bold",
        )
        start += count

    # Axis labels and title
    ax.set_xlabel(
        f"Soil capture site  (sorted by {sort_by.upper()} class: Low → Medium → High)",
        fontsize=10,
    )
    ax.set_ylabel(
        f"Soil capture site  (sorted by {sort_by.upper()} class)",
        fontsize=10,
    )
    ax.set_title(
        f"Encoder embedding — pairwise cosine similarity\n"
        f"{n} unique captures · sorted by {sort_by.upper()} · "
        f"Low={class_counts[0]}  Medium={class_counts[1]}  High={class_counts[2]}",
        fontsize=11,
        pad=10,
    )
    ax.set_xticks([])
    ax.set_yticks([])

    # Legend
    legend_patches = [
        mpatches.Patch(color=CLASS_COLORS[c], label=f"{sort_by.upper()} = {CLASS_NAMES[c]}")
        for c in range(3)
        if class_counts[c] > 0
    ]
    ax.legend(
        handles=legend_patches,
        loc="upper right",
        bbox_to_anchor=(1.22, 1.0),
        framealpha=0.85,
        fontsize=9,
    )

    plt.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"Saved  → {out_path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Encoder embedding cosine-similarity matrix",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--checkpoint", required=True,
        help="Path to .pt checkpoint (e.g. checkpoints/baseline_resnet50_20240315_103045/best.pt)",
    )
    parser.add_argument(
        "--config", default=None,
        help="YAML experiment config — must match the checkpoint's architecture",
    )
    parser.add_argument(
        "--split", default="test", choices=["train", "val", "test"],
        help="Dataset split to extract embeddings from",
    )
    parser.add_argument(
        "--sort-by", default=None,
        help="Target name to sort the matrix by (default: first target in config)",
    )
    parser.add_argument(
        "--batch-size", type=int, default=32,
        help="Inference batch size",
    )
    parser.add_argument(
        "--output", default=None,
        help="Output PNG path (default: similarity_{sort_by}.png)",
    )
    args = parser.parse_args()

    cfg    = get_config(args.config)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device     : {device}")
    print(f"Checkpoint : {args.checkpoint}")
    print(f"Split      : {args.split}")

    # ── Model ────────────────────────────────────────────────────────────
    model = build_model(cfg).to(device)
    ckpt  = torch.load(args.checkpoint, map_location=device)
    key   = "model_state" if "model_state" in ckpt else "state_dict"
    model.load_state_dict(ckpt[key])
    model.eval()
    print(f"Backbone   : {cfg.model.backbone}")

    # ── Dataset split ────────────────────────────────────────────────────
    label_map   = load_label_map(cfg.paths.datamap_csv, cfg.data.targets)
    all_samples = collect_samples(cfg.paths.data_dir, label_map)
    train_s, val_s, test_s = uuid_aware_split(
        all_samples,
        val_fraction=cfg.data.val_split,
        test_fraction=cfg.data.test_split,
        seed=cfg.data.seed,
    )
    split_map = {"train": train_s, "val": val_s, "test": test_s}
    samples   = _one_per_uuid(split_map[args.split])
    print(f"Unique UUIDs in {args.split} split: {len(samples)}")

    # ── Sort-by target ───────────────────────────────────────────────────
    sort_by = args.sort_by or cfg.data.targets[0]
    if sort_by not in cfg.data.targets:
        parser.error(
            f"--sort-by '{sort_by}' not in configured targets {cfg.data.targets}"
        )

    # ── Embeddings ───────────────────────────────────────────────────────
    embeddings, labels = extract_embeddings(
        model, samples, cfg.data.img_size, args.batch_size, device
    )
    print(f"Embedding shape: {embeddings.shape}")

    # ── Similarity ───────────────────────────────────────────────────────
    sim = compute_similarity(embeddings)

    # ── Stats ────────────────────────────────────────────────────────────
    print_stats(sim, labels, cfg.data.targets)

    # ── Plot ─────────────────────────────────────────────────────────────
    out_path = Path(args.output) if args.output else Path(f"similarity_{sort_by}.png")
    plot_similarity_matrix(sim, labels, cfg.data.targets, sort_by, out_path)


if __name__ == "__main__":
    main()
