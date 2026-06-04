"""
17x17 pairwise similarity matrix between NPK combination groups.

For each combination present in the test set, computes the mean cosine
similarity between its embedding cloud and every other combination's
embedding cloud. Combinations with high inter-group similarity are
visually indistinguishable to the encoder and are candidates for merging.

Usage
-----
  python train/combo_similarity.py \
      --checkpoint checkpoints/baseline_resnet50_20260407_212414/best.pt \
      --config experiments/baseline_resnet50.yaml
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from itertools import combinations

import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import get_config
from dataset import (
    UUID_RE, SoilDataset, _eval_transform,
    collect_samples, load_label_map, uuid_aware_split,
)
from model import build_model

LABELS = {0: "Low", 1: "Med", 2: "High"}
MERGE_THRESHOLD = 0.45   # combinations with mean sim >= this are merge candidates


def _one_per_uuid(samples):
    seen = {}
    for path, label in sorted(samples, key=lambda s: s[0].name):
        m = UUID_RE.search(Path(path).name)
        uid = m.group(1) if m else str(path)
        if uid not in seen:
            seen[uid] = (path, label)
    return list(seen.values())


@torch.no_grad()
def extract_embeddings(model, samples, img_size, batch_size, device):
    dataset = SoilDataset(samples, transform=_eval_transform(img_size), task="classification")
    loader  = DataLoader(dataset, batch_size=batch_size, shuffle=False, num_workers=0)
    embs, lbls = [], []
    for imgs, labels in tqdm(loader, desc="Extracting embeddings", unit="batch"):
        e = F.normalize(model.encoder(imgs.to(device)), p=2, dim=1)
        embs.append(e.cpu())
        lbls.append(labels.cpu())
    return torch.cat(embs).numpy(), torch.cat(lbls).numpy()


def combo_label(n, p, k):
    return f"N={LABELS[n]}\nP={LABELS[p]}\nK={LABELS[k]}"

def combo_label_short(n, p, k):
    return f"{LABELS[n][0]}{LABELS[p][0]}{LABELS[k][0]}"   # e.g. LLH, LMH


def build_combo_matrix(embeddings, labels, target_names):
    """
    Returns:
        combo_keys  : list of (n, p, k) tuples present in the data
        combo_counts: number of samples per combo
        sim_matrix  : (C, C) mean cosine similarity between combo embedding clouds
        std_matrix  : (C, C) std of pairwise similarities between combo clouds
    """
    n_idx = target_names.index("n")
    p_idx = target_names.index("p")
    k_idx = target_names.index("k")

    # Group embeddings by combination
    combo_map: dict[tuple, list] = {}
    for i, emb in enumerate(embeddings):
        key = (int(labels[i, n_idx]), int(labels[i, p_idx]), int(labels[i, k_idx]))
        combo_map.setdefault(key, []).append(emb)

    combo_keys   = sorted(combo_map.keys())
    combo_counts = [len(combo_map[k]) for k in combo_keys]
    C = len(combo_keys)

    sim_matrix = np.zeros((C, C))
    std_matrix = np.zeros((C, C))

    for i, ki in enumerate(combo_keys):
        ei = np.stack(combo_map[ki])          # (Ni, D)
        for j, kj in enumerate(combo_keys):
            ej = np.stack(combo_map[kj])      # (Nj, D)
            # pairwise cosine sim between all pairs across the two groups
            sims = (ei @ ej.T).flatten()      # already L2-normalised
            if i == j:
                # intra: upper triangle only
                sq = ei @ ei.T
                idx = np.triu_indices(len(ei), k=1)
                sims = sq[idx]
            sim_matrix[i, j] = sims.mean()
            std_matrix[i, j] = sims.std()

    return combo_keys, combo_counts, sim_matrix, std_matrix


def plot_combo_matrix(combo_keys, combo_counts, sim_matrix, out_path, threshold=MERGE_THRESHOLD):
    C = len(combo_keys)
    tick_labels = [
        f"{combo_label_short(*k)}\n(n={combo_counts[i]})"
        for i, k in enumerate(combo_keys)
    ]

    fig, ax = plt.subplots(figsize=(max(10, C * 0.75), max(9, C * 0.7)))
    im = ax.imshow(sim_matrix, cmap="RdYlGn", vmin=0.0, vmax=0.8, aspect="auto")
    plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04, label="Mean cosine similarity")

    ax.set_xticks(range(C))
    ax.set_yticks(range(C))
    ax.set_xticklabels(tick_labels, fontsize=7, rotation=45, ha="right")
    ax.set_yticklabels(tick_labels, fontsize=7)

    # Annotate each cell with the mean value
    for i in range(C):
        for j in range(C):
            val = sim_matrix[i, j]
            color = "black" if val < 0.6 else "white"
            ax.text(j, i, f"{val:.2f}", ha="center", va="center",
                    fontsize=6.5, color=color)

    # Highlight merge candidates (off-diagonal cells above threshold)
    for i in range(C):
        for j in range(C):
            if i != j and sim_matrix[i, j] >= threshold:
                ax.add_patch(plt.Rectangle(
                    (j - 0.5, i - 0.5), 1, 1,
                    fill=False, edgecolor="blue", linewidth=2.0
                ))

    ax.set_title(
        f"NPK combination pairwise similarity  ({C} combinations, test set)\n"
        f"Blue border = merge candidate (mean sim >= {threshold})",
        fontsize=11, pad=12,
    )
    plt.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"Saved  -> {out_path}")


def print_merge_candidates(combo_keys, combo_counts, sim_matrix, std_matrix, threshold=MERGE_THRESHOLD):
    C = len(combo_keys)
    print("\n-- Merge candidates (mean inter-group sim >= threshold) ---------")
    print(f"  Threshold: {threshold}")
    print()
    print(f"  {'Combo A':<14} {'Combo B':<14}  {'Mean':>6}  {'Std':>6}  {'nA':>4}  {'nB':>4}")
    print(f"  {'-'*56}")

    found = False
    pairs = []
    for i in range(C):
        for j in range(i + 1, C):
            if sim_matrix[i, j] >= threshold:
                ki, kj = combo_keys[i], combo_keys[j]
                pairs.append((sim_matrix[i, j], i, j))

    pairs.sort(reverse=True)

    for mean_sim, i, j in pairs:
        ki, kj = combo_keys[i], combo_keys[j]
        a = f"N={LABELS[ki[0]]},P={LABELS[ki[1]]},K={LABELS[ki[2]]}"
        b = f"N={LABELS[kj[0]]},P={LABELS[kj[1]]},K={LABELS[kj[2]]}"
        print(
            f"  {a:<14} {b:<14}  {mean_sim:>6.3f}  "
            f"{std_matrix[i,j]:>6.3f}  {combo_counts[i]:>4}  {combo_counts[j]:>4}"
        )
        found = True

    if not found:
        print(f"  None found above threshold {threshold}.")

    print()
    print("-- Most DISTINGUISHABLE pairs (lowest inter-group sim) ----------")
    print()
    bottom = []
    for i in range(C):
        for j in range(i + 1, C):
            bottom.append((sim_matrix[i, j], i, j))
    bottom.sort()
    for mean_sim, i, j in bottom[:5]:
        ki, kj = combo_keys[i], combo_keys[j]
        a = f"N={LABELS[ki[0]]},P={LABELS[ki[1]]},K={LABELS[ki[2]]}"
        b = f"N={LABELS[kj[0]]},P={LABELS[kj[1]]},K={LABELS[kj[2]]}"
        print(
            f"  {a:<14} {b:<14}  mean={mean_sim:.3f}  "
            f"std={std_matrix[i,j]:.3f}  "
            f"nA={combo_counts[i]}  nB={combo_counts[j]}"
        )
    print()


def main():
    parser = argparse.ArgumentParser(description="NPK combination similarity matrix")
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--config",     default=None)
    parser.add_argument("--split",      default="test", choices=["train","val","test"])
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--threshold",  type=float, default=MERGE_THRESHOLD,
                        help=f"Merge candidate threshold (default {MERGE_THRESHOLD})")
    parser.add_argument("--output",     default=None)
    args = parser.parse_args()

    threshold = args.threshold
    cfg    = get_config(args.config)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    model = build_model(cfg).to(device)
    ckpt  = torch.load(args.checkpoint, map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model_state" if "model_state" in ckpt else "state_dict"])
    model.eval()

    label_map   = load_label_map(cfg.paths.datamap_csv, cfg.data.targets)
    all_samples = collect_samples(cfg.paths.data_dir, label_map)
    train_s, val_s, test_s = uuid_aware_split(
        all_samples, cfg.data.val_split, cfg.data.test_split, cfg.data.seed
    )
    samples = _one_per_uuid({"train": train_s, "val": val_s, "test": test_s}[args.split])
    print(f"Unique UUIDs ({args.split}): {len(samples)}")

    embeddings, labels = extract_embeddings(
        model, samples, cfg.data.img_size, args.batch_size, device
    )

    combo_keys, combo_counts, sim_matrix, std_matrix = build_combo_matrix(
        embeddings, labels, cfg.data.targets
    )

    print(f"\nCombinations found in {args.split} split: {len(combo_keys)}")
    for i, k in enumerate(combo_keys):
        print(f"  N={LABELS[k[0]]:<5} P={LABELS[k[1]]:<5} K={LABELS[k[2]]:<5}  n={combo_counts[i]}")

    print_merge_candidates(combo_keys, combo_counts, sim_matrix, std_matrix, threshold)

    out_path = Path(args.output) if args.output else Path("results/similarity/combo_similarity.png")
    plot_combo_matrix(combo_keys, combo_counts, sim_matrix, out_path, threshold)


if __name__ == "__main__":
    main()
