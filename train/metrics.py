"""
Centralised metrics for SoilScan experiments.

Regression metrics
------------------
  mae_per_target     Mean Absolute Error, one value per target.
  rmse_per_target    Root Mean Squared Error, one value per target.
  r2_per_target      Coefficient of determination R², one value per target.

Classification metrics
----------------------
  accuracy_per_target   Micro accuracy per target.
  f1_per_target         Macro F1-score per target (from scikit-learn).
  kappa_per_target      Cohen's Kappa per target (ordinal quality metric).

Both task types return a dict keyed by target name for easy logging.
"""

from __future__ import annotations

from typing import List

import numpy as np
import torch


# ---------------------------------------------------------------------------
# Regression
# ---------------------------------------------------------------------------

def mae_per_target(
    preds: torch.Tensor,
    labels: torch.Tensor,
    target_names: List[str],
) -> dict[str, float]:
    """
    Compute Mean Absolute Error for each target column.

    Parameters
    ----------
    preds : Tensor (N, T)
    labels : Tensor (N, T)
    target_names : list of str, length T

    Returns
    -------
    dict  {target_name: mae_value}
    """
    mae = (preds - labels).abs().mean(dim=0).tolist()
    return {t: v for t, v in zip(target_names, mae)}


def rmse_per_target(
    preds: torch.Tensor,
    labels: torch.Tensor,
    target_names: List[str],
) -> dict[str, float]:
    """Root Mean Squared Error per target."""
    rmse = ((preds - labels) ** 2).mean(dim=0).sqrt().tolist()
    return {t: v for t, v in zip(target_names, rmse)}


def r2_per_target(
    preds: torch.Tensor,
    labels: torch.Tensor,
    target_names: List[str],
) -> dict[str, float]:
    """
    Coefficient of determination R² per target.

    A small epsilon (1e-8) is added to the denominator to guard against
    zero-variance label columns.
    """
    ss_res = ((preds - labels) ** 2).sum(dim=0)
    ss_tot = ((labels - labels.mean(dim=0)) ** 2).sum(dim=0)
    r2 = (1 - ss_res / (ss_tot + 1e-8)).tolist()
    return {t: v for t, v in zip(target_names, r2)}


def regression_report(
    preds: torch.Tensor,
    labels: torch.Tensor,
    target_names: List[str],
) -> dict[str, dict[str, float]]:
    """
    Combine MAE, RMSE, and R² into one nested dict.

    Returns
    -------
    {
      "n": {"mae": …, "rmse": …, "r2": …},
      "p": {"mae": …, "rmse": …, "r2": …},
      …
    }
    """
    mae  = mae_per_target(preds, labels, target_names)
    rmse = rmse_per_target(preds, labels, target_names)
    r2   = r2_per_target(preds, labels, target_names)
    return {
        t: {"mae": mae[t], "rmse": rmse[t], "r2": r2[t]}
        for t in target_names
    }


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

def accuracy_per_target(
    preds_list: List[torch.Tensor],
    labels: torch.Tensor,
    target_names: List[str],
) -> dict[str, float]:
    """
    Top-1 accuracy per target.

    Parameters
    ----------
    preds_list : list of Tensor (N, C) — one per target.
    labels : Tensor (N, T) — integer class indices.
    target_names : list of str, length T.
    """
    result = {}
    for i, name in enumerate(target_names):
        pred_cls = preds_list[i].argmax(dim=1)
        acc = (pred_cls == labels[:, i]).float().mean().item()
        result[name] = acc
    return result


def f1_per_target(
    preds_list: List[torch.Tensor],
    labels: torch.Tensor,
    target_names: List[str],
    average: str = "macro",
) -> dict[str, float]:
    """
    Macro F1-score per target using scikit-learn.

    Parameters
    ----------
    average : str
        Averaging strategy passed to ``sklearn.metrics.f1_score``.
        'macro' treats each class equally regardless of support (recommended
        for imbalanced ordinal datasets).
    """
    from sklearn.metrics import f1_score  # lazy import to avoid hard dep

    result = {}
    for i, name in enumerate(target_names):
        pred_cls = preds_list[i].argmax(dim=1).numpy()
        true_cls = labels[:, i].numpy()
        result[name] = float(f1_score(true_cls, pred_cls, average=average,
                                      zero_division=0))
    return result


def kappa_per_target(
    preds_list: List[torch.Tensor],
    labels: torch.Tensor,
    target_names: List[str],
) -> dict[str, float]:
    """
    Cohen's Kappa per target using scikit-learn.

    Kappa > 0.8 is generally considered strong agreement; it penalises
    confusions proportionally to how far apart the classes are (ordinal
    interpretation is implicit for Low/Medium/High).
    """
    from sklearn.metrics import cohen_kappa_score

    result = {}
    for i, name in enumerate(target_names):
        pred_cls = preds_list[i].argmax(dim=1).numpy()
        true_cls = labels[:, i].numpy()
        # kappa is undefined when only one class is present
        if len(np.unique(true_cls)) < 2:
            result[name] = float("nan")
        else:
            result[name] = float(cohen_kappa_score(true_cls, pred_cls))
    return result


def classification_report(
    preds_list: List[torch.Tensor],
    labels: torch.Tensor,
    target_names: List[str],
) -> dict[str, dict[str, float]]:
    """
    Combine accuracy, macro-F1, and Cohen's Kappa into one nested dict.

    Returns
    -------
    {
      "n": {"accuracy": …, "f1": …, "kappa": …},
      …
    }
    """
    acc   = accuracy_per_target(preds_list, labels, target_names)
    f1    = f1_per_target(preds_list, labels, target_names)
    kappa = kappa_per_target(preds_list, labels, target_names)
    return {
        t: {"accuracy": acc[t], "f1": f1[t], "kappa": kappa[t]}
        for t in target_names
    }


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

def format_regression_table(report: dict[str, dict[str, float]]) -> str:
    """Pretty-print regression metrics as an ASCII table."""
    header = f"{'Target':<10}  {'MAE':>8}  {'RMSE':>8}  {'R²':>8}"
    sep = "-" * len(header)
    rows = [header, sep]
    for t, m in report.items():
        rows.append(
            f"{t.upper():<10}  {m['mae']:8.4f}  {m['rmse']:8.4f}  {m['r2']:8.4f}"
        )
    return "\n".join(rows)


def format_classification_table(report: dict[str, dict[str, float]]) -> str:
    """Pretty-print classification metrics as an ASCII table."""
    header = f"{'Target':<10}  {'Acc':>8}  {'F1':>8}  {'Kappa':>8}"
    sep = "-" * len(header)
    rows = [header, sep]
    for t, m in report.items():
        rows.append(
            f"{t.upper():<10}  {m['accuracy']:8.4f}  {m['f1']:8.4f}  {m['kappa']:8.4f}"
        )
    return "\n".join(rows)
