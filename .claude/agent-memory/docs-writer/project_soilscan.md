---
name: SoilScan project documentation context
description: Key documentation decisions, style conventions, and structural facts for the SoilScan deep learning project
type: project
---

SoilScan is a research-grade PyTorch pipeline predicting soil nutrients (N, P, K, pH) from field photos. Target audience is agricultural ML researchers.

**Why:** Guides README structure, tone, and coverage decisions for all future documentation work.

**How to apply:** Use formal academic/research tone. GitHub-flavored Markdown. No emojis. Tables for config keys, metrics, and backbones. Code blocks with language tags throughout.

Key facts:
- Python/PyTorch project; inline docs use Google-style docstrings
- Four backbone architectures: resnet50 (torchvision only), efficientnet_b4, convnext_tiny, vit_b16 (latter three require timm)
- Two task modes: classification (ordinal 0/1/2 = Low/Medium/High) and regression (continuous floats)
- Multi-head design for classification: one nn.Linear head per nutrient target, independent CrossEntropyLoss per head
- UUID-aware splitting is the critical data-leakage prevention mechanism — always explain it when documenting dataset or training
- Primary label file: datamaps/uuid_mapping_report.csv (uuid, ph, k, p, n columns)
- Checkpoint naming convention: checkpoints/{experiment_name}_best.pt
- TensorBoard logs go to runs/{experiment_name}/
- Dataset: ~15,768 augmented images from ~1,787 unique GPS sites in Cordillera region, Philippines (Atok, La Trinidad)
- Image filename format: {location}_{date}_{time}_{uuid8hex}_{augmentation}_{level}.png
