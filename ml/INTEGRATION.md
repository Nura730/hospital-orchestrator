# ML models: analysis and integration

The `ml/` folder holds the LightGBM models trained on the `aadhavan` branch (training code in `src/training/`,
metrics in `reports/training_report.md`). This note records which models the app uses, why, and how to update them.

## What is integrated

**`icu_need`**: probability that an arriving patient will need an ICU bed (ROC-AUC 0.975 vs 0.939 for the
"ICU rate per acuity" baseline, chronological test split).

It only needs data the app already stores: age, gender, acuity, priority (derived from acuity), planned surgery,
diagnostics and arrival time. The model runs **in JavaScript** (no Python service):

| Where | What it does |
|---|---|
| Ambulance incoming (backend `stateEngine`, frontend mock) | Decides whether to reserve an ICU bed (was: `acuity === 1`). An explicit `requiresIcu` from the crew still wins. The banner shows "ICU need NN% (model)". |
| Doctor > My Patient Predictions, Doctor > My Patients | "ICU risk" column for patients not already in ICU. |
| Patient Detail popup | "ICU risk (model)" with the main reasons (path contributions, e.g. "Acuity raises"). |
| API | `GET /api/v1/flow/icu-risk/:patientId`; `icuRisk` on `GET /flow/doctor/patients`. |

Thresholds: `>= 0.5` needs ICU (`high`), `>= 0.2` ICU watch, otherwise `low` (`backend/src/ml/icuNeed.js`).
The model was trained with balanced class weights, so probabilities run high; 0.5 favours recall, which suits
bed preparation.

### How it runs in JS

`scripts/export_js_models.py` dumps the trees to compact JSON (`backend/src/ml/models/`, `frontend/src/ml/models/`)
and writes a parity fixture of 3000 random patients with Python predictions. `backend/tests/ml.icuNeed.test.js`
checks the JS evaluator matches Python on every case (max difference < 1e-9; measured 2e-16), that the
explanation contributions add up to the score, and basic clinical ordering. The browser copy is lazy-loaded
(separate 149 KB gzip chunk).

## What is not integrated (and why)

| Model | Reason |
|---|---|
| `length_of_stay` | Barely reacts to acuity (acuity 1 ~34 h, acuity 5 ~35 h); its signal comes almost entirely from `admit_delay_hours`, a pattern of the partly synthetic data. LOS was also removed from the UI by product decision. |
| `pressure_*` (6 models) | Tested and rejected: they do not transfer to this hospital (see below). They also need a 24 h hourly history per department of queue length, pressure score, waiting time and staff/resource gaps, which the app does not record. |
| `resource_demand`, `resource_demand_stacked` | Depend on an external forecaster's `predicted_demand_*` columns that the app does not have. The plain model does not beat persistence. |
| `ed_wait_time`, `diagnostic_wait_time` | Essentially no better than a median per priority (R2 about 0); would add noise. |

## Why the pressure models are not used (tested 2026-10-04)

The six `pressure_*` models beat persistence by about 25% on their own test split, so they were tried as the
source of the department forecasts (Bottleneck Map, Command Center). Fed with the app's departments
(Emergency = ED, General Ward = MEDICINE, Radiology, HDU, ICU, OT), a steady 48 h history and the current
occupancy, they pull every department towards the training hospital's average within one hour:

| Department | Now | t+1h | t+4h | t+24h |
|---|---|---|---|---|
| ICU | 92% | 74% | 70% | 59% |
| OT | 100% | 72% | 66% | 45% |
| General Ward | 82% | 73% | 69% | 61% |
| Emergency | 60% | 68% | 72% | 68% |

An ICU with 11 of 12 beds taken does not free two beds in an hour. The cause is visible in the trees: the
highest `utilization_percent` split is 82.5% and the highest `occupancy_ratio` split is about 1.0, so the
models cannot tell 85% from 100%, which is exactly the range where this app raises alarms. Their test MAE
(about 15 utilization points) is also wider than the warning band (70 to 90%). Using them would hide real
bottlenecks, so the app keeps its arrival-history forecast (`predictionEngine.service.js`, CALC 1 and 4).
To revisit: log hourly `department_state` rows from this hospital, retrain, and repeat this check.

## Fix made to the training code

On pandas 3, `astype(str)` keeps missing values missing, whereas the models were trained (pandas 2) with missing
categories spelled `"nan"`, which the model learned as a real category ("no diagnostic test"). `predict()` therefore
silently mis-scored every patient without a diagnostic type on pandas 3 (e.g. 0.28 instead of 0.52), and
retraining could fail when sorting categories. `common.as_category_text()` now maps missing to `"nan"` explicitly
in both `encode_categories()` and `predict()`, so behaviour is identical on any pandas version.

## Updating the model

```bash
cd ml
python scripts/train_all.py          # needs the datasets in ml/data/ (git-ignored)
python scripts/export_js_models.py   # re-export JSON + parity fixture
cd ../backend && npx jest tests/ml.icuNeed.test.js
```
