"""Resize every CSV in data/ to exactly N data rows (default 5000).

- Files with more rows are down-sampled (chronological order preserved).
- Files with fewer rows are up-sampled with realistic synthetic rows:
  unique IDs are regenerated, all datetimes in a row are shifted together
  (so durations stay consistent), and continuous numeric columns are jittered.
A backup of the original files is written to data_backup/.

Usage: python scripts/resize_datasets.py [--rows 5000]
"""
import argparse
import re
import shutil
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BACKUP = ROOT / "data_backup"
DT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$")
rng = np.random.default_rng(42)


def datetime_cols(df):
    cols = []
    for c in df.columns:
        s = df[c].dropna().astype(str)
        if len(s) and s.map(lambda v: bool(DT_RE.match(v))).all():
            cols.append(c)
    return cols


def new_ids(original, sampled):
    """Continue ID sequences like P000123 / ED-01 / NUR-ED-001, keeping each row's prefix."""
    m = original.astype(str).str.extract(r"^(.*?)(\d+)$")
    s = sampled.astype(str).str.extract(r"^(.*?)(\d+)$")
    if m[1].isna().any():
        return [f"{v}-{i:05d}" for i, v in enumerate(sampled.astype(str), 1)]
    width = m[1].str.len().max()
    start = m[1].astype(int).max() + 1
    return [f"{p}{i:0{width}d}" for i, p in enumerate(s[0], start)]


def is_continuous(s):
    if not pd.api.types.is_numeric_dtype(s) or pd.api.types.is_bool_dtype(s):
        return False
    return s.nunique(dropna=True) > 6  # keep flags / acuity levels categorical


def upsample(df, target):
    n_new = target - len(df)
    synth = df.sample(n=n_new, replace=True, random_state=42).reset_index(drop=True)
    first = df.columns[0]

    # Regenerate the primary key if it is unique in the original file
    if first.endswith("_id") and df[first].is_unique:
        synth[first] = new_ids(df[first], synth[first])

    # Shift all datetime columns of a row by the same offset
    dts = datetime_cols(df)
    if dts:
        offset = pd.to_timedelta(rng.integers(-14 * 24 * 60, 14 * 24 * 60, n_new), unit="m")
        for c in dts:
            parsed = pd.to_datetime(synth[c], errors="coerce")
            date_only = df[c].dropna().astype(str).str.len().max() <= 10
            shifted = parsed + (offset.round("1D") if date_only else offset)
            fmt = "%Y-%m-%d" if date_only else "%Y-%m-%d %H:%M:%S"
            synth[c] = shifted.dt.strftime(fmt).where(parsed.notna(), synth[c])

    # Jitter continuous numeric columns (+/-15%)
    for c in df.columns:
        if c == first or not is_continuous(df[c]):
            continue
        noise = rng.normal(1.0, 0.15, n_new)
        vals = synth[c] * noise
        lo, hi = df[c].min(), df[c].max()
        if lo >= 0:
            vals = vals.clip(lower=0)
        if any(k in c for k in ("percent", "occupancy", "utilization")) and hi <= 100:
            vals = vals.clip(upper=100)
        if pd.api.types.is_integer_dtype(df[c]):
            vals = vals.round().astype("Int64")
        else:
            vals = vals.round(2)
        synth[c] = vals.where(synth[c].notna())

    out = pd.concat([df, synth], ignore_index=True)
    if dts:
        out = out.sort_values(dts[0], kind="stable").reset_index(drop=True)
    return out


def downsample(df, target):
    idx = np.sort(rng.choice(len(df), size=target, replace=False))
    return df.iloc[idx].reset_index(drop=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=5000)
    args = ap.parse_args()

    BACKUP.mkdir(exist_ok=True)
    for f in sorted(DATA.glob("*.csv")):
        if not (BACKUP / f.name).exists():
            shutil.copy2(f, BACKUP / f.name)
        df = pd.read_csv(BACKUP / f.name, keep_default_na=False, na_values=[""])
        before = len(df)
        if before > args.rows:
            df = downsample(df, args.rows)
        elif before < args.rows:
            df = upsample(df, args.rows)
        for c in df.columns:
            if pd.api.types.is_bool_dtype(df[c]):
                df[c] = df[c].map({True: "true", False: "false"})
        df.to_csv(f, index=False)
        print(f"{f.name:28s} {before:6d} -> {len(df):6d} rows")


if __name__ == "__main__":
    main()
