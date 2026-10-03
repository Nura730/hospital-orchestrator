"""Cross-table context features (all computed from information known at query time t)."""
import numpy as np
import pandas as pd

from .common import load


def _ns(s):
    return pd.to_datetime(s, errors="coerce").to_numpy("datetime64[ns]")


def active_count(starts, ends, query):
    """Number of intervals with start <= t < end, for each t in query."""
    s, e, q = _ns(starts), _ns(ends), _ns(query)
    ok = ~np.isnat(s)
    s, e = s[ok], e[ok]
    e = np.where(np.isnat(e), np.datetime64("2262-01-01"), e)  # still open
    return (np.searchsorted(np.sort(s), q, "right") - np.searchsorted(np.sort(e), q, "right")).clip(0)


def window_count(times, query, hours):
    """Events in (t - hours, t] if hours > 0, or (t, t + |hours|] if hours < 0."""
    t, q = np.sort(_ns(times)[~np.isnat(_ns(times))]), _ns(query)
    d = np.timedelta64(abs(hours), "h")
    if hours > 0:
        return np.searchsorted(t, q, "right") - np.searchsorted(t, q - d, "right")
    return np.searchsorted(t, q + d, "right") - np.searchsorted(t, q, "right")


def grouped(fn, df_events, ev_group, query_df, q_group, *cols, **kw):
    """Apply a counting fn per group (e.g. per department)."""
    out = np.zeros(len(query_df), dtype=float)
    qg = query_df[q_group].astype(str).to_numpy()
    eg = df_events[ev_group].astype(str)
    for g in np.unique(qg):
        m = qg == g
        ev = df_events[eg == g]
        out[m] = fn(*[ev[c] for c in cols], query_df.loc[m, kw.pop("qcol", None) or kw["q"]], **{
            k: v for k, v in kw.items() if k != "q"}) if len(ev) else 0
    return out


# ------------------------------------------------------------------ wait-time context
def ed_queue_context(ed):
    """Queue state when each ED patient arrives (others who arrived but are not yet seen)."""
    q = ed["arrival_time"]
    ed["queue_ahead_total"] = active_count(ed["arrival_time"], ed["service_start_time"], q) - 1
    rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    pr = ed["priority"].map(rank).fillna(3).to_numpy()
    ahead_same_or_higher = np.zeros(len(ed))
    for p in range(4):
        sub = ed[pr <= p]
        m = pr == p
        ahead_same_or_higher[m] = active_count(sub["arrival_time"], sub["service_start_time"], q[m]) - 1
    ed["queue_ahead_same_or_higher"] = ahead_same_or_higher.clip(0)
    ed["queue_ahead_total"] = ed["queue_ahead_total"].clip(lower=0)
    tr = load("transfers")
    ed_out = tr[tr["from_department"] == "ED"]
    ed["ed_boarding_pending"] = active_count(ed_out["request_time"], ed_out["transfer_complete_time"], q)
    return ed, ["queue_ahead_total", "queue_ahead_same_or_higher", "ed_boarding_pending"]


def diagnostics_context(dg):
    """Backlog per test type / machine at the moment a test is requested."""
    q = dg["request_time"]
    feats = []
    for key, name in (("test_type", "backlog_same_test"), ("equipment_id", "backlog_same_machine")):
        out = np.zeros(len(dg))
        for g, idx in dg.groupby(key).groups.items():
            sub = dg.loc[idx]
            out[dg.index.get_indexer(idx)] = active_count(sub["request_time"], sub["start_time"], sub["request_time"]) - 1
        dg[name] = out.clip(0)
        feats.append(name)
    dg["backlog_total"] = (active_count(dg["request_time"], dg["start_time"], q) - 1).clip(0)
    in_service = np.zeros(len(dg))
    for g, idx in dg.groupby("test_type").groups.items():
        sub = dg.loc[idx]
        in_service[dg.index.get_indexer(idx)] = active_count(sub["start_time"], sub["completion_time"], sub["request_time"])
    dg["in_service_same_test"] = in_service
    return dg, feats + ["backlog_total", "in_service_same_test"]


# ------------------------------------------------------------------ pressure context
def department_context(hourly):
    """Inflow signals per department-hour: ED arrivals, admissions, pending transfers, upcoming OT."""
    t = hourly["timestamp"]
    ed = load("ed_queue")
    pts = load("patients")
    tr = load("transfers")
    ot = load("ot_schedule")
    hourly["hosp_ed_arrivals_prev_1h"] = window_count(ed["arrival_time"], t, 1)
    hourly["hosp_ed_arrivals_prev_3h"] = window_count(ed["arrival_time"], t, 3)
    hourly["hosp_ed_waiting_now"] = active_count(ed["arrival_time"], ed["service_start_time"], t)
    feats = ["hosp_ed_arrivals_prev_1h", "hosp_ed_arrivals_prev_3h", "hosp_ed_waiting_now"]
    cols = {k: np.zeros(len(hourly)) for k in
            ("dept_admissions_prev_3h", "dept_transfers_pending_in", "dept_transfers_pending_out",
             "dept_ot_next_4h", "dept_ot_running")}
    for dep, idx in hourly.groupby("department").groups.items():
        pos = hourly.index.get_indexer(idx)
        qt = t.loc[idx]
        p = pts[pts["department"] == dep]
        cols["dept_admissions_prev_3h"][pos] = window_count(p["admission_time"], qt, 3)
        ti = tr[tr["to_department"] == dep]
        cols["dept_transfers_pending_in"][pos] = active_count(ti["request_time"], ti["transfer_complete_time"], qt)
        to = tr[tr["from_department"] == dep]
        cols["dept_transfers_pending_out"][pos] = active_count(to["request_time"], to["transfer_complete_time"], qt)
        o = ot if dep == "OT" else ot[ot["department"] == dep]
        cols["dept_ot_next_4h"][pos] = window_count(o["start_time"], qt, -4)  # scheduled ahead
        cols["dept_ot_running"][pos] = active_count(o["start_time"], o["end_time"], qt)
    for k, v in cols.items():
        hourly[k] = v
    return hourly, feats + list(cols)
