"""Model 1 — Department pressure forecast (t+1h, t+4h, t+24h)."""
from .common import add_calendar, column, hourly_grid, load, run_model

TARGETS = {"pressure_score": "pressure", "utilization_percent": "utilization"}
HORIZONS = [1, 4, 24]
LAGS = [1, 2, 3, 6, 12, 24]
ROLLS = [3, 6, 24]
LAG_COLS = ["pressure_score", "utilization_percent", "queue_length", "average_waiting_time"]
CURRENT = ["total_capacity", "occupied_capacity", "available_capacity", "patient_count",
           "queue_length", "average_waiting_time", "utilization_percent", "pressure_score",
           "staff_gap", "resource_gap"]
CATS = ["department"]


def build_features(hourly):
    """`hourly` = hourly_grid(department_state, ["department"]). Returns frame + feature list."""
    df = hourly.sort_values(["department", "timestamp"]).reset_index(drop=True)
    df["staff_gap"] = df["staff_available"] - df["staff_required"]
    df["resource_gap"] = df["resource_available"] - df["resource_required"]
    g = df.groupby("department")
    feats = list(CURRENT)
    for c in LAG_COLS:
        for lag in LAGS:
            df[f"{c}_lag{lag}"] = g[c].shift(lag)
            feats.append(f"{c}_lag{lag}")
        for w in ROLLS:
            roll = g[c].rolling(w, min_periods=1)
            df[f"{c}_rmean{w}"] = roll.mean().reset_index(level=0, drop=True)
            df[f"{c}_rstd{w}"] = roll.std().reset_index(level=0, drop=True)
            feats += [f"{c}_rmean{w}", f"{c}_rstd{w}"]
        df[f"{c}_diff1"] = df[c] - df[f"{c}_lag1"]
        feats.append(f"{c}_diff1")
    add_calendar(df, "timestamp")
    feats += ["hour", "day_of_week", "is_weekend"] + CATS
    return df, feats


def train():
    hourly = hourly_grid(load("department_state", ["timestamp"]), ["department"])
    df, feats = build_features(hourly)
    g = df.groupby("department")
    results = []
    for target, short in TARGETS.items():
        for h in HORIZONS:
            y = f"{target}_t{h}h"
            df[y] = g[target].shift(-h)
            valid = (df["_obs"] == 1) & (g["_obs"].shift(-h) == 1)
            results.append(run_model(
                name=f"pressure_{short}_t{h}h", df=df[valid], features=feats, cats=CATS,
                target=y, time_col="timestamp",
                baselines={"Persistence (current value)": column(target)},
                description=f"Forecast department {target} {h}h ahead",
            ))
    return results
