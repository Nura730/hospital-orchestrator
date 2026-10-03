"""Model 5 — Wait-time prediction for the ED queue and diagnostics."""
import numpy as np
import pandas as pd

from .common import add_calendar, group_stat, hourly_grid, load, run_model

LOAD_COLS = ["queue_length", "utilization_percent", "pressure_score", "average_waiting_time",
             "available_capacity", "staff_gap", "resource_gap"]
LOAD_FEATS = [f"load_{c}" for c in LOAD_COLS]


def department_load():
    needed = ["department", "timestamp", "queue_length", "utilization_percent", "pressure_score",
              "average_waiting_time", "available_capacity", "staff_available", "staff_required",
              "resource_available", "resource_required"]
    hourly = hourly_grid(load("department_state", ["timestamp"], usecols=needed), ["department"], cols=needed)
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


def build_ed_features(state):
    ed_needed = ["queue_id", "patient_id", "arrival_time", "triage_time", "priority", "acuity_level",
                 "department", "queue_status", "waiting_time_minutes"]
    df = load("ed_queue", ["arrival_time", "triage_time"], usecols=ed_needed).dropna(subset=["arrival_time"]).copy()

    # Merge patient clinical attributes
    p_needed = ["patient_id", "age", "gender", "requires_icu", "requires_ot", "requires_diagnostic", "diagnostic_type"]
    patients = load("patients", usecols=p_needed)
    df = df.merge(patients, on="patient_id", how="left")

    df["_row"] = np.arange(len(df))
    df = pd.merge_asof(df.sort_values("arrival_time"), state, left_on="arrival_time", right_on="timestamp",
                       by="department", direction="nearest")
    df = df.drop(columns=["timestamp"], errors="ignore").sort_values("_row")

    add_calendar(df, "arrival_time")
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
    df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
    df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7)

    # Triage duration / delay
    df["triage_delay_min"] = (df["triage_time"] - df["arrival_time"]).dt.total_seconds() / 60
    df["triage_delay_min"] = df["triage_delay_min"].clip(lower=0, upper=180).fillna(15.0)

    # Rolling arrival volumes
    t = df["arrival_time"].to_numpy("datetime64[ns]")
    for h in [1, 2, 4, 8, 24]:
        df[f"arrivals_prev_{h}h"] = np.arange(len(t)) - np.searchsorted(t, t - np.timedelta64(h, "h"))

    # Priority-weighted and category arrivals
    prio_weights = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
    df["prio_weight"] = df["priority"].map(prio_weights).fillna(1)
    pw = df["prio_weight"].to_numpy()
    cum_pw = np.cumsum(pw)
    for h in [1, 3, 6]:
        left = np.searchsorted(t, t - np.timedelta64(h, "h"))
        df[f"prio_weighted_arrivals_{h}h"] = cum_pw - np.where(left > 0, cum_pw[np.maximum(0, left - 1)], 0)

    for p in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        mask = (df["priority"] == p).to_numpy()
        sub_t = t[mask]
        for h in [1, 3, 6]:
            col = f"arrivals_{p}_{h}h"
            df[col] = 0
            cnt = np.arange(len(sub_t)) - np.searchsorted(sub_t, sub_t - np.timedelta64(h, "h"))
            df.loc[mask, col] = cnt

    # Domain queue interaction features
    df["high_acuity_ratio_3h"] = (df["arrivals_CRITICAL_3h"] + df["arrivals_HIGH_3h"]) / np.clip(df["arrivals_prev_4h"], 1, None)
    df["load_pressure_per_arrival"] = df["load_pressure_score"] * (df["arrivals_prev_2h"] + 1)
    df["load_queue_to_staff"] = df["load_queue_length"] / np.clip(df["load_staff_gap"].abs() + 1, 1, None)

    return df


def build_diag_features(state):
    diag_needed = ["request_id", "patient_id", "test_type", "department", "priority", "request_time",
                   "equipment_id", "technician_id", "waiting_time_minutes"]
    df = load("diagnostics", ["request_time"], usecols=diag_needed).dropna(subset=["request_time"]).copy()

    # Merge patient demographics
    p_needed = ["patient_id", "age", "gender", "acuity_level", "requires_icu", "requires_ot"]
    patients = load("patients", usecols=p_needed)
    df = df.merge(patients, on="patient_id", how="left")

    df["_row"] = np.arange(len(df))
    df = pd.merge_asof(df.sort_values("request_time"), state, left_on="request_time", right_on="timestamp",
                       by="department", direction="nearest")
    df = df.drop(columns=["timestamp"], errors="ignore").sort_values("_row")

    add_calendar(df, "request_time")
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
    df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
    df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7)

    # Equipment-level request arrival backlog
    t = df["request_time"].to_numpy("datetime64[ns]")
    eq = df["equipment_id"].to_numpy()
    for h in [1, 2, 4, 8, 16, 24]:
        c_arr = np.zeros(len(df), dtype=int)
        for e in np.unique(eq):
            mask = (eq == e)
            sub_t = t[mask]
            idx = np.where(mask)[0]
            cnt = np.arange(len(sub_t)) - np.searchsorted(sub_t, sub_t - np.timedelta64(h, "h"))
            c_arr[idx] = cnt
        df[f"equip_req_prev_{h}h"] = c_arr

    # Test-type queue volume
    tt = df["test_type"].to_numpy()
    for h in [1, 3, 6, 24]:
        c_arr = np.zeros(len(df), dtype=int)
        for tp in np.unique(tt):
            mask = (tt == tp)
            sub_t = t[mask]
            idx = np.where(mask)[0]
            cnt = np.arange(len(sub_t)) - np.searchsorted(sub_t, sub_t - np.timedelta64(h, "h"))
            c_arr[idx] = cnt
        df[f"test_type_req_prev_{h}h"] = c_arr

    # Priority-weighted equipment backlog
    prio_weights = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "ELECTIVE": 1}
    df["prio_weight"] = df["priority"].map(prio_weights).fillna(1)
    pw = df["prio_weight"].to_numpy()
    for h in [3, 6, 12, 24]:
        vals = np.zeros(len(df), dtype=float)
        for e in np.unique(eq):
            mask = (eq == e)
            sub_t = t[mask]
            sub_pw = pw[mask]
            idx = np.where(mask)[0]
            cum_pw = np.cumsum(sub_pw)
            left = np.searchsorted(sub_t, sub_t - np.timedelta64(h, "h"))
            vals[idx] = cum_pw - np.where(left > 0, cum_pw[np.maximum(0, left - 1)], 0)
        df[f"equip_pwt_prev_{h}h"] = vals

    return df


def train():
    state = department_load()
    ed = build_ed_features(state)
    diag = build_diag_features(state)

    ed_drop = ["queue_id", "patient_id", "arrival_time", "triage_time", "queue_status", "_row", "prio_weight", "waiting_time_minutes"]
    ed_feats = [c for c in ed.columns if c not in ed_drop]
    ed_cats = ["priority", "department", "gender", "diagnostic_type"]

    diag_drop = ["request_id", "patient_id", "request_time", "_row", "prio_weight", "waiting_time_minutes"]
    diag_feats = [c for c in diag.columns if c not in diag_drop]
    diag_cats = ["test_type", "department", "priority", "equipment_id", "technician_id", "gender"]

    return [
        run_model(
            name="ed_wait_time", df=ed, features=ed_feats, cats=ed_cats,
            target="waiting_time_minutes", time_col="arrival_time", purge_key="patient_id",
            objective="l1",
            baselines={"Median wait per priority": group_stat(["priority"], "waiting_time_minutes")},
            description="Predict ED waiting time (minutes) at arrival",
        ),
        run_model(
            name="diagnostic_wait_time", df=diag, features=diag_feats, cats=diag_cats,
            target="waiting_time_minutes", time_col="request_time", purge_key="patient_id",
            objective="l1",
            baselines={"Median wait per test & priority":
                       group_stat(["test_type", "priority"], "waiting_time_minutes")},
            description="Predict diagnostic test waiting time (minutes) at request",
        ),
    ]
