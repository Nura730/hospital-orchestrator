"""Model 5 — Wait-time prediction for the ED queue and diagnostics."""
import numpy as np
import pandas as pd

from .common import add_calendar, group_stat, hourly_grid, load, run_model

LOAD_COLS = ["queue_length", "utilization_percent", "pressure_score", "average_waiting_time",
             "available_capacity", "staff_gap", "resource_gap"]
LOAD_FEATS = [f"load_{c}" for c in LOAD_COLS]


def department_load():
    hourly = hourly_grid(load("department_state", ["timestamp"]), ["department"])
    hourly["staff_gap"] = hourly["staff_available"] - hourly["staff_required"]
    hourly["resource_gap"] = hourly["resource_available"] - hourly["resource_required"]
    out = hourly[["department", "timestamp"] + LOAD_COLS].dropna(subset=["queue_length"])
    return out.rename(columns={c: f"load_{c}" for c in LOAD_COLS}).sort_values("timestamp")


def _recent_count(times, hours):
    t = times.to_numpy("datetime64[ns]")
    order = np.argsort(t)
    ts = t[order]
    counts = np.empty(len(t), dtype=int)
    counts[order] = np.arange(len(ts)) - np.searchsorted(ts, ts - np.timedelta64(hours, "h"))
    return counts


def build_features(df, time_col, state):
    """Join the latest known department state (backward as-of) + recent arrival counts."""
    df = df.dropna(subset=[time_col]).copy()
    df["_row"] = np.arange(len(df))
    df = pd.merge_asof(df.sort_values(time_col), state, left_on=time_col, right_on="timestamp",
                       by="department", direction="backward", tolerance=pd.Timedelta("6h"))
    df = df.drop(columns=["timestamp"], errors="ignore").sort_values("_row")
    add_calendar(df, time_col)
    df["arrivals_prev_1h"] = _recent_count(df[time_col], 1)
    df["arrivals_prev_3h"] = _recent_count(df[time_col], 3)
    return df


BASE = ["hour", "day_of_week", "is_weekend", "arrivals_prev_1h", "arrivals_prev_3h"] + LOAD_FEATS
ED_CATS = ["priority", "department"]
DIAG_CATS = ["test_type", "department", "priority", "equipment_id"]


def train():
    state = department_load()
    ed = build_features(load("ed_queue", ["arrival_time"]), "arrival_time", state)
    diag = build_features(load("diagnostics", ["request_time"]), "request_time", state)
    return [
        run_model(
            name="ed_wait_time", df=ed, features=BASE + ["acuity_level"] + ED_CATS, cats=ED_CATS,
            target="waiting_time_minutes", time_col="arrival_time", purge_key="patient_id",
            objective="l1",
            baselines={"Median wait per priority": group_stat(["priority"], "waiting_time_minutes")},
            description="Predict ED waiting time (minutes) at arrival",
        ),
        run_model(
            name="diagnostic_wait_time", df=diag, features=BASE + DIAG_CATS, cats=DIAG_CATS,
            target="waiting_time_minutes", time_col="request_time", purge_key="patient_id",
            objective="l1",
            baselines={"Median wait per test & priority":
                       group_stat(["test_type", "priority"], "waiting_time_minutes")},
            description="Predict diagnostic test waiting time (minutes) at request",
        ),
    ]
