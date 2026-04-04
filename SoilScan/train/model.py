"""
Model registry for SoilScan.

Supported backbones
-------------------
resnet50        ResNet-50 (torchvision, ImageNet-1k V2)
efficientnet_b4 EfficientNet-B4 (timm)
convnext_tiny   ConvNeXt-Tiny (timm)
vit_b16         Vision Transformer ViT-B/16 (timm)

Two task heads are supported:

  regression      One shared Linear head → (batch, num_targets).
  classification  One Linear head *per target* → list of (batch, num_classes)
                  logits. This enables per-nutrient loss weighting and allows
                  each nutrient to have a different number of classes.

Usage
-----
  from config import get_config
  from model import build_model

  cfg = get_config()
  model = build_model(cfg)
"""

from __future__ import annotations

import torch
import torch.nn as nn
from torchvision import models

from config import ExperimentConfig


# ---------------------------------------------------------------------------
# Public factory
# ---------------------------------------------------------------------------

def build_model(cfg: ExperimentConfig) -> nn.Module:
    """
    Instantiate the appropriate model based on ``cfg.model.backbone`` and
    ``cfg.data.task``.

    Parameters
    ----------
    cfg : ExperimentConfig
        Full experiment configuration.

    Returns
    -------
    nn.Module
        A ``SoilRegressionModel`` or ``SoilClassificationModel``.
    """
    num_targets = len(cfg.data.targets)
    backbone_name = cfg.model.backbone
    pretrained = cfg.model.pretrained
    dropout = cfg.model.dropout

    encoder, feature_dim = _build_encoder(backbone_name, pretrained)

    if cfg.data.task == "regression":
        return SoilRegressionModel(encoder, feature_dim, num_targets, dropout)
    elif cfg.data.task == "classification":
        return SoilClassificationModel(
            encoder, feature_dim, num_targets, cfg.model.num_classes, dropout
        )
    else:
        raise ValueError(f"Unknown task: '{cfg.data.task}'")


# ---------------------------------------------------------------------------
# Encoders
# ---------------------------------------------------------------------------

def _build_encoder(backbone_name: str, pretrained: bool) -> tuple[nn.Module, int]:
    """
    Return (encoder, feature_dim) for the requested backbone.

    The encoder is the full backbone with its original classification head
    replaced by nn.Identity(), so it outputs a raw feature vector.
    """
    if backbone_name == "resnet50":
        weights = models.ResNet50_Weights.IMAGENET1K_V2 if pretrained else None
        net = models.resnet50(weights=weights)
        feature_dim = net.fc.in_features
        net.fc = nn.Identity()
        return net, feature_dim

    # timm-backed models
    try:
        import timm
    except ImportError as exc:
        raise ImportError(
            "timm is required for EfficientNet / ConvNeXt / ViT backbones. "
            "Install it with:  pip install timm"
        ) from exc

    timm_names = {
        "efficientnet_b4": "efficientnet_b4",
        "convnext_tiny": "convnext_tiny",
        "vit_b16": "vit_base_patch16_224",
    }
    if backbone_name not in timm_names:
        raise ValueError(
            f"Unknown backbone '{backbone_name}'. "
            f"Choose from: {list(timm_names) + ['resnet50']}"
        )

    net = timm.create_model(
        timm_names[backbone_name],
        pretrained=pretrained,
        num_classes=0,    # remove the classifier head → raw features
    )
    feature_dim = net.num_features
    return net, feature_dim


# ---------------------------------------------------------------------------
# Task heads
# ---------------------------------------------------------------------------

class SoilRegressionModel(nn.Module):
    """
    Encoder + single linear regression head.

    Output
    ------
    Tensor of shape (batch, num_targets) — one continuous value per nutrient.
    """

    def __init__(
        self,
        encoder: nn.Module,
        feature_dim: int,
        num_targets: int,
        dropout: float = 0.3,
    ):
        super().__init__()
        self.encoder = encoder
        self.head = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(feature_dim, num_targets),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        features = self.encoder(x)
        return self.head(features)


class SoilClassificationModel(nn.Module):
    """
    Encoder + one independent classification head per nutrient target.

    Each head predicts ``num_classes`` logits (e.g. Low / Medium / High).

    Output
    ------
    List of Tensors, each of shape (batch, num_classes) — one per target.
    The list order matches ``cfg.data.targets``.
    """

    def __init__(
        self,
        encoder: nn.Module,
        feature_dim: int,
        num_targets: int,
        num_classes: int,
        dropout: float = 0.3,
    ):
        super().__init__()
        self.encoder = encoder
        self.heads = nn.ModuleList([
            nn.Sequential(
                nn.Dropout(dropout),
                nn.Linear(feature_dim, num_classes),
            )
            for _ in range(num_targets)
        ])

    def forward(self, x: torch.Tensor) -> list[torch.Tensor]:
        features = self.encoder(x)
        return [head(features) for head in self.heads]


# ---------------------------------------------------------------------------
# Quick smoke-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    from config import get_config

    for backbone in ("resnet50", "efficientnet_b4", "convnext_tiny", "vit_b16"):
        for task in ("regression", "classification"):
            cfg = get_config()
            cfg.model.backbone = backbone
            cfg.data.task = task
            cfg.model.pretrained = False  # skip download in smoke-test
            try:
                m = build_model(cfg)
                dummy = torch.randn(2, 3, 224, 224)
                out = m(dummy)
                if isinstance(out, list):
                    shape_str = str([o.shape for o in out])
                else:
                    shape_str = str(out.shape)
                print(f"[OK] {backbone:<20} {task:<15} output={shape_str}")
            except Exception as exc:
                print(f"[FAIL] {backbone:<20} {task:<15} {exc}")
