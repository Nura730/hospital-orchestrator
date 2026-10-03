"""Model 2 — Resource demand forecast (actual_demand per department x resource_type)."""
import numpy as np
from .common import add_calendar, column, hourly_grid, load, run_model

KEYS = ["department", "resource_type"]
LAGS = [1, 2, 3, 4, 6, 8, 12, 24]
ROLLS = [2, 3, 4, 6, 8, 12, 24]
# predicted_demand_* are an existing forecaster's outputs: used only as a benchmark.
LEAKY = [f"predicted_demand_{h}" for h in ("30m", "1h", "2h", "4h", "8h", "24h")]


def build_features(hourly):
    df = hourly.sort_values(KEYS + ["timestamp"]).reset_index(drop=True)
    g = df.groupby(KEYS)
    feats = ["current_demand"]
    for c in ("actual_demand", "current_demand"):
        for lag in LAGS:
            df[f"{c}_lag{lag}"] = g[c].shift(lag)
            feats.append(f"{c}_lag{lag}")
    for w in ROLLS:
        roll = g["actual_demand"].shift(1).groupby([df[k] for k in KEYS]).rolling(w, min_periods=1)
        df[f"actual_demand_rmean{w}"] = roll.mean().reset_index(level=[0, 1], drop=True)
        df[f"actual_demand_rstd{w}"] = roll.std().reset_index(level=[0, 1], drop=True)
        feats += [f"actual_demand_rmean{w}", f"actual_demand_rstd{w}"]

    # Momentum and rate-of-change
    for lag in [1, 2, 3]:
        df[f"current_demand_diff{lag}"] = df["current_demand"] - df[f"current_demand_lag{lag}"]
        feats.append(f"current_demand_diff{lag}")

    # Cross-sectional aggregations at each timestamp
    dept_sum = df.groupby(["department", "timestamp"])["current_demand"].transform("sum")
    df["dept_total_current_demand"] = dept_sum
    df["current_demand_share_of_dept"] = df["current_demand"] / np.clip(dept_sum, 1e-6, None)
    feats += ["dept_total_current_demand", "current_demand_share_of_dept"]

    add_calendar(df, "timestamp")
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
    df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
    df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7)
    feats += ["hour", "day_of_week", "is_weekend", "hour_sin", "hour_cos", "dow_sin", "dow_cos"] + KEYS
    return df, feats


def train():
    needed = ["timestamp", "department", "resource_type", "current_demand", "actual_demand"] + LEAKY
    hourly = hourly_grid(load("resource_demand", ["timestamp"], usecols=needed), KEYS, cols=needed)
    df, feats = build_features(hourly)
    df = df[df["_obs"] == 1]
    history_baselines = {
        "Persistence (current_demand)": column("current_demand"),
    }
    stacked_baselines = {
        "Persistence (current_demand)": column("current_demand"),
        "Existing forecaster (predicted_demand_30m)": column("predicted_demand_30m"),
        "Existing forecaster (predicted_demand_1h)": column("predicted_demand_1h"),
    }
    return [
        run_model(
            name="resource_demand", df=df, features=feats, cats=KEYS,
            target="actual_demand", time_col="timestamp", baselines=history_baselines, objective="l1",
            description="Forecast actual resource demand from history only (no external forecasts)",
        ),
        # Stacked: the existing forecaster's outputs are available at prediction time,
        # so the model can learn to correct them.
        run_model(
            name="resource_demand_stacked", df=df, features=feats + LEAKY, cats=KEYS,
            target="actual_demand", time_col="timestamp", baselines=stacked_baselines, objective="l1",
            description="Correct the existing demand forecaster using history (stacked model)",
        ),
    ]
