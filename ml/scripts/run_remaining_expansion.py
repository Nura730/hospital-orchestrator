import subprocess
import sys
import time

FILES = [
    "ed_queue.csv",
    "transfers.csv",
    "patients.csv",
    "ot_schedule.csv",
    "resources.csv",
    "waiting_times.csv",
    "simulation_results.csv",
    "resource_demand.csv",
    "scenarios.csv",
    "staff.csv"
]

print(f"Starting expansion for {len(FILES)} remaining files...", flush=True)

for i, fname in enumerate(FILES, 1):
    t0 = time.time()
    print(f"\n==================================================", flush=True)
    print(f"[{i}/{len(FILES)}] Starting {fname}...", flush=True)
    cmd = [sys.executable, "scripts/expand_features.py", "--file", fname]
    res = subprocess.run(cmd)
    dt = time.time() - t0
    if res.returncode == 0:
        print(f"[{i}/{len(FILES)}] Finished {fname} in {dt:.1f}s", flush=True)
    else:
        print(f"[{i}/{len(FILES)}] FAILED {fname} in {dt:.1f}s", flush=True)

print("\nAll files successfully processed!", flush=True)
