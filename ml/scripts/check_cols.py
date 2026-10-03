import os
import csv

data_dir = 'data'
files = sorted([f for f in os.listdir(data_dir) if f.endswith('.csv')])

print(f"{'File':<40} {'Rows':>8} {'Cols':>8}  Status", flush=True)
print('-' * 70, flush=True)
for f in files:
    path = os.path.join(data_dir, f)
    with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
        line = fp.readline()
        if not line:
            cols, rows = 0, 0
        else:
            cols = len(next(csv.reader([line])))
            rows = sum(1 for _ in fp)
    row_ok = "OK" if rows >= 10000 else f"SHORT ({rows})"
    col_ok = "OK" if cols >= 10000 else f"SHORT ({cols})"
    status = f"Rows: {row_ok:<12} Cols: {col_ok}"
    print(f"{f:<40} {rows:>8} {cols:>8}  {status}", flush=True)
