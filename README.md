# MediOrchestra

A live hospital command system for five roles: hospital admin, doctor, OT manager, nurse and patient.
It predicts where patient flow will jam, routes every request to the person who handles it, and keeps every
screen in sync as people act.

---

## What it does

**One live hospital, five roles.** A patient request reaches the right person and every step comes back to the
patient. Every open screen updates as it happens, across browser tabs, with no refresh.

| Request | Goes to | What happens next |
|---|---|---|
| General Query, Medication Query | The patient's doctor | Doctor marks it seen, replies, or sends it to the theatre team. OT books a surgeon and theatre; the patient, doctor and bedside nurse are told. |
| Nurse Assistance, Dietary, Bed transfer, Equipment | The bedside nurse, as a task | Starting the task shows "In progress" to the patient; finishing it resolves the request. |

The patient's own doctor sees every request from their patients (marked "You are kept informed") and is
notified at each step. A patient without a bed is routed to their doctor, so no request is left without someone
who can act on it.

**Surgery workflow.** The OT manager sees each request's path (patient, doctor, theatre team) and who hears back,
picks a free surgeon and theatre (the page suggests the next free slot), and books it. The nurse gets pre-op and
transport tasks; when surgery starts the old bed goes to housekeeping; when it ends the patient moves to a
recovery bed and the surgeon is free again; the doctor can then move the patient back to a ward.

**Flow intelligence (admin).**
- **Command Center:** key numbers, department status with a capacity runway ("Full in ~2 h 40 min"), an action
  queue, the Emergency forecast and a live activity log.
- **Bottleneck Map:** names the root-cause department (the earliest one at the worst severity), shows the patient
  flow chain with runway timers, a pressure outlook and recommended actions with the rule behind each.
- **Mass-casualty mode:** one switch admits a first wave of casualties, raises expected arrivals, moves elective
  surgery to tomorrow, flags ready discharges, alerts all staff and shows a red banner with the capacity runway in
  every role's app.
- What-If Simulator, Discharge Planner, Live Bed Map, Housekeeping, Staff, Patient Journey and Audit Log.

**Alerts.** The bell shows each person only their own notifications. Optional desktop alerts (switch in the bell
menu) pop up when the tab is in the background, with a tone for urgent ones. Toasts can be dismissed.

### Screens by role

| Role | Screens |
|---|---|
| Admin | Dashboard, Command Center, Bottleneck Map, What-If Simulator, Discharge Planner, Live Bed Map, Patients, Staff and Doctors, Nurse Management, Patient Journey, Housekeeping, Audit Log |
| Doctor | Dashboard, Today's Schedule, My Patients, Requests, OT Cases, Calendar, My Patient Predictions |
| OT Manager | OT dashboard (rooms, requests waiting, surgeons, timeline), OT Requests, Surgeons, Flow Impact |
| Nurse | My Shift, My Patients, Tasks, Bed Board, Notifications |
| Patient | My Status, My Treatment, Reports, Requests, Help |

Clicking a patient anywhere opens the shared patient popup (overview, ICU risk with reasons and what-ifs,
treatment journey, printable report). Light and dark themes are switched from the top bar.

---

## Machine learning (`ml/`)

Twelve LightGBM models were trained on hospital flow data (`ml/src/training`, report in `ml/reports`).

| Model | Status | Where |
|---|---|---|
| `icu_need` | **In use.** ROC-AUC 0.975 vs 0.939 for the per-acuity baseline. | Ambulance ICU-bed reservation, "ICU risk" on doctor views and OT requests, patient popup with reasons and what-ifs ("if acuity improves to 3, ICU risk drops 48 points"). |
| `pressure_utilization_t1h/t4h/t24h` | **Experimental, display only.** | "Model outlook, next 24 hours" table on the Bottleneck Map. Not used for alerts: on this hospital they pull full departments toward the training average (ICU 92% to 74% in an hour). |
| Other 8 | Not used | No better than a simple baseline, or need data the app does not record. |

The models run in JavaScript (backend and browser), with no Python service. Parity tests prove the JavaScript
gives the same answers as Python: 3,000 patients for `icu_need` (max difference 2e-16) and 7,200 predictions for
the outlook (difference 0). Full analysis and how to re-export after retraining: [`ml/INTEGRATION.md`](ml/INTEGRATION.md).

---

## Repository structure

```
hospital-orchestrator/
├── backend/     Node.js + Express REST API, Socket.IO, PostgreSQL; flow engine, ICU model, Jest tests
├── frontend/    React 18 + Vite + Tailwind; role screens, in-browser demo hospital, models, parity test
├── ml/          Training code, trained models, reports, export script, INTEGRATION.md
└── README.md
```

---

## Quick start

### Frontend (works on its own in demo mode)

```bash
cd frontend
npm install
cp .env.example .env      # VITE_USE_MOCK=true runs the full demo hospital in the browser
npm run dev               # http://localhost:5173 (Vite picks the next free port if busy)
npm run build             # production build
```

In demo mode the whole hospital (beds, patients, theatres, requests, tasks, notifications) runs in the browser
and is shared live between tabs of the same browser. Open one tab per role to watch a request move through the
hospital. **Command Center > Demo > Reset** puts the demo hospital back to its starting state.

### Backend (optional)

```bash
cd backend
cp .env.example .env      # set DATABASE_URL (PostgreSQL / Neon) and JWT_SECRET (16+ characters)
npm install
npm run db:setup          # schema and seed data
npm run db:setup:flow     # flow-intelligence tables and seed
npm run dev               # http://localhost:3001
npm test                  # Jest suite
```

Set `VITE_USE_MOCK=false` and `VITE_API_URL` in `frontend/.env` to use the backend. API details:
[`backend/README.md`](backend/README.md) and [`backend/openapi.yaml`](backend/openapi.yaml).

---

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Hospital Admin | `admin@hospital.com` | `Admin@1234` |
| Doctor | `vikram.seth@hospital.com` | `Doctor@1234` |
| OT Manager | `otmanager1@hospital.com` | `OTManager@1234` |
| Nurse | `nurse@hospital.com` | `Nurse@1234` |
| Patient | `patient@hospital.com` | `Patient@1234` |

Wrong passwords are rejected, and each browser tab keeps its own sign-in, so one browser can hold all five roles.

**What runs where.** The backend provides authentication, role checks, the flow engine (events, bottlenecks,
forecasts, discharge readiness, what-if simulation), the ICU model and the AI report. The nurse and patient
accounts, the request and surgery workflow, mass-casualty mode and desktop alerts currently run in the in-browser
demo hospital (`frontend/src/api/mock/careMock.js`, called through `frontend/src/api/careApi.js`). Moving them to
the backend means adding the matching tables and routes and swapping those calls.

---

## Security

JWT sign-in with bcrypt-hashed passwords; role checks on every route; a doctor can only open their own patients;
request validation with Zod and parameterised SQL; rate limiting that counts failed logins; Helmet headers; CORS
allow-list (any localhost port outside production); audit trail for clinical changes. Secrets live in `backend/.env`,
which is never committed; the config is validated at start-up.

---

## Testing

| What | How |
|---|---|
| Backend unit and API tests, including ICU model parity | `cd backend && npm test` (32 tests) |
| Outlook model parity (browser vs Python) | `cd frontend && node tests/outlookParity.mjs` |
| End-to-end | Signs in as all five roles, opens every page, clicks every button and runs an accessibility scan; a five-tab live workflow test and a request-flow test cover every request route. |

---

## Technology

- **Backend:** Node.js, Express, PostgreSQL, Socket.IO, Zod, Jest, Supertest
- **Frontend:** React 18, Vite, Tailwind CSS, Zustand, Chart.js, Lucide icons
- **ML:** LightGBM, pandas, scikit-learn (training); models exported to JSON and evaluated in JavaScript
