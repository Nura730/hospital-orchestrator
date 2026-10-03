# MediOrchestra — Hospital Orchestration System

> AI-assisted, real-time clinical and operational hospital orchestration platform designed for Hospital Administrators, Doctors, and Operation Theatre (OT) Managers.

---

## 📁 Repository Structure

```
hospital-orchestrator/
├── backend/                  # Production-ready Node.js & Express REST + Socket.IO API
│   ├── db/                   # Database schema, seed data, and migration scripts
│   ├── src/                  # Controllers, services, repositories, routes, sockets, jobs
│   ├── tests/                # Jest integration and isolation test suite
│   ├── openapi.yaml          # OpenAPI 3.0.3 specification
│   ├── package.json          # Backend dependencies and scripts
│   └── README.md             # Detailed backend architecture and API reference
│
├── frontend/                 # Modern React 18 + Vite + Tailwind CSS dashboard application
│   ├── src/                  # Pages, components, Zustand stores, ChartJS visualizations
│   ├── package.json          # Frontend dependencies and scripts
│   └── vite.config.js        # Vite configuration with API and Socket reverse proxy
│
└── README.md                 # Project overview and quick start guide
```

---

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend

# 1. Configure environment
cp .env.example .env
# Update .env with your PostgreSQL (Neon DB) credentials & JWT secret

# 2. Install dependencies
npm install

# 3. Apply schema and seed data
npm run db:setup

# 4. Start backend server (runs on port 3001)
npm run dev

# (Optional) Run test suite
npm test
```

For comprehensive details on API endpoints, role-based access, and Socket.IO events, see [`backend/README.md`](file:///c:/Users/aruns/Desktop/hospital-orchestrator/backend/README.md).

---

### 2. Frontend Setup

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Configure environment (optional, defaults to mock/local)
cp .env.example .env

# 3. Start development server (runs on port 5173)
npm run dev

# 4. Build for production
npm run build
```

---

## 👥 Demo Credentials

| Role | Email | Password | Scope & Access |
|------|-------|----------|----------------|
| **Hospital Admin** | `admin@hospital.com` | `Admin@1234` | Master hospital dashboard, resource allocation, and approvals |
| **Doctor (Cardiology)** | `arjun.menon@hospital.com` | `Doctor@1234` | Doctor Dashboard, assigned patients, clinical schedules |
| **OT Manager** | `otmanager1@hospital.com` | `OTManager@1234` | OT suites management, surgeon matching, surgery timeline |

---

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js, PostgreSQL (Neon DB), Socket.IO, Zod, Jest, Supertest
- **Frontend**: React 18, Vite, Tailwind CSS, Zustand, Chart.js, Lucide Icons, Date-fns
