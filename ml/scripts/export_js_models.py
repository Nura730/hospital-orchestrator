"""Export trained LightGBM models to compact JSON so the Node backend and the browser can run them
without Python, plus a parity fixture (inputs + Python predictions) that the JS tests check against.

Usage (from ml/):  python scripts/export_js_models.py

Writes:
  ../backend/src/ml/models/<name>.json
  ../frontend/src/ml/models/<name>.json
  ../backend/tests/fixtures/<name>_parity.json
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.training import patients, predict  # noqa: E402

REPO = ROOT.parent
TARGETS = [REPO / "backend" / "src" / "ml" / "models", REPO / "frontend" / "src" / "ml" / "models"]
FIXTURES = REPO / "backend" / "tests" / "fixtures"

# Models that the app can feed from its own data (see ml/INTEGRATION.md)
EXPORT = ["icu_need"]

MISSING = {"None": 0, "Zero": 1, "NaN": 2}


def encode_tree(root):
    """Flatten one tree. Internal node:
    [feature, threshold|categories, kind, default_left, missing, left, right, internal_value]
    kind 0 = numeric (<=), 1 = categorical (==). Child >= 0 is a node index; child < 0 is leaf ~child.
    internal_value lets the JS side attribute each prediction to features (path contributions)."""
    nodes, leaves = [], []

    def visit(n):
        if "leaf_value" in n:
            leaves.append(float(n["leaf_value"]))
            return -len(leaves)  # == ~(index)
        idx = len(nodes)
        nodes.append(None)
        categorical = n["decision_type"] == "=="
        threshold = [int(c) for c in str(n["threshold"]).split("||")] if categorical else float(n["threshold"])
        left, right = visit(n["left_child"]), visit(n["right_child"])
        nodes[idx] = [n["split_feature"], threshold, 1 if categorical else 0, 1 if n["default_left"] else 0,
                      MISSING[n["missing_type"]], left, right, float(n.get("internal_value", 0.0))]
        return idx

    visit(root)
    return {"nodes": nodes, "leaves": leaves}


def export(name):
    bundle = predict.load_model(name)
    booster = bundle["model"].booster_
    dump = booster.dump_model()
    assert dump["feature_names"] == bundle["features"], "feature order mismatch"
    objective = dump["objective"].split()[0]
    sigmoid = 1.0
    for part in dump["objective"].split()[1:]:
        if part.startswith("sigmoid:"):
            sigmoid = float(part.split(":")[1])
    out = {
        "name": name,
        "objective": objective,
        "sigmoid": sigmoid,
        "targetTransform": bundle.get("target_transform"),
        "features": bundle["features"],
        "categories": bundle["categories"],
        "trees": [encode_tree(t["tree_structure"]) for t in dump["tree_info"]],
    }
    text = json.dumps(out, separators=(",", ":"))
    for t in TARGETS:
        t.mkdir(parents=True, exist_ok=True)
        (t / f"{name}.json").write_text(text)
    print(f"{name}: {len(out['trees'])} trees, {len(text) / 1024:.0f} KB")


def icu_parity(n=3000, seed=7):
    """Random raw patients (including missing values) with Python predictions."""
    rng = np.random.default_rng(seed)
    start = pd.Timestamp("2026-01-01")
    rows = []
    for _ in range(n):
        arrival = start + pd.Timedelta(minutes=int(rng.integers(0, 60 * 24 * 365)))
        acuity = int(rng.integers(1, 6))
        rows.append({
            "age": None if rng.random() < 0.05 else int(rng.integers(0, 100)),
            "gender": rng.choice(["M", "F", "F", "M", None]),
            "acuity_level": acuity,
            "priority": rng.choice(["CRITICAL", "HIGH", "MEDIUM", "LOW", "ELECTIVE", None]),
            "requires_ot": int(rng.random() < 0.2),
            "requires_diagnostic": int(rng.random() < 0.5),
            "diagnostic_type": rng.choice(["CT", "LAB", "MRI", "ULTRASOUND", "XRAY", None]),
            "arrival_time": arrival.strftime("%Y-%m-%dT%H:%M:%S"),
        })
    df = pd.DataFrame(rows)
    df["age"] = pd.to_numeric(df["age"], errors="coerce")
    for c in ("gender", "priority", "diagnostic_type"):
        df[c] = df[c].where(df[c].notna(), np.nan)  # missing -> NaN -> 'nan' (as in training CSVs)
    df["arrival_time"] = pd.to_datetime(df["arrival_time"])
    df["admission_time"] = df["arrival_time"]
    prob = predict.predict("icu_need", patients.build_features(df))
    FIXTURES.mkdir(parents=True, exist_ok=True)
    cases = [{**r, "expected": float(p)} for r, p in zip(rows, prob)]
    (FIXTURES / "icu_need_parity.json").write_text(json.dumps(cases, default=lambda o: None if o is None else str(o)))
    print(f"icu_need parity fixture: {len(cases)} cases")


if __name__ == "__main__":
    for m in EXPORT:
        export(m)
    icu_parity()
