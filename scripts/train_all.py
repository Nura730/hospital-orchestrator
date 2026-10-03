"""Train every Medi-Orchestrator model and write metrics + report.

Usage: python scripts/train_all.py
"""
import json
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.training import demand, patients, pressure, wait_time  # noqa: E402
from src.training.common import REPORTS  # noqa: E402

FMT = {"MAE": "{:.3f}", "RMSE": "{:.3f}", "MAPE": "{:.1f}%", "R2": "{:.3f}",
       "ROC_AUC": "{:.3f}", "PR_AUC": "{:.3f}", "F1_best": "{:.3f}", "Recall_at_90_precision": "{:.3f}"}


def fmt(k, v):
    return "-" if v is None else FMT.get(k, "{}").format(v)


def write_report(results, seconds):
    lines = [
        "# Medi-Orchestrator — Training Report", "",
        f"Generated {datetime.now():%Y-%m-%d %H:%M} · {len(results)} models · {seconds:.0f}s total", "",
        "## Summary", "",
        "| Model | Target | Train/Val/Test | Key metric | LightGBM | Best baseline | Improvement |",
        "|---|---|---|---|---|---|---|",
    ]
    for r in results:
        k = r["key_metric"]
        base = {b: m[k] for b, m in r["metrics"].items() if b != "LightGBM"}
        best = (max if k == "ROC_AUC" else min)(base.values())
        lines.append(
            f"| `{r['name']}` | {r['target']} | {r['n_train']}/{r['n_val']}/{r['n_test']} | {k} | "
            f"{fmt(k, r['metrics']['LightGBM'][k])} | {fmt(k, best)} | "
            f"{'✅' if r['beats_baseline'] else '❌'} {r['improvement_pct']:+.1f}% |")
    lines += ["", "> Splits are chronological (70/15/15). ED and diagnostic test sets exclude "
              "patients seen in training. Data in `data/` is partly synthetic (up-sampled), so "
              "treat absolute scores as optimistic.", ""]

    for r in results:
        metric_names = list(r["metrics"]["LightGBM"].keys())
        lines += [f"## {r['name']}", "", f"{r['description']} · best iteration {r['best_iteration']}", "",
                  "| Model | " + " | ".join(metric_names) + " |",
                  "|---|" + "---|" * len(metric_names)]
        for model, m in r["metrics"].items():
            lines.append(f"| {model} | " + " | ".join(fmt(k, m[k]) for k in metric_names) + " |")
        lines += ["", "Top features: " + ", ".join(f"`{f}`" for f, _ in r["top_features"][:8]), "",
                  f"![{r['name']}](figures/{r['name']}.png)", ""]
    (REPORTS / "training_report.md").write_text("\n".join(lines), encoding="utf-8")


def main():
    REPORTS.mkdir(exist_ok=True)
    start = time.time()
    results = []
    for module in (pressure, demand, patients, wait_time):
        t = time.time()
        print(f"Training {module.__name__.split('.')[-1]} ...", flush=True)
        results += module.train()
        print(f"  done in {time.time() - t:.1f}s")
    seconds = time.time() - start

    (REPORTS / "metrics.json").write_text(json.dumps(results, indent=2))
    write_report(results, seconds)

    print(f"\n{'Model':28s} {'Metric':8s} {'LightGBM':>10s} {'Improvement':>12s}")
    print("-" * 62)
    for r in results:
        k = r["key_metric"]
        print(f"{r['name']:28s} {k:8s} {r['metrics']['LightGBM'][k]:10.3f} "
              f"{r['improvement_pct']:+11.1f}% {'OK' if r['beats_baseline'] else 'BELOW BASELINE'}")
    print(f"\nReport: {REPORTS / 'training_report.md'}  ({seconds:.0f}s)")


if __name__ == "__main__":
    main()
