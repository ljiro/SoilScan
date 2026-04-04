"""
Run inference on a single image or a folder of images.

The script loads a saved checkpoint and predicts soil nutrient levels
(N, P, K and optionally pH) for each input image.

Usage
-----
  # single image
  python train/inference.py --image path/to/soil.jpg

  # folder of images (all .jpg / .png)
  python train/inference.py --folder path/to/images/ --save results/out.csv

  # specify a non-default experiment config or checkpoint
  python train/inference.py \\
      --image soil.jpg \\
      --config experiments/efficientnet_b4.yaml \\
      --checkpoint checkpoints/efficientnet_b4_best.pt
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import torch
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import get_config
from dataset import _eval_transform
from model import build_model

# ---------------------------------------------------------------------------
# Class labels for the classification task
# ---------------------------------------------------------------------------

CLASS_LABELS = {0: "Low", 1: "Medium", 2: "High"}


# ---------------------------------------------------------------------------
# Core predictor
# ---------------------------------------------------------------------------

class SoilPredictor:
    """
    Thin wrapper around a trained SoilScan model for single-image inference.

    Parameters
    ----------
    checkpoint_path : Path
        Path to a ``.pt`` checkpoint produced by ``train.py``.
    config_path : Path or None
        Path to the YAML experiment config used during training.
        Must match the checkpoint's architecture.
    device : str or None
        ``"cuda"``, ``"cpu"``, or ``None`` (auto-select).

    Examples
    --------
    >>> predictor = SoilPredictor("checkpoints/baseline_best.pt")
    >>> result = predictor.predict("field_photo.jpg")
    >>> print(result)
    {"n": "Low", "p": "Medium", "k": "Low"}
    """

    def __init__(
        self,
        checkpoint_path: str | Path,
        config_path: str | Path | None = None,
        device: str | None = None,
    ):
        self.cfg = get_config(config_path)

        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        self.model = build_model(self.cfg).to(self.device)
        ckpt = torch.load(checkpoint_path, map_location=self.device)
        state_key = "model_state" if "model_state" in ckpt else "state_dict"
        self.model.load_state_dict(ckpt[state_key])
        self.model.eval()

        self.transform = _eval_transform(self.cfg.data.img_size)
        self.targets = self.cfg.data.targets
        self.task = self.cfg.data.task

    @torch.no_grad()
    def predict(self, image_path: str | Path) -> dict:
        """
        Predict nutrient levels for a single image.

        Parameters
        ----------
        image_path : str or Path

        Returns
        -------
        dict
            For regression  : ``{target: float_value}``
            For classification: ``{target: "Low" | "Medium" | "High",
                                   target + "_confidence": float}``
        """
        img = Image.open(image_path).convert("RGB")
        tensor = self.transform(img).unsqueeze(0).to(self.device)

        preds = self.model(tensor)
        result: dict = {}

        if self.task == "regression":
            vals = preds.squeeze(0).cpu().tolist()
            for t, v in zip(self.targets, vals):
                result[t] = round(v, 4)
        else:
            for i, t in enumerate(self.targets):
                logits = preds[i].squeeze(0)
                probs  = torch.softmax(logits, dim=0)
                cls    = int(probs.argmax().item())
                conf   = float(probs[cls].item())
                result[t]                    = CLASS_LABELS[cls]
                result[f"{t}_confidence"]    = round(conf, 4)

        return result

    def predict_batch(self, image_paths: list) -> list[dict]:
        """Run :meth:`predict` on each path and return a list of result dicts."""
        return [self.predict(p) for p in image_paths]


# ---------------------------------------------------------------------------
# CLI helpers
# ---------------------------------------------------------------------------

def _collect_images(folder: Path) -> list[Path]:
    exts = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}
    return sorted(p for p in folder.rglob("*") if p.suffix.lower() in exts)


def main():
    parser = argparse.ArgumentParser(description="SoilScan inference")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--image",  type=str, help="Path to a single image")
    group.add_argument("--folder", type=str, help="Folder of images")

    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="YAML experiment config (must match training config)",
    )
    parser.add_argument(
        "--checkpoint",
        type=str,
        default=None,
        help="Path to .pt checkpoint (default: checkpoints/{name}_best.pt)",
    )
    parser.add_argument(
        "--save",
        type=str,
        default=None,
        help="Save predictions to this CSV path (folder mode only)",
    )
    args = parser.parse_args()

    cfg = get_config(args.config)
    ckpt_path = (
        Path(args.checkpoint)
        if args.checkpoint
        else cfg.paths.checkpoint_dir / f"{cfg.name}_best.pt"
    )

    predictor = SoilPredictor(
        checkpoint_path=ckpt_path,
        config_path=args.config,
    )

    if args.image:
        result = predictor.predict(args.image)
        print(f"\nImage: {args.image}")
        for k, v in result.items():
            print(f"  {k}: {v}")

    else:
        folder = Path(args.folder)
        images = _collect_images(folder)
        if not images:
            print(f"No images found in {folder}")
            sys.exit(1)

        print(f"Running inference on {len(images)} images...")
        results = predictor.predict_batch(images)

        import pandas as pd

        rows = [{"image": str(p), **r} for p, r in zip(images, results)]
        df = pd.DataFrame(rows)

        if args.save:
            out = Path(args.save)
            out.parent.mkdir(parents=True, exist_ok=True)
            df.to_csv(out, index=False)
            print(f"Saved → {out}")
        else:
            print(df.to_string(index=False))


if __name__ == "__main__":
    main()
