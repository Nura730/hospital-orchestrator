"""Inference API used by the CP-SAT optimizer.

Example:
    from src.training import predict, pressure
    from src.training.common import hourly_grid, load
    df, _ = pressure.build_features(hourly_grid(load("department_state", ["timestamp"]), ["department"]))
    preds = predict.predict("pressure_pressure_t4h", df)
"""
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd

from .common import MODELS, as_category_text


@lru_cache(maxsize=None)
def load_model(name):
    return joblib.load(MODELS / f"{name}.joblib")


def predict(name, frame: pd.DataFrame) -> np.ndarray:
    """Predict from a frame produced by the matching module's build_features()."""
    b = load_model(name)
    X = frame.copy()
    for c, values in b["categories"].items():
        X[c] = as_category_text(X[c]).astype(pd.CategoricalDtype(values))
    X = X[b["features"]]
    if b["task"] == "binary":
        return b["model"].predict_proba(X)[:, 1]
    p = b["model"].predict(X)
    return np.expm1(p) if b["target_transform"] == "log1p" else p
