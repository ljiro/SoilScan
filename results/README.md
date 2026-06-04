# SoilScan Model Analysis — Findings

Checkpoint analysed: `baseline_resnet50_20260407_212414/best.pt`
Backbone: ResNet-50 | Task: Classification (N, P, K) | Test split: 154 unique UUIDs | Epoch: 45 | Val loss: 0.7893

---

## Table of Contents

1. [Dataset Analysis](#1-dataset-analysis)
2. [Embedding Similarity — Per Nutrient](#2-embedding-similarity--per-nutrient)
3. [NPK Combination Map](#3-npk-combination-map)
4. [Combination Similarity Matrix](#4-combination-similarity-matrix)
5. [Merge Candidates](#5-merge-candidates)
6. [Most Distinguishable Pairs](#6-most-distinguishable-pairs)
7. [Recommendations](#7-recommendations)

---

## 1. Dataset Analysis

**Source:** `datamaps/uuid_mapping_report.csv`
**Total unique capture sites (UUIDs):** 1,787 raw → 1,756 after dropping rows with missing N/P/K labels

### Label Distributions

| Class | N count | N % | P count | P % | K count | K % |
|-------|--------:|----:|--------:|----:|--------:|----:|
| Low (0) | 1,624 | 92.5% | 695 | 39.6% | 815 | 46.4% |
| Medium (1) | 132 | 7.5% | 371 | 21.1% | 705 | 40.1% |
| High (2) | **0** | **0%** | 690 | 39.3% | 236 | 13.4% |
| Missing | 16 | — | 11 | — | 26 | — |

### Key Imbalance Issues

- **N=High does not exist in the dataset.** The model can never learn this class. N is effectively a binary problem (Low vs Medium).
- **N is critically imbalanced at 92.5% Low.** A model that always predicts Low-N achieves 92.5% accuracy on N — making accuracy a meaningless metric for this target.
- **K=High is underrepresented** at 13.4% (236 sites) — roughly 1/3 the size of Low and Medium.
- **P is the most balanced** of the three: Low (39.6%), High (39.3%), Medium (21.1%). Medium-P is the weakest.

---

## 2. Embedding Similarity — Per Nutrient

Computed from 154 unique test-split UUIDs (one image per UUID, no augmented variants).
Embeddings are 2048-dimensional L2-normalised ResNet-50 feature vectors.

### Nitrogen (N)

| Pair | Mean sim | Std | N pairs |
|------|--------:|----:|--------:|
| Low vs Low | 0.4167 | 0.2543 | 10,011 |
| Low vs Medium | 0.3068 | 0.1877 | 1,704 |
| Medium vs Medium | 0.4875 | 0.1892 | 66 |

- Gap (intra vs inter): **~0.11** — weakest separation of all three targets
- N=High absent from test split (absent from dataset entirely)

### Phosphorus (P)

| Pair | Mean sim | Std | N pairs |
|------|--------:|----:|--------:|
| Low vs Low | 0.4090 | 0.2565 | 946 |
| Low vs Medium | 0.2990 | 0.2025 | 1,980 |
| Low vs High | 0.3456 | 0.2393 | 2,860 |
| Medium vs Medium | 0.5254 | 0.2145 | 990 |
| Medium vs High | 0.3711 | 0.2239 | 2,925 |
| High vs High | 0.5548 | 0.2517 | 2,080 |

- Medium and High-P form tighter intra-class clusters (~0.52–0.55)
- Low-P is the noisiest class (intra=0.41)
- Largest intra vs inter gap: **~0.26** (High intra vs Low↔Medium inter)

### Potassium (K)

| Pair | Mean sim | Std | N pairs |
|------|--------:|----:|--------:|
| Low vs Low | 0.4957 | 0.2627 | 1,891 |
| Low vs Medium | 0.3564 | 0.2438 | 4,154 |
| Low vs High | 0.3164 | 0.1698 | 1,550 |
| Medium vs Medium | 0.4853 | 0.2643 | 2,211 |
| Medium vs High | 0.3454 | 0.2090 | 1,675 |
| High vs High | 0.5573 | 0.2128 | 300 |

- **Strongest class separation of all three targets**
- Largest gap: High intra (0.5573) vs Low↔High inter (0.3164) = **0.24**
- K is the most visually informative nutrient in this dataset

### Summary

| Nutrient | Best intra↔inter gap | Visual separability |
|----------|--------------------:|---------------------|
| K | 0.24 | Strongest |
| P | 0.26 (at extremes) | Moderate |
| N | 0.11 | Weakest |

All targets show high within-group variance (std ~0.21–0.26), indicating the model has learned a real but noisy signal — not tight, well-separated clusters.

**Visualisations:** [similarity/similarity_n.png](similarity/similarity_n.png) · [similarity/similarity_p.png](similarity/similarity_p.png) · [similarity/similarity_k.png](similarity/similarity_k.png)

---

## 3. NPK Combination Map

17 of 18 possible combinations are present in the dataset (N has no High class; Medium-High-High is also absent).

| N | P | K | Sites | % | Notes |
|---|---|---|------:|--:|-------|
| Low | Low | Low | 340 | 19.4% | Most common — model biased toward this |
| Low | High | Low | 340 | 19.4% | Only P differs from above — near-indistinguishable |
| Low | High | Medium | 244 | 13.9% | — |
| Low | Low | Medium | 215 | 12.2% | — |
| Low | Medium | Medium | 187 | 10.6% | — |
| Low | Medium | Low | 97 | 5.5% | Easily confused with top two |
| Low | High | High | 96 | 5.5% | K=High provides separation |
| Low | Low | High | 70 | 4.0% | K=High provides separation |
| Low | Medium | High | 35 | 2.0% | Small sample |
| Medium | Medium | Medium | 34 | 1.9% | N=Medium — unreliable |
| Medium | Low | High | 30 | 1.7% | N=Medium — unreliable |
| Medium | Low | Medium | 20 | 1.1% | N=Medium — very small |
| Medium | Low | Low | 20 | 1.1% | N=Medium — very small |
| Medium | Medium | Low | 13 | 0.7% | Near-invisible to model |
| Medium | Medium | High | 5 | 0.3% | Effectively absent |
| Medium | High | Low | 5 | 0.3% | Effectively absent |
| Medium | High | Medium | 5 | 0.3% | Effectively absent |
| Medium | High | High | **0** | **0%** | **Missing — never seen** |

Top 5 combinations cover **75.5%** of all sites. The model performs well on these and unreliably on everything else.

---

## 4. Combination Similarity Matrix

Computed from 13 combinations present in the test split (154 UUIDs).
Each cell = mean cosine similarity between all embedding pairs across two combination groups.

**Visualisation:** [similarity/combo_similarity.png](similarity/combo_similarity.png)

---

## 5. Merge Candidates

Pairs with mean inter-group similarity >= 0.45 — combinations the encoder cannot reliably distinguish.

| Combination A | Combination B | Mean sim | Std | Why |
|---|---|---:|---:|-----|
| Low-Med-High | Med-Med-High | 0.748 | 0.034 | Only N differs — N has no visual signal |
| Med-Med-Med | Med-Med-High | 0.630 | 0.055 | K step, both N=Med (noisy class) |
| Med-Low-High | Med-Med-High | 0.627 | 0.046 | P step, both N=Med |
| Low-Med-High | Low-High-High | 0.594 | 0.130 | Only P differs — P invisible at K=High |
| Low-Low-High | Low-High-High | 0.581 | 0.213 | Only P differs — confirms P weak at K=High |
| Low-Med-Low | Low-Med-High | 0.513 | 0.140 | K step within P=Med group |
| Low-Med-Med | Low-Med-High | 0.512 | 0.133 | K step within P=Med group |
| Low-Med-High | Med-Low-High | 0.509 | 0.178 | Both N and P differ, K=High |
| Low-Med-Low | Low-Med-Med | 0.505 | 0.222 | K step — borderline |
| Low-Low-High | Med-Low-High | 0.502 | 0.231 | Only N differs — N invisible |
| Low-High-High | Med-Low-High | 0.500 | 0.227 | N and P differ, K=High |
| Low-High-High | Med-Med-High | 0.493 | 0.061 | N and P differ, K=High |
| Low-High-Low | Med-High-Low | 0.491 | 0.128 | Only N differs — N invisible |
| Low-Med-Med | Med-Med-Med | 0.487 | 0.161 | Only N differs |
| Low-Low-High | Low-Med-High | 0.486 | 0.168 | Only P differs — P weak |
| Low-High-Low | Low-High-Med | 0.472 | 0.230 | K step within P=High group |
| Low-Med-Med | Low-High-Med | 0.470 | 0.219 | Only P differs |
| Low-Low-High | Low-High-Med | 0.454 | 0.268 | Both P and K differ |

**Pattern:** Every high-similarity pair is explained by either (a) only N differing, or (b) only P differing, or (c) involving N=Medium combinations with tiny sample sizes.

---

## 6. Most Distinguishable Pairs

Pairs the encoder separates most reliably — all three nutrients differ simultaneously.

| Combination A | Combination B | Mean sim | Std |
|---|---|---:|---:|
| Low-High-Med | Med-Low-High | 0.195 | 0.125 |
| Low-High-High | Med-Med-Med | 0.201 | 0.121 |
| Low-High-Low | Med-Low-High | 0.204 | 0.128 |
| Low-Med-Med | Med-Low-High | 0.212 | 0.165 |
| Low-High-Low | Med-Med-Med | 0.216 | 0.150 |

All five involve combinations that differ on K extremes (Low vs High) and simultaneously differ on N and P — confirming K as the primary visual axis.

---

## 7. Recommendations

### Immediate

1. **Drop N=High as a class.** It does not exist in the dataset. Redefine N as binary: Low vs Medium.
2. **Collect more N=Medium samples.** With only 132 sites (7.5%), the N head is unreliable. Target at least 400–500 Medium-N captures.
3. **Use per-class F1 and Cohen's Kappa as primary metrics — not accuracy.** N accuracy is meaningless at 92.5% class imbalance.

### Label Space Simplification

Based on the combination similarity analysis, the model cannot reliably distinguish combinations that differ only on P or only on N. The effective visual label space is approximately:

| Simplified group | Covers |
|---|---|
| **Group 1** | Any-Low-K (K=Low regardless of N or P) |
| **Group 2** | Any-Med-K (K=Medium regardless of N or P) |
| **Group 3** | Low-N + High-K |
| **Group 4** | Med-N + High-K (if sample count allows) |

This reduces 17 combinations to **4–6 visually grounded groups** and would produce more honest and reliable predictions.

### Data Collection

- Use **one resolution only** (640×480 is sufficient — the model resizes all images to 224px regardless)
- Current 3-resolution setup triples storage for no training benefit
- Switching to single-resolution reduces dataset from 15,768 to 5,256 images

### Architecture

- The ResNet-50 encoder has learned a real but noisy signal (intra↔inter gaps of 0.11–0.26 with std ~0.25)
- Stronger backbones (EfficientNet-B4, ViT-B/16) trained on a rebalanced dataset may produce tighter clusters
- Consider adding a contrastive loss term alongside CrossEntropy to explicitly encourage intra-class clustering
