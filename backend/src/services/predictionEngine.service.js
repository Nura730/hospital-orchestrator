/**
 * Prediction engine — uses ONLY historical data already stored in Neon (no external ML).
 *
 * CALC 1 forecastArrivals            weighted same-hour/same-weekday average, 80% band
 * CALC 2 estimateAdmissionProbability acuity base + risk factors
 * CALC 3 predictLOS                   average LOS by (acuity, department) of discharged patients
 * CALC 4 projectBedDemand             occupied + expected admissions − expected discharges
 * CALC 5 scoreDischargeReadiness      rule score → probability + blocking factors
 */
const db = require('../config/db');
const flowRepo = require('../repositories/flow.repo');
const flowConfig = require('../config/flowConfig');
const AppError = require('../utils/AppError');
const { ADMISSION_BASE_BY_ACUITY, LOS_DEFAULT_HOURS } = require('../config/constants');

const Z_80 = 1.28;
const WEEK_WEIGHTS = [4, 3, 2, 1]; // most recent week weighs most
const DEMAND_HORIZONS = [1, 2, 4, 6];

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/* ───────────────────────── CALC 1 ───────────────────────── */

/**
 * Pure forecast from history rows. Exported for unit tests.
 * @param {{hour_start: Date|string, arrivals: number}[]} history last 28 days, any order
 * @param {Date} now
 * @param {number} horizonHours
 */
function forecastFromHistory(history, now, horizonHours) {
  const byKey = new Map(); // "dow-hour" → [{weeksAgo, arrivals}]
  const nowMs = now.getTime();
  for (const row of history) {
    const t = new Date(row.hour_start);
    const key = `${t.getUTCDay()}-${t.getUTCHours()}`;
    const weeksAgo = Math.min(3, Math.max(0, Math.floor((nowMs - t.getTime()) / (7 * 24 * 3600 * 1000))));
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ weeksAgo, arrivals: Number(row.arrivals) });
  }

  const base = new Date(now);
  base.setUTCMinutes(0, 0, 0);

  const timestamps = [];
  const predicted = [];
  const lower = [];
  const upper = [];
  const samples = [];

  for (let h = 1; h <= horizonHours; h++) {
    const t = new Date(base.getTime() + h * 3600 * 1000);
    const pts = byKey.get(`${t.getUTCDay()}-${t.getUTCHours()}`) || [];
    let forecast = 0;
    let sd = 0;
    if (pts.length > 0) {
      const mean = pts.reduce((s, p) => s + p.arrivals, 0) / pts.length;
      sd = Math.sqrt(pts.reduce((s, p) => s + (p.arrivals - mean) ** 2, 0) / pts.length);
      let wSum = 0;
      let wTotal = 0;
      for (const p of pts) {
        const w = WEEK_WEIGHTS[p.weeksAgo] || 1;
        wSum += p.arrivals * w;
        wTotal += w;
      }
      forecast = wSum / wTotal;
    }
    timestamps.push(t.toISOString());
    predicted.push(round(forecast));
    lower.push(round(Math.max(0, forecast - Z_80 * sd)));
    upper.push(round(forecast + Z_80 * sd));
    samples.push(pts.length);
  }

  const avgSamples = samples.reduce((s, n) => s + n, 0) / Math.max(1, samples.length);
  // 4 samples (one per week) = full confidence for this method
  const confidence = round(Math.min(0.92, 0.45 + (avgSamples / 4) * 0.45), 2);

  return { timestamps, predicted, lower, upper, samples, confidence };
}

/**
 * CALC 1 — forecast hourly arrivals for a department (or hospital-wide when departmentId is null).
 */
async function forecastArrivals(departmentId = null, horizonHours = flowConfig.PREDICTION_HORIZON_HOURS, client) {
  const executor = client || db;
  const horizon = Math.max(1, Math.min(24, Number(horizonHours) || 6));
  const params = [];
  let deptFilter = '';
  if (departmentId) {
    params.push(Number(departmentId));
    deptFilter = `AND department_id = $1`;
  }
  const res = await executor.query(
    `SELECT hour_start, SUM(arrivals)::int AS arrivals, SUM(admitted)::int AS admitted
     FROM arrivals_history
     WHERE hour_start >= NOW() - INTERVAL '28 days' AND hour_start < NOW() ${deptFilter}
     GROUP BY hour_start`,
    params
  );
  const result = forecastFromHistory(res.rows, new Date(), horizon);
  const totalArr = res.rows.reduce((s, r) => s + r.arrivals, 0);
  const totalAdm = res.rows.reduce((s, r) => s + r.admitted, 0);
  return {
    departmentId: departmentId ? Number(departmentId) : null,
    horizonHours: horizon,
    ...result,
    historicalAdmissionRate: totalArr > 0 ? round(totalAdm / totalArr, 3) : 0.35,
    historyRows: res.rows.length,
  };
}

/* ───────────────────────── CALC 2 ───────────────────────── */

/**
 * CALC 2 — pure admission probability.
 * @param {{ acuity: number, requires_icu?: boolean, requires_isolation?: boolean, arrivalTime?: Date|string }} patient
 */
function estimateAdmissionProbability(patient) {
  const acuity = Number(patient.acuity) || 3;
  const base = ADMISSION_BASE_BY_ACUITY[acuity] ?? 0.6;
  const factors = [{ factor: `Acuity ${acuity}`, impact: base }];
  let p = base;

  if (patient.requires_icu || patient.requiresIcu) {
    p += 0.1;
    factors.push({ factor: 'Requires ICU', impact: 0.1 });
  }
  if (patient.requires_isolation || patient.requiresIsolation) {
    p += 0.05;
    factors.push({ factor: 'Requires isolation', impact: 0.05 });
  }
  const arrival = patient.arrivalTime ? new Date(patient.arrivalTime) : new Date();
  const hour = arrival.getHours();
  if (hour >= 22 || hour < 6) {
    p += 0.15;
    factors.push({ factor: 'Night arrival (22:00-06:00)', impact: 0.15 });
  }

  const probability = round(Math.min(0.99, p), 2);
  return { probability, factors };
}

async function admissionProbabilityForPatient(patientId) {
  const patient = await flowRepo.getPatientById(patientId);
  if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');
  const arrivalTime = patient.waiting_since || patient.admission_date || patient.created_at;
  return {
    patientId: patient.id,
    alias: patient.patient_id,
    acuity: patient.acuity,
    ...estimateAdmissionProbability({ ...patient, arrivalTime }),
  };
}

/* ───────────────────────── CALC 3 ───────────────────────── */

/** Average LOS (hours) grouped by acuity + department from discharged patients. */
async function getLosTable(client) {
  const res = await (client || db).query(`
    SELECT acuity, department_id,
           AVG(EXTRACT(EPOCH FROM (discharge_date - admission_date)) / 3600)::float AS avg_hours,
           COUNT(*)::int AS sample_count
    FROM patients
    WHERE status = 'discharged' AND discharge_date IS NOT NULL AND admission_date IS NOT NULL
      AND discharge_date > admission_date AND acuity IS NOT NULL
    GROUP BY acuity, department_id
  `);
  const table = new Map();
  for (const r of res.rows) table.set(`${r.acuity}-${r.department_id}`, r);
  return table;
}

/** Pure LOS prediction from a precomputed table. */
function predictLosFromTable(patient, table) {
  const acuity = Number(patient.acuity) || 3;
  const row = table.get(`${acuity}-${patient.department_id}`);
  const sampleCount = row ? row.sample_count : 0;
  const predictedHours = row ? round(row.avg_hours) : LOS_DEFAULT_HOURS[acuity] || 48;
  const admission = patient.admission_date ? new Date(patient.admission_date) : new Date();
  const expectedReleaseTime = new Date(admission.getTime() + predictedHours * 3600 * 1000).toISOString();
  const confidence = round(Math.min(0.92, 0.5 + sampleCount / 100), 2);
  const hoursRemaining = round((new Date(expectedReleaseTime).getTime() - Date.now()) / 3600000);
  return { predictedHours, expectedReleaseTime, confidence, sampleCount, hoursRemaining };
}

/** CALC 3 — predict LOS for one patient. */
async function predictLOS(patientId) {
  const patient = await flowRepo.getPatientById(patientId);
  if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');
  if (patient.bed_id) {
    const b = await db.query('SELECT department_id FROM beds WHERE id = $1', [patient.bed_id]);
    if (b.rows[0]) patient.department_id = b.rows[0].department_id;
  }
  const table = await getLosTable();
  return { patientId: patient.id, alias: patient.patient_id, ...predictLosFromTable(patient, table) };
}

/* ───────────────────────── CALC 4 ───────────────────────── */

async function getDepartmentSnapshot(departmentId, client) {
  const executor = client || db;
  const res = await executor.query(
    `SELECT d.id, d.name,
       COUNT(b.id) FILTER (WHERE b.status <> 'maintenance')::int AS capacity,
       COUNT(b.id) FILTER (WHERE b.status = 'occupied')::int AS occupied
     FROM departments d LEFT JOIN beds b ON b.department_id = d.id
     WHERE d.id = $1 GROUP BY d.id`,
    [departmentId]
  );
  return res.rows[0] || null;
}

/** Expected discharges within the window, weighted by release confidence. */
async function predictedDischarges(departmentId, horizonHours, client) {
  const res = await (client || db).query(
    `SELECT COALESCE(SUM(COALESCE(release_confidence, 0.7)), 0)::float AS expected, COUNT(*)::int AS beds
     FROM beds
     WHERE department_id = $1 AND status = 'occupied'
       AND expected_release_time IS NOT NULL
       AND expected_release_time <= NOW() + ($2 || ' hours')::interval`,
    [departmentId, String(horizonHours)]
  );
  return { expected: round(res.rows[0].expected), beds: res.rows[0].beds };
}

/** Blend of historical admission rate and current waiting-room acuity mix. */
async function weightedAdmissionRate(departmentId, historicalRate, client) {
  const res = await (client || db).query(
    `SELECT acuity, requires_icu, requires_isolation, waiting_since FROM patients
     WHERE status = 'waiting' AND department_id = $1`,
    [departmentId]
  );
  if (res.rows.length === 0) return historicalRate;
  const live =
    res.rows.reduce((s, p) => s + estimateAdmissionProbability({ ...p, arrivalTime: p.waiting_since }).probability, 0) /
    res.rows.length;
  return round(0.5 * historicalRate + 0.5 * live, 3);
}

/**
 * CALC 4 — projected bed demand for one horizon.
 * @returns {{ demand, capacity, gap, shortage, horizon, currentOccupied, expectedArrivals, expectedAdmissions, expectedDischarges, admissionRate }}
 */
async function projectBedDemand(departmentId, horizonHours = 2, ctx = {}) {
  const dept = ctx.dept || (await getDepartmentSnapshot(departmentId));
  if (!dept) throw new AppError('Department not found', 404, 'NOT_FOUND');
  const forecast = ctx.forecast || (await forecastArrivals(departmentId, Math.max(6, horizonHours)));
  const h = Number(horizonHours);
  const expectedArrivals = forecast.predicted.slice(0, h).reduce((s, v) => s + v, 0);
  const rate = ctx.rate ?? (await weightedAdmissionRate(departmentId, forecast.historicalAdmissionRate));
  const discharges = await predictedDischarges(departmentId, h);
  const expectedAdmissions = expectedArrivals * rate;
  const demand = round(dept.occupied + expectedAdmissions - discharges.expected);
  const gap = round(demand - dept.capacity);
  return {
    departmentId: dept.id,
    department: dept.name,
    horizon: h,
    currentOccupied: dept.occupied,
    capacity: dept.capacity,
    expectedArrivals: round(expectedArrivals),
    admissionRate: rate,
    expectedAdmissions: round(expectedAdmissions),
    expectedDischarges: discharges.expected,
    demand,
    gap,
    shortage: gap > 0,
    predictedUtilization: dept.capacity > 0 ? round(Math.max(0, demand) / dept.capacity, 3) : 0,
    confidence: forecast.confidence,
  };
}

/** CALC 4 for the standard horizons [1h, 2h, 4h, 6h] with shared lookups. */
async function projectBedDemandAll(departmentId, horizons = DEMAND_HORIZONS) {
  const dept = await getDepartmentSnapshot(departmentId);
  if (!dept) throw new AppError('Department not found', 404, 'NOT_FOUND');
  const forecast = await forecastArrivals(departmentId, Math.max(...horizons));
  const rate = await weightedAdmissionRate(departmentId, forecast.historicalAdmissionRate);
  const out = [];
  for (const h of horizons) out.push(await projectBedDemand(departmentId, h, { dept, forecast, rate }));
  return out;
}

/* ───────────────────────── CALC 5 ───────────────────────── */

/**
 * CALC 5 — pure discharge readiness score.
 * @param {object} patient row from flowRepo.getActivePatients
 */
function scoreDischargeReadiness(patient, now = new Date()) {
  let score = 0;
  const blockingFactors = [];
  const acuity = Number(patient.acuity) || 3;

  if (acuity >= 4) score += 40;
  else blockingFactors.push(`Clinical acuity ${acuity}: not yet stable`);

  if (!patient.requires_imaging) score += 20;
  else blockingFactors.push('Imaging pending');

  const exp = patient.expected_discharge ? new Date(patient.expected_discharge) : null;
  if (exp && exp.getTime() < now.getTime() + 4 * 3600 * 1000) score += 30;
  else blockingFactors.push(exp ? 'Expected discharge beyond 4h' : 'No expected discharge time');

  if (patient.discharge_date) score += 10;
  else blockingFactors.push('Discharge date not set');

  for (const task of patient.pending_tasks || []) blockingFactors.push(task);

  score = Math.min(100, score);
  return { score, probability: round(score / 100, 2), blockingFactors };
}

async function dischargeReadinessForPatient(patientId) {
  const rows = await flowRepo.getActivePatients({ patientId });
  if (!rows[0]) throw new AppError('Active patient not found', 404, 'NOT_FOUND');
  return { patientId, alias: rows[0].alias, ...scoreDischargeReadiness(rows[0]) };
}

/**
 * Discharge candidates: every active in-bed patient scored and sorted by readiness.
 */
async function getDischargeCandidates({ doctorId } = {}) {
  const [patients, losTable] = await Promise.all([
    flowRepo.getActivePatients(doctorId ? { doctorId } : {}),
    getLosTable(),
  ]);
  const threshold = flowConfig.DISCHARGE_NUDGE_THRESHOLD;
  const rows = patients
    .filter((p) => p.bed_id)
    .map((p) => {
      const r = scoreDischargeReadiness(p);
      const los = predictLosFromTable(p, losTable);
      const adminOnlyBlocked = r.score >= 90 && (p.pending_tasks || []).length > 0;
      return {
        patientId: p.id,
        alias: p.alias,
        acuity: p.acuity,
        status: p.status,
        ward: p.ward,
        bedId: p.bed_id,
        departmentId: p.department_id,
        department: p.department_name,
        doctorId: p.assigned_doctor_id,
        doctorName: p.doctor_name,
        admittedAt: p.admission_date,
        expectedDischarge: p.expected_discharge,
        pendingTasks: p.pending_tasks || [],
        score: r.score,
        probability: r.probability,
        blockingFactors: r.blockingFactors,
        ready: r.probability >= threshold,
        adminOnlyBlocked,
        los,
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    threshold,
    readyCount: rows.filter((r) => r.ready).length,
    candidates: rows,
  };
}

module.exports = {
  DEMAND_HORIZONS,
  forecastFromHistory,
  forecastArrivals,
  estimateAdmissionProbability,
  admissionProbabilityForPatient,
  getLosTable,
  predictLosFromTable,
  predictLOS,
  predictedDischarges,
  projectBedDemand,
  projectBedDemandAll,
  scoreDischargeReadiness,
  dischargeReadinessForPatient,
  getDischargeCandidates,
};
