"""Shared helpers for Medi-Orchestrator model training."""
import json
from pathlib import Path

import joblib
import lightgbm as lgb
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    average_precision_score,
    mean_absolute_error,
    mean_squared_error,
    precision_recall_curve,
    r2_score,
    roc_auc_score,
)

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
MODELS = ROOT / "models"
REPORTS = ROOT / "reports"
FIGURES = REPORTS / "figures"
SEED = 42
np.random.seed(SEED)


# --------------------------------------------------------------------------- data
def load(name, dates=(), usecols=None):
    df = pd.read_csv(DATA / f"{name}.csv", usecols=usecols)
    for c in dates:
        if c in df.columns:
            df[c] = pd.to_datetime(df[c], errors="coerce")
    return df


def hourly_grid(df, keys, time_col="timestamp", cols=None, ffill_limit=2):
    """Aggregate to one row per (keys, hour) on a complete hourly grid.

    `_obs` marks hours that were really observed (not forward-filled), so
    targets are only taken from genuine observations.
    """
    df = df.copy()
    df[time_col] = df[time_col].dt.floor("h")
    if cols is not None:
        num = [c for c in cols if c in df.columns and c not in keys and c != time_col]
    else:
        num = [c for c in df.select_dtypes("number").columns if c not in keys]
    g = df.groupby(keys + [time_col])[num].mean().reset_index()
    g["_obs"] = 1
    out = []
    for k, d in g.groupby(keys):
        k = k if isinstance(k, tuple) else (k,)
        idx = pd.date_range(d[time_col].min(), d[time_col].max(), freq="h")
        d = d.set_index(time_col).reindex(idx)
        d[num] = d[num].ffill(limit=ffill_limit)
        d["_obs"] = d["_obs"].fillna(0).astype(int)
        for kk, vv in zip(keys, k):
            d[kk] = vv
        out.append(d.rename_axis(time_col).reset_index())
    return pd.concat(out, ignore_index=True)


def add_calendar(df, col, prefix=""):
    df[f"{prefix}hour"] = df[col].dt.hour
    df[f"{prefix}day_of_week"] = df[col].dt.dayofweek
    df[f"{prefix}is_weekend"] = (df[col].dt.dayofweek >= 5).astype(int)
    return df


def time_split(df, time_col, val=0.15, test=0.15, group_key=None):
    """Chronological 70/15/15 split (no shuffling).

    With `group_key`, every row of an entity goes to the same split, ordered by the
    entity's first timestamp (prevents near-copies leaking across splits).
    """
    df = df.dropna(subset=[time_col]).sort_values(time_col).reset_index(drop=True)
    order = df.groupby(group_key)[time_col].transform("min") if group_key else df[time_col]
    ranked = order.sort_values(kind="stable")
    n = len(df)
    t1 = ranked.iloc[int(n * (1 - val - test))]
    t2 = ranked.iloc[int(n * (1 - test))]
    return (
        df[order < t1].copy(),
        df[(order >= t1) & (order < t2)].copy(),
        df[order >= t2].copy(),
    )


def encode_categories(frames, cats):
    """Category dtypes fitted on the train frame (unseen values become NaN)."""
    mapping = {}
    for c in cats:
        values = sorted(frames[0][c].astype(str).unique())
        dtype = pd.CategoricalDtype(values)
        for f in frames:
            f[c] = f[c].astype(str).astype(dtype)
        mapping[c] = values
    return mapping


# ------------------------------------------------------------------- baselines
def group_stat(keys, target, stat="median"):
    def fn(tr, te):
        m = tr.groupby(keys)[target].agg(stat).rename("_b").reset_index()
        overall = tr[target].agg(stat)
        return te[keys].merge(m, on=keys, how="left")["_b"].fillna(overall).to_numpy(float)

    return fn


def column(col):
    def fn(tr, te):
        return te[col].fillna(tr[col].mean()).to_numpy(float)

    return fn


# --------------------------------------------------------------------- metrics
def reg_metrics(y, p):
    y, p = np.asarray(y, float), np.asarray(p, float)
    mask = np.abs(y) > 1e-6
    return {
        "MAE": float(mean_absolute_error(y, p)),
        "RMSE": float(np.sqrt(mean_squared_error(y, p))),
        "MAPE": float(np.mean(np.abs((y[mask] - p[mask]) / y[mask])) * 100) if mask.any() else None,
        "R2": float(r2_score(y, p)),
    }


def clf_metrics(y, prob):
    y, prob = np.asarray(y, int), np.asarray(prob, float)
    prec, rec, _ = precision_recall_curve(y, prob)
    f1 = 2 * prec * rec / np.clip(prec + rec, 1e-9, None)
    hi_prec = rec[prec >= 0.9]
    return {
        "ROC_AUC": float(roc_auc_score(y, prob)),
        "PR_AUC": float(average_precision_score(y, prob)),
        "F1_best": float(f1.max()),
        "Recall_at_90_precision": float(hi_prec.max()) if len(hi_prec) else 0.0,
    }


# ----------------------------------------------------------------------- model
def fit_lgbm(Xtr, ytr, Xva, yva, task="regression", objective=None):
    params = dict(
        n_estimators=2000, learning_rate=0.04, num_leaves=31, min_child_samples=20,
        subsample=0.8, subsample_freq=1, colsample_bytree=0.8, reg_lambda=1.0,
        random_state=SEED, verbose=-1,
    )
    if task == "binary":
        model = lgb.LGBMClassifier(class_weight="balanced", **params)
        metric = "auc"
    else:
        model = lgb.LGBMRegressor(objective=objective or "regression", **params)
        metric = "l1"
    model.fit(Xtr, ytr, eval_X=(Xva,), eval_y=(yva,), eval_metric=metric,
              callbacks=[lgb.early_stopping(100, verbose=False)])
    return model


def _plots(name, task, y, p, importance):
    FIGURES.mkdir(parents=True, exist_ok=True)
    fig, axes = plt.subplots(1, 3, figsize=(16, 4.5))
    if task == "binary":
        prec, rec, _ = precision_recall_curve(y, p)
        axes[0].plot(rec, prec)
        axes[0].set(xlabel="Recall", ylabel="Precision", title="Precision-Recall")
        for cls in (0, 1):
            axes[1].hist(p[np.asarray(y) == cls], bins=30, alpha=0.6, label=f"class {cls}")
        axes[1].set(title="Predicted probability", xlabel="p")
        axes[1].legend()
    else:
        axes[0].scatter(y, p, s=6, alpha=0.4)
        lo, hi = float(np.min(y)), float(np.max(y))
        axes[0].plot([lo, hi], [lo, hi], "r--", lw=1)
        axes[0].set(xlabel="Actual", ylabel="Predicted", title="Predicted vs actual")
        axes[1].hist(np.asarray(y) - p, bins=40)
        axes[1].set(title="Residuals (actual - predicted)")
    top = importance.head(20)[::-1]
    axes[2].barh(top.index, top.values)
    axes[2].set(title="Top features (gain)")
    axes[2].tick_params(axis="y", labelsize=7)
    fig.suptitle(name)
    fig.tight_layout()
    fig.savefig(FIGURES / f"{name}.png", dpi=110)
    plt.close(fig)


def run_model(name, df, features, cats, target, time_col, baselines, task="regression",
              target_transform=None, purge_key=None, description="", objective=None):
    """Split -> baselines -> LightGBM -> metrics -> plots -> save. Returns a result dict."""
    df = df.dropna(subset=[target])
    tr, va, te = time_split(df, time_col, group_key=purge_key)

    metrics = {}
    for bname, fn in baselines.items():
        bp = fn(tr, te)
        metrics[bname] = clf_metrics(te[target], bp) if task == "binary" else reg_metrics(te[target], bp)

    categories = encode_categories([tr, va, te], cats)
    fwd = np.log1p if target_transform == "log1p" else (lambda v: v)
    inv = np.expm1 if target_transform == "log1p" else (lambda v: v)
    model = fit_lgbm(tr[features], fwd(tr[target]), va[features], fwd(va[target]), task, objective)

    if task == "binary":
        pred = model.predict_proba(te[features])[:, 1]
        metrics["LightGBM"] = clf_metrics(te[target], pred)
        key, better = "ROC_AUC", max
        best_base = better(m[key] for b, m in metrics.items() if b != "LightGBM")
        improvement = (metrics["LightGBM"][key] - best_base) / best_base * 100
    else:
        pred = inv(model.predict(te[features]))
        metrics["LightGBM"] = reg_metrics(te[target], pred)
        key = "MAE"
        best_base = min(m[key] for b, m in metrics.items() if b != "LightGBM")
        improvement = (best_base - metrics["LightGBM"][key]) / best_base * 100

    importance = pd.Series(
        model.booster_.feature_importance("gain"), index=features
    ).sort_values(ascending=False)
    _plots(name, task, te[target].to_numpy(), np.asarray(pred), importance)

    MODELS.mkdir(exist_ok=True)
    bundle = dict(model=model, features=features, categories=categories, task=task,
                  target=target, target_transform=target_transform)
    joblib.dump(bundle, MODELS / f"{name}.joblib")
    (MODELS / f"{name}_features.json").write_text(json.dumps(
        {"target": target, "task": task, "target_transform": target_transform,
         "features": {f: str(tr[f].dtype) for f in features}, "categories": categories},
        indent=2))

    return dict(
        name=name, task=task, target=target, description=description,
        n_train=len(tr), n_val=len(va), n_test=len(te),
        best_iteration=int(model.best_iteration_ or model.n_estimators),
        key_metric=key, improvement_pct=float(improvement),
        beats_baseline=bool(improvement > 0), metrics=metrics,
        top_features=[(f, float(v)) for f, v in importance.head(10).items()],
    )
