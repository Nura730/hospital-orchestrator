# MediOrchestra Backend

> Production-ready Hospital Management System Backend built with Node.js, Express.js, PostgreSQL (Neon DB), Socket.IO, and Zod.

---

## 📋 Architecture & Design Principles

MediOrchestra implements a strict layered architecture:
```
routes ➔ controllers ➔ services ➔ repositories ➔ db.js
```
- **Zero SQL outside repositories**: All queries, parameterized statements, and aggregations live strictly in `src/repositories/`.
- **Thin controllers**: Controllers only validate inputs, call services, and return standardized envelopes.
- **Role Isolation**: Strict data segregation between Hospital Admin, Doctor, and OT Manager. Doctors can **never** see private clinical data of patients not assigned to them.
- **Real-Time Synchronization**: Native Socket.IO room management with JWT handshake authentication.
- **Automated Operations**: Cron-based background jobs for OT overruns, tiered alert escalation, and periodic KPI snapshots.

---

## 🚀 Quick Start Guide

### 1. Database Setup (Neon PostgreSQL)
1. Sign up or log into [Neon Console](https://console.neon.tech).
2. Create a new project (e.g. `mediorchestra-db`).
3. Copy your database connection string with SSL enabled:
   ```
   postgresql://[user]:[password]@[endpoint].neon.tech/neondb?sslmode=require
   ```

### 2. Environment Configuration
Copy the example environment configuration:
```bash
cp .env.example .env
```
Fill in your database URL and a 32+ character JWT secret:
```ini
DATABASE_URL=postgresql://[user]:[password]@[endpoint].neon.tech/neondb?sslmode=require
JWT_SECRET=mediorchestra_super_secure_jwt_secret_key_2024_minimum_32_characters_long
```

### 3. Install, Migrate & Seed
```bash
# Install dependencies
npm install

# Apply database schema and seed realistic hospital data
npm run db:setup

# Start development server with auto-reload
npm run dev
```

The server will start on port `3001` (or your configured `PORT`).

---

## 👥 Demo Credentials

All seed accounts are initialized with realistic hospital data:

| Role | Email | Password | Scope & Access |
|------|-------|----------|----------------|
| **Hospital Admin** | `admin@hospital.com` | `Admin@1234` | Master hospital dashboard, manage doctors, patients, beds, alerts, and approvals |
| **Hospital Admin** | `superadmin@hospital.com` | `Admin@1234` | Full system control and audit access |
| **Doctor (Cardiology)** | `arjun.menon@hospital.com` | `Doctor@1234` | Private Doctor Dashboard, assigned patients, schedule, OT requests |
| **Doctor (Neurology)** | `vikram.seth@hospital.com` | `Doctor@1234` | Private Doctor Dashboard, surgical queue |
| **OT Manager** | `otmanager1@hospital.com` | `OTManager@1234` | OT rooms management, doctor availability matching, surgery starts & completes |
| **OT Manager** | `otmanager2@hospital.com` | `OTManager@1234` | Flow coordinator, schedule & delay adjustments |

---

## 🌐 API Envelope Standard

All responses strictly follow the MediOrchestra envelope:

```json
{
  "ok": true,
  "data": { ... },
  "error": null,
  "meta": { ... }
}
```

Error responses:
```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "ROOM_CONFLICT",
    "message": "OT Room 1 is already booked during this timeframe"
  },
  "meta": { ... }
}
```

---

## 🧪 Testing with cURL

### 1. Authenticate (Login as Admin)
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hospital.com","password":"Admin@1234","userType":"admin"}'
```
*Save the returned `data.token` as `ADMIN_TOKEN`.*

### 2. View Master Admin Dashboard
```bash
curl -X GET http://localhost:3001/api/v1/admin/dashboard \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 3. Authenticate as Doctor
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"arjun.menon@hospital.com","password":"Doctor@1234","userType":"doctor"}'
```
*Save the returned `data.token` as `DOCTOR_TOKEN`.*

### 4. View Doctor-Specific Dashboard
```bash
curl -X GET http://localhost:3001/api/v1/doctor/dashboard \
  -H "Authorization: Bearer $DOCTOR_TOKEN"
```

### 5. Check Doctor Availability for OT (OT Manager)
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"otmanager1@hospital.com","password":"OTManager@1234","userType":"ot_manager"}'
```
*Save token as `OT_TOKEN`.*

```bash
curl -X GET "http://localhost:3001/api/v1/ot/available-doctors?specialization=Cardiology" \
  -H "Authorization: Bearer $OT_TOKEN"
```

### 6. View OT Gantt Timeline
```bash
curl -X GET http://localhost:3001/api/v1/ot/timeline \
  -H "Authorization: Bearer $OT_TOKEN"
```

---

## ⚡ Socket.IO Event Reference

Socket clients authenticate during handshake with JWT:
```js
const socket = io('http://localhost:3001', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});
```

### Event Catalog:

| Event Name | Payload | Room / Recipient | Trigger Scenario |
|------------|---------|------------------|------------------|
| `bed.updated` | `{ bedId, status, patientId }` | Broadcast | Bed status changed (occupied, cleaning, available) |
| `patient.updated` | `{ patientId, status, acuity }` | Broadcast | Patient acuity or status altered |
| `ot.caseStarted` | `{ caseId, roomId, surgeonName, patientName }` | Broadcast | Surgery started in room |
| `ot.caseCompleted`| `{ caseId, roomId, duration, nextStatus }` | Broadcast | Surgery finished; room moves to cleaning |
| `ot.overrun` | `{ caseId, roomId, overrunMinutes }` | `admin`, `ot_manager` | Case surpasses scheduled end time |
| `doctor.statusChanged` | `{ doctorId, name, newStatus, location }` | Broadcast | Doctor availability changes |
| `alert.created` | `{ alertId, severity, title, department }` | `admin`, `ot_manager` | Critical alert generated |
| `alert.escalated` | `{ alertId, newLevel }` | `admin`, `ot_manager` | Alert unacknowledged after 5/10 min |
| `kpi.updated` | `{ totalPatients, bedOccupancyPct, ... }` | `admin` | 5-minute snapshot computed |
| `notification.new` | `{ userId, notification }` | `user-{userId}` | Personal surgery or assignment alert |

---

## 📦 NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run dev` | `nodemon src/server.js` | Dev server with hot-reload |
| `npm start` | `node src/server.js` | Production server |
| `npm run db:schema` | Applies `db/schema.sql` | Builds tables, enums, triggers |
| `npm run db:seed` | Runs `db/seed.js` | Seeds realistic hospital data |
| `npm run db:reset` | Runs `db/reset.js` | Drops all tables & recreates schema |
| `npm run db:setup` | Schema + Seed | One-command fresh database setup |
| `npm test` | `jest --runInBand` | Runs all API and isolation tests |
| `npm run lint` | `eslint src/` | Code quality verification |
| `npm run format` | `prettier --write src/` | Formats all code files |
