"""Model 2 — Resource demand forecast (actual_demand per department x resource_type)."""
from .common import add_calendar, column, hourly_grid, load, run_model

KEYS = ["department", "resource_type"]
LAGS = [1, 2, 3, 6, 12, 24]
ROLLS = [3, 6, 24]
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
    df["current_demand_diff1"] = df["current_demand"] - df["current_demand_lag1"]
    feats.append("current_demand_diff1")
    add_calendar(df, "timestamp")
    feats += ["hour", "day_of_week", "is_weekend"] + KEYS
    return df, feats


def train():
    hourly = hourly_grid(load("resource_demand", ["timestamp"]), KEYS)
    df, feats = build_features(hourly)
    df = df[df["_obs"] == 1]
    baselines = {
        "Persistence (current_demand)": column("current_demand"),
        "Existing forecaster (predicted_demand_30m)": column("predicted_demand_30m"),
        "Existing forecaster (predicted_demand_1h)": column("predicted_demand_1h"),
    }
    return [
        run_model(
            name="resource_demand", df=df, features=feats, cats=KEYS,
            target="actual_demand", time_col="timestamp", baselines=baselines, objective="l1",
            description="Forecast actual resource demand from history only (no external forecasts)",
        ),
        # Stacked: the existing forecaster's outputs are available at prediction time,
        # so the model can learn to correct them.
        run_model(
            name="resource_demand_stacked", df=df, features=feats + LEAKY, cats=KEYS,
            target="actual_demand", time_col="timestamp", baselines=baselines, objective="l1",
            description="Correct the existing demand forecaster using history (stacked model)",
        ),
    ]
