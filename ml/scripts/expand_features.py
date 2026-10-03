"""
expand_features.py  –  Expand every data/*.csv to exactly 10,000 columns.

Strategy (applied to each file's numeric columns):
  1.  Calendar features from datetime columns
  2.  Lag features   (1..48)
  3.  Rolling stats  (mean, std, min, max, sum, median, skew, kurt) × windows [2,3,4,5,6,8,12,16,24,48,96]
  4.  Diff / pct-change lags (1..24)
  5.  Exponential weighted mean/std/var (span 2,3,6,12,24,48)
  6.  Cumulative stats (cumsum, cummax, cummin, cummean, cumstd)
  7.  Rank, z-score within rolling windows 8,12,24,48
  8.  Boolean flags (zero, above/below mean, above/below median, local extrema, above/below Q1/Q3)
  9.  Pairwise ratio and difference of ALL numeric columns (n*(n-1)/2 each)
  10. Polynomial degree-2,3 self-interactions (col^2, col^3, col^0.5, 1/col, log1p|col|)
  11. Harmonic seasonality (sin/cos) for each numeric × {1,2,3,4,6,8,12} components
  12. Cross-product interaction of top-variance numeric pairs + shifted cross-products (pad to target)
  13. Noise-augmented copies + random projections (final padding, for files with very few numeric cols)

Columns with near-zero variance or all-NaN are dropped.
Output overwrites data/*.csv in-place.

Usage:  python scripts/expand_features.py [--target 10000] [--file filename.csv]
"""
import argparse
import re
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")
RNG = np.random.default_rng(42)

LAGS     = list(range(1, 49))            # 1..48
ROLL_W   = [2, 3, 4, 5, 6, 8, 12, 16, 24, 48, 96]
ROLL_STATS = ["mean", "std", "min", "max", "sum", "median"]
DIFF_L   = list(range(1, 25))            # 1..24
EWM_SPAN = [2, 3, 6, 12, 24, 48]
HARM_K   = [1, 2, 3, 4, 6, 8, 12]


# ── helpers ─────────────────────────────────────────────────────────────────
def _is_dt(s):
    sample = s.dropna().head(20).astype(str)
    return len(sample) > 0 and sample.map(lambda v: bool(DT_RE.match(v))).mean() > 0.8


def _dt_cols(df):
    obj_cols = df.select_dtypes(include=["object", "string"]).columns
    return [c for c in obj_cols if _is_dt(df[c])]


def _num_cols(df, exclude=()):
    return [c for c in df.select_dtypes("number").columns
            if c not in exclude and df[c].std() > 1e-10]


def _safe(a):
    return np.where(np.isfinite(a), a, np.nan)


def _add(df, name, values):
    if name not in df.columns:
        df[name] = _safe(values) if hasattr(values, '__len__') else values


def _ncols(df):
    return len(df.columns)


# ── 1. calendar features ────────────────────────────────────────────────────
def add_calendar(df, dt_cols):
    for c in dt_cols:
        ser = pd.to_datetime(df[c], errors="coerce")
        p = c + "_"
        _add(df, p + "hour",        ser.dt.hour)
        _add(df, p + "minute",      ser.dt.minute)
        _add(df, p + "second",      ser.dt.second)
        _add(df, p + "day",         ser.dt.day)
        _add(df, p + "dayofweek",   ser.dt.dayofweek)
        _add(df, p + "dayofyear",   ser.dt.dayofyear)
        _add(df, p + "weekofyear",  ser.dt.isocalendar().week.astype(float))
        _add(df, p + "month",       ser.dt.month)
        _add(df, p + "quarter",     ser.dt.quarter)
        _add(df, p + "is_weekend",  (ser.dt.dayofweek >= 5).astype(int))
        _add(df, p + "is_night",    ((ser.dt.hour < 6) | (ser.dt.hour >= 22)).astype(int))
        _add(df, p + "is_peak",     ((ser.dt.hour >= 8) & (ser.dt.hour <= 18)).astype(int))
        _add(df, p + "is_morning",  ((ser.dt.hour >= 6) & (ser.dt.hour < 12)).astype(int))
        _add(df, p + "is_afternoon",((ser.dt.hour >= 12) & (ser.dt.hour < 18)).astype(int))
        _add(df, p + "unix",        ser.astype("int64") // 10**9)
        _add(df, p + "unix_day",    ser.astype("int64") // (10**9 * 86400))
        # sine/cosine encoding of cyclic calendar features
        _add(df, p + "hour_sin",    np.sin(2 * np.pi * ser.dt.hour / 24))
        _add(df, p + "hour_cos",    np.cos(2 * np.pi * ser.dt.hour / 24))
        _add(df, p + "dow_sin",     np.sin(2 * np.pi * ser.dt.dayofweek / 7))
        _add(df, p + "dow_cos",     np.cos(2 * np.pi * ser.dt.dayofweek / 7))
        _add(df, p + "month_sin",   np.sin(2 * np.pi * ser.dt.month / 12))
        _add(df, p + "month_cos",   np.cos(2 * np.pi * ser.dt.month / 12))
        # inter-datetime differences in minutes
        if len(dt_cols) > 1:
            for c2 in dt_cols:
                if c2 <= c:
                    continue
                d2 = pd.to_datetime(df[c2], errors="coerce")
                diff_m = (d2 - ser).dt.total_seconds() / 60
                _add(df, f"dt_diff_min_{c}_{c2}", _safe(diff_m.to_numpy(float)))


# ── 2. lags ──────────────────────────────────────────────────────────────────
def add_lags(df, nums, target):
    for lag in LAGS:
        for c in nums:
            if _ncols(df) >= target:
                return
            _add(df, f"{c}_lag{lag}", df[c].shift(lag))


# ── 3. rolling stats ─────────────────────────────────────────────────────────
def add_rolling(df, nums, target):
    for w in ROLL_W:
        for c in nums:
            r = df[c].rolling(w, min_periods=1)
            for stat in ROLL_STATS:
                if _ncols(df) >= target:
                    return
                fn = getattr(r, stat)
                _add(df, f"{c}_roll{w}_{stat}", fn())
            # skew & kurt only for wider windows
            if w >= 4:
                if _ncols(df) < target:
                    _add(df, f"{c}_roll{w}_skew", r.skew())
                if _ncols(df) < target:
                    _add(df, f"{c}_roll{w}_kurt", r.kurt())


# ── 4. diffs ─────────────────────────────────────────────────────────────────
def add_diffs(df, nums, target):
    for lag in DIFF_L:
        for c in nums:
            if _ncols(df) >= target:
                return
            _add(df, f"{c}_diff{lag}",    df[c].diff(lag))
            _add(df, f"{c}_pctchg{lag}",  df[c].pct_change(lag) * 100)


# ── 5. EWM ───────────────────────────────────────────────────────────────────
def add_ewm(df, nums, target):
    for span in EWM_SPAN:
        for c in nums:
            if _ncols(df) >= target:
                return
            e = df[c].ewm(span=span, min_periods=1)
            _add(df, f"{c}_ewm{span}_mean", e.mean())
            if _ncols(df) < target:
                _add(df, f"{c}_ewm{span}_std",  e.std())
            if _ncols(df) < target:
                _add(df, f"{c}_ewm{span}_var",  e.var())


# ── 6. cumulative ────────────────────────────────────────────────────────────
def add_cumulative(df, nums, target):
    for c in nums:
        if _ncols(df) >= target:
            return
        _add(df, f"{c}_cumsum",  df[c].cumsum())
        _add(df, f"{c}_cummean", df[c].expanding(1).mean())
        _add(df, f"{c}_cummax",  df[c].expanding(1).max())
        _add(df, f"{c}_cummin",  df[c].expanding(1).min())
        _add(df, f"{c}_cumstd",  df[c].expanding(2).std())


# ── 7. rank & z-score ────────────────────────────────────────────────────────
def add_rank_zscore(df, nums, target):
    for W in [8, 12, 24, 48]:
        for c in nums:
            if _ncols(df) >= target:
                return
            vals = df[c].to_numpy(float)
            ranks   = np.full(len(vals), np.nan)
            zscores = np.full(len(vals), np.nan)
            for i in range(len(vals)):
                win = vals[max(0, i - W + 1): i + 1]
                valid = win[np.isfinite(win)]
                if len(valid) < 2:
                    continue
                ranks[i]   = float(np.sum(valid <= vals[i])) / len(valid)
                mu, sd = valid.mean(), valid.std()
                zscores[i] = (vals[i] - mu) / sd if sd > 1e-10 else 0.0
            _add(df, f"{c}_rank{W}",   _safe(ranks))
            if _ncols(df) < target:
                _add(df, f"{c}_zscore{W}", _safe(zscores))


# ── 8. boolean flags ─────────────────────────────────────────────────────────
def add_flags(df, nums, target):
    for c in nums:
        if _ncols(df) >= target:
            return
        v = df[c]
        _add(df, f"{c}_is_zero",      (v == 0).astype(float))
        _add(df, f"{c}_above_mean",   (v > v.mean()).astype(float))
        _add(df, f"{c}_above_median", (v > v.median()).astype(float))
        _add(df, f"{c}_above_q75",    (v > v.quantile(0.75)).astype(float))
        _add(df, f"{c}_below_q25",    (v < v.quantile(0.25)).astype(float))
        _add(df, f"{c}_local_max",    ((v > v.shift(1)) & (v > v.shift(-1))).astype(float))
        _add(df, f"{c}_local_min",    ((v < v.shift(1)) & (v < v.shift(-1))).astype(float))
        _add(df, f"{c}_increasing",   (v.diff() > 0).astype(float))
        _add(df, f"{c}_decreasing",   (v.diff() < 0).astype(float))


# ── 9. polynomial self-interactions ─────────────────────────────────────────
def add_poly(df, nums, target):
    for c in nums:
        if _ncols(df) >= target:
            return
        v = df[c].to_numpy(float)
        _add(df, f"{c}_sq",     _safe(v ** 2))
        _add(df, f"{c}_cube",   _safe(v ** 3))
        pos = np.where(v >= 0, v, np.nan)
        _add(df, f"{c}_sqrt",   _safe(np.sqrt(pos)))
        nz  = np.where(np.abs(v) > 1e-10, v, np.nan)
        _add(df, f"{c}_inv",    _safe(1.0 / nz))
        _add(df, f"{c}_abslog", _safe(np.log1p(np.abs(v))))
        _add(df, f"{c}_sign",   np.sign(v))
        _add(df, f"{c}_abs",    np.abs(v))


# ── 10. harmonic seasonality ──────────────────────────────────────────────────
def add_harmonics(df, nums, target):
    n = len(df)
    t = np.arange(n) / max(n - 1, 1)
    for k in HARM_K:
        sin_k = np.sin(2 * np.pi * k * t)
        cos_k = np.cos(2 * np.pi * k * t)
        for c in nums:
            if _ncols(df) >= target:
                return
            v = df[c].to_numpy(float)
            _add(df, f"{c}_sin{k}", _safe(v * sin_k))
            _add(df, f"{c}_cos{k}", _safe(v * cos_k))
            _add(df, f"{c}_sinraw{k}", sin_k)
            _add(df, f"{c}_cosraw{k}", cos_k)


# ── 11. pairwise ratios & products ──────────────────────────────────────────
def add_pairwise(df, nums, target):
    for i, a in enumerate(nums):
        for b in nums[i + 1:]:
            if _ncols(df) >= target:
                return
            va = df[a].to_numpy(float)
            vb = df[b].to_numpy(float)
            _add(df, f"{a}_MINUS_{b}", _safe(va - vb))
            _add(df, f"{a}_PLUS_{b}",  _safe(va + vb))
            _add(df, f"{a}_TIMES_{b}", _safe(va * vb))
            nb = np.where(np.abs(vb) > 1e-10, vb, np.nan)
            if _ncols(df) < target:
                _add(df, f"{a}_DIV_{b}", _safe(va / nb))


# ── 12. random projections (final padding) ────────────────────────────────────
def add_random_projections(df, nums, target):
    """
    When there are too few numeric columns to reach target through feature
    engineering, generate deterministic random-projection columns in batch.
    Each projection is a weighted sum of numeric columns with fixed
    reproducible weights, concatenated in one shot for maximum performance.
    """
    need = target - len(df.columns)
    if need <= 0:
        return df

    valid_nums = [c for c in nums if pd.api.types.is_numeric_dtype(df[c]) and df[c].std(skipna=True) > 1e-6]
    if not valid_nums:
        valid_nums = [c for c in df.select_dtypes("number").columns if df[c].std(skipna=True) > 1e-6]

    rng_local = np.random.default_rng(999)
    if valid_nums:
        mat = df[valid_nums].fillna(0).to_numpy(float)
        W = rng_local.standard_normal((mat.shape[1], need))
        W /= (np.linalg.norm(W, axis=0, keepdims=True) + 1e-12)
        pad_data = mat @ W
    else:
        pad_data = rng_local.standard_normal((len(df), need))

    existing = set(df.columns)
    col_names = []
    proj_idx = 0
    while len(col_names) < need:
        name = f"rproj_{proj_idx}"
        if name not in existing:
            col_names.append(name)
            existing.add(name)
        proj_idx += 1

    pad_df = pd.DataFrame(pad_data, columns=col_names, index=df.index)
    return pd.concat([df, pad_df], axis=1)


# ── 13. top-variance shifted cross-products (pad to target) ──────────────────
def pad_to_target(df, nums, target):
    need = target - _ncols(df)
    if need <= 0 or len(nums) < 1:
        return
    vars_ = df[nums].var().sort_values(ascending=False)
    top = vars_.index.tolist()
    added = 0
    for lag in range(1, 200):
        for c in top:
            if _ncols(df) >= target:
                return
            name = f"{c}_xlag{lag}"
            if name not in df.columns:
                _add(df, name, df[c].shift(lag) * df[c])
                added += 1


# ── main expand ───────────────────────────────────────────────────────────────
def expand(path, target):
    build_target = target + 200
    print(f"  Loading {path.name}...", flush=True)
    df = pd.read_csv(path, keep_default_na=False, na_values=[""], low_memory=False)
    original_cols = list(df.columns)
    print(f"  {path.name}: {len(original_cols)} cols -> target {target}", flush=True)

    # Fast path: if file already has >= 500 columns, it already went through feature engineering.
    # Pad or trim directly to target in milliseconds.
    if len(original_cols) >= 500:
        print(f"  Already engineered ({len(original_cols)} cols), adjusting to {target} directly...", flush=True)
        if _ncols(df) < target:
            df = add_random_projections(df, _num_cols(df), target)
        if _ncols(df) > target:
            df = df.iloc[:, :target]
        print(f"  Saving {path.name} with {len(df.columns)} columns...", flush=True)
        df.to_csv(path, index=False)
        final = _ncols(df)
        print(f"  {path.name}: {final} cols saved.", flush=True)
        return final

    dt_cols = _dt_cols(df)

    add_calendar(df, dt_cols)
    orig_nums = _num_cols(df)

    if not orig_nums:
        print(f"  WARNING: {path.name} has no numeric columns — padding directly.", flush=True)
        df = add_random_projections(df, [], target)
        df.to_csv(path, index=False)
        return _ncols(df)

    for fn in (add_lags, add_rolling, add_diffs, add_ewm,
               add_cumulative, add_flags,
               add_poly, add_harmonics):
        if _ncols(df) < build_target:
            fn(df, orig_nums, build_target)

    # rank/zscore is slow for large datasets; only run if still needed
    if _ncols(df) < build_target:
        add_rank_zscore(df, orig_nums, build_target)

    if _ncols(df) < build_target:
        add_pairwise(df, orig_nums, build_target)

    if _ncols(df) < build_target:
        pad_to_target(df, orig_nums, build_target)

    # final fallback: random projections
    if _ncols(df) < build_target:
        df = add_random_projections(df, orig_nums, build_target)

    # drop all-NaN or zero-variance new columns
    new_cols = [c for c in df.columns if c not in original_cols]
    bad = [c for c in new_cols
           if df[c].isna().all() or
           (pd.api.types.is_numeric_dtype(df[c]) and df[c].std(skipna=True) < 1e-14)]
    if bad:
        df.drop(columns=bad, inplace=True)

    # if short after dropping bad columns, pad to target
    if _ncols(df) < target:
        orig_nums2 = _num_cols(df)
        df = add_random_projections(df, orig_nums2, target)

    # trim to exactly target (keep all originals, then best engineered)
    all_cols = list(df.columns)
    if len(all_cols) > target:
        orig_set = set(original_cols)
        keep = [c for c in all_cols if c in orig_set]
        extras = [c for c in all_cols if c not in orig_set]
        keep = keep + extras[:target - len(keep)]
        df = df[keep]

    print(f"  Saving {path.name} with {len(df.columns)} columns...", flush=True)
    df.to_csv(path, index=False)
    final = _ncols(df)
    print(f"  {path.name}: {final} cols saved.", flush=True)
    return final


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=int, default=10000)
    ap.add_argument("--file",   type=str, default=None,
                    help="Process only this filename (e.g. staff.csv)")
    args = ap.parse_args()

    if args.file:
        files = [DATA / args.file]
    else:
        files = sorted(DATA.glob("*.csv"))

    print(f"Expanding {len(files)} file(s) to {args.target} columns each...")
    for f in files:
        ncols = expand(f, args.target)
        print(f"{f.name:35s} -> {ncols:6d} columns")
    print("Done.")


if __name__ == "__main__":
    main()
