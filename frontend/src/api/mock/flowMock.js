/**
 * @file flowMock.js
 * Offline mock for the Predictive Flow Intelligence API (used only in mock mode).
 * Mirrors the backend engines on an in-memory hospital with the same layout as `npm run seed:flow`,
 * and emits the same socket events through the mock liveEmitter.
 */

import { liveEmitter } from './liveEmitter.js';
import { loadIcuModel, predictIcuNeed } from '../../ml/icuNeed.js';

const WARN = 0.75;
const DANGER = 0.88;
const NUDGE = 0.6;
const CHAIN = ['Emergency', 'Radiology', 'General Ward', 'HDU', 'ICU', 'OT'];
const ADMIT_BASE = { 1: 0.95, 2: 0.8, 3: 0.6, 4: 0.3, 5: 0.1 };
const LOS_DEFAULT = { 1: 120, 2: 72, 3: 48, 4: 24, 5: 8 };
const ARRIVAL_PROFILE = {
  Emergency: { base: 4, rate: 0.32 },
  Radiology: { base: 2.5, rate: 0.15 },
  'General Ward': { base: 1.4, rate: 0.9 },
  HDU: { base: 0.45, rate: 0.9 },
  ICU: { base: 0.35, rate: 0.95 },
  OT: { base: 0.6, rate: 0.9 },
};
const H = 3600 * 1000;
const MIN = 60 * 1000;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pad = (n) => String(n).padStart(2, '0');
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;
const iso = (ms) => new Date(ms).toISOString();
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

let S = null;
let analysisTimer = null;
let lastAnalysisAt = null;

const DOCTORS = [
  { id: 'doc-lin', name: 'Dr. Sarah Lin, MD', specialization: 'Internal Medicine', department: 'General Ward', status: 'available' },
  { id: 'doc-seth', name: 'Dr. Vikram Seth', specialization: 'General Medicine', department: 'General Ward', status: 'in_consultation' },
  { id: 'doc-chen', name: 'Dr. David Chen', specialization: 'Hospitalist', department: 'General Ward', status: 'available' },
  { id: 'doc-menon', name: 'Dr. Arjun Menon', specialization: 'Cardiothoracic Surgery', department: 'ICU', status: 'in_surgery' },
  { id: 'doc-rao', name: 'Dr. Kavita Rao', specialization: 'Critical Care', department: 'ICU', status: 'available' },
  { id: 'doc-roy', name: 'Dr. Anita Roy', specialization: 'Pulmonology', department: 'HDU', status: 'on_break' },
  { id: 'doc-patel', name: 'Dr. Sunita Patel', specialization: 'Emergency Medicine', department: 'Emergency', status: 'available' },
  { id: 'doc-khan', name: 'Dr. Sameer Khan', specialization: 'Trauma', department: 'Emergency', status: 'emergency' },
  { id: 'doc-nair', name: 'Dr. Priya Nair', specialization: 'Anesthesiology', department: 'OT', status: 'in_surgery' },
  { id: 'doc-hughes', name: 'Dr. Nathan Hughes', specialization: 'Orthopedics', department: 'OT', status: 'available' },
  { id: 'doc-santos', name: 'Dr. Maria Santos', specialization: 'Radiology', department: 'Radiology', status: 'off_duty' },
];
const ME_DOCTOR = 'doc-lin';

/* ───────────────────────── state ───────────────────────── */

function buildState() {
  const rand = rng(1337);
  const beds = [];
  const add = (prefix, n, zone, department, type, ward, floor) => {
    for (let i = 1; i <= n; i++) beds.push({ id: `${prefix}-${pad(i)}`, zone, department, type, ward, floor, status: 'available', patientId: null, expectedRelease: null, releaseConfidence: null, lastCleanedAt: iso(Date.now() - (2 + rand() * 20) * H), cleaningSince: null });
  };
  add('ED', 15, 'ED', 'Emergency', 'ed', 'Emergency Observation', '1');
  add('RAD', 4, 'Radiology', 'Radiology', 'general', 'Imaging Bay', '1');
  add('GW', 25, 'General Ward', 'General Ward', 'general', 'Main Medical Ward', '2');
  add('ISO', 6, 'General Ward', 'General Ward', 'isolation', 'Negative Pressure Isolation', '2');
  add('PO', 9, 'PACU', 'General Ward', 'post_op', 'Post-Operative Recovery Ward', '4');
  add('HDU', 8, 'HDU', 'HDU', 'hdu', 'High Dependency Ward', '3');
  add('ICU', 12, 'ICU', 'ICU', 'icu', 'Critical Care Unit', '3');

  const occupied = [
    ...['ICU-01', 'ICU-02', 'ICU-03', 'ICU-05', 'ICU-06', 'ICU-07', 'ICU-08', 'ICU-09', 'ICU-10', 'ICU-11', 'ICU-12'],
    ...['HDU-01', 'HDU-02', 'HDU-03', 'HDU-04', 'HDU-05'],
    ...Array.from({ length: 25 }, (_, i) => `GW-${pad(i + 1)}`),
    'ISO-01', 'ISO-02', 'ISO-03', 'ISO-04', 'PO-01', 'PO-02', 'PO-03', 'PO-04',
    ...Array.from({ length: 9 }, (_, i) => `ED-${pad(i + 1)}`),
    'RAD-01', 'RAD-02',
  ];
  const dirty = ['ED-10', 'ISO-05', 'PO-05', 'PO-06', 'PO-07'];
  const trio = { 'GW-03': ['Pharmacy reconciliation pending', 1.5, 4], 'GW-07': ['Transport not booked', 2, 5], 'GW-12': ['Discharge summary unsigned', 3, 4] };
  const patients = [];
  const now = Date.now();
  occupied.forEach((bedId, i) => {
    const bed = beds.find((b) => b.id === bedId);
    const zone = bed.zone;
    let acuity = zone === 'ICU' ? (rand() < 0.5 ? 1 : 2) : zone === 'HDU' ? (rand() < 0.6 ? 2 : 3) : zone === 'ED' ? (rand() < 0.5 ? 3 : 4) : zone === 'Radiology' ? 3 : 2 + Math.floor(rand() * 3);
    let requiresImaging = zone === 'Radiology' || acuity >= 4 || rand() < 0.2;
    let pending = [];
    let expH;
    let dischargeDate = null;
    let conf = 0.6 + rand() * 0.3;
    const deptDocs = DOCTORS.filter((d) => d.department === bed.department);
    let doctor = deptDocs.length ? deptDocs[i % deptDocs.length] : DOCTORS[0];
    if (trio[bedId]) {
      const [task, hours, a] = trio[bedId];
      acuity = a;
      requiresImaging = false;
      pending = [task];
      expH = hours;
      dischargeDate = iso(now + (hours + 0.5) * H);
      conf = 0.85;
      doctor = DOCTORS[0];
    } else if (zone === 'Radiology') {
      expH = 0.5 + rand() * 0.4;
      conf = 0.9;
    } else if (zone === 'ED') {
      expH = 3 + rand() * 7;
    } else {
      expH = { 1: 60, 2: 36, 3: 20, 4: 10, 5: 6 }[acuity] * (0.5 + rand());
      if (bedId === 'ICU-02') expH = 0.4;
    }
    if (zone === 'PACU') doctor = DOCTORS.find((d) => d.id === 'doc-hughes');
    if (doctor.id === ME_DOCTOR && !trio[bedId] && i % 3 !== 0) doctor = DOCTORS[1];
    const admitted = now - (zone === 'ED' ? 1 + rand() * 6 : zone === 'Radiology' ? 0.5 + rand() : 12 + rand() * 96) * H;
    const demo = rng(9000 + i);
    const p = {
      id: `pt-${i + 1}`,
      alias: `PF${String(i + 1).padStart(3, '0')}`,
      age: zone === 'ICU' || zone === 'HDU' ? 45 + Math.floor(demo() * 45) : 18 + Math.floor(demo() * 70),
      gender: demo() < 0.5 ? 'M' : 'F',
      acuity,
      status: acuity <= 2 ? 'critical' : 'admitted',
      bedId,
      department: bed.department,
      doctorId: doctor.id,
      doctorName: doctor.name,
      admittedAt: iso(admitted),
      expectedDischarge: iso(now + expH * H),
      dischargeDate,
      requiresImaging,
      requiresIcu: acuity === 1,
      requiresOt: zone === 'PACU',
      pendingTasks: pending,
      waitingSince: null,
    };
    patients.push(p);
    Object.assign(bed, { status: 'occupied', patientId: p.id, expectedRelease: p.expectedDischarge, releaseConfidence: r1(conf * 100) / 100 });
  });
  for (const id of dirty) Object.assign(beds.find((b) => b.id === id), { status: 'cleaning', cleaningSince: iso(now - 35 * MIN) });
  [
    ['PFW1', 2, 25],
    ['PFW2', 3, 40],
    ['PFW3', 3, 70],
  ].forEach(([alias, acuity, mins], i) => {
    patients.push({ id: `pw-${i + 1}`, alias, acuity, status: 'waiting', bedId: null, department: 'Emergency', doctorId: 'doc-patel', doctorName: 'Dr. Sunita Patel', admittedAt: null, expectedDischarge: null, dischargeDate: null, requiresImaging: false, requiresIcu: false, pendingTasks: [], waitingSince: iso(now - mins * MIN) });
  });

  const otRooms = [
    { id: 1, name: 'OT-1', status: 'in_surgery' },
    { id: 2, name: 'OT-2', status: 'in_surgery' },
    { id: 3, name: 'OT-3', status: 'cleaning' },
    { id: 4, name: 'OT-4', status: 'reserved' },
  ];
  const cases = [
    { id: 'case-1', caseNumber: 'OTC-2024-001', procedure: 'Coronary Artery Bypass Grafting', roomId: 1, surgeon: 'Dr. Arjun Menon', anesthetist: 'Dr. Priya Nair', status: 'in_progress', urgency: 'urgent', start: now - 70 * MIN, end: now + 30 * MIN, postOpRequired: true, postOpWard: 'ICU', postOpBedId: null, patientAlias: 'P2024005' },
    { id: 'case-2', caseNumber: 'OTC-2024-002', procedure: 'Lumbar Spinal Fusion', roomId: 2, surgeon: 'Dr. Nathan Hughes', anesthetist: 'Dr. Priya Nair', status: 'in_progress', urgency: 'elective', start: now - 70 * MIN, end: now + 70 * MIN, postOpRequired: true, postOpWard: 'Post-Operative Recovery Ward', postOpBedId: null, patientAlias: 'P2024011' },
    { id: 'case-3', caseNumber: 'OTC-2024-003', procedure: 'Aortic Valve Replacement', roomId: 4, surgeon: 'Dr. Arjun Menon', status: 'scheduled', urgency: 'urgent', start: now + 40 * MIN, end: now + 130 * MIN, postOpRequired: true, postOpWard: 'ICU', patientAlias: 'P2024014' },
    { id: 'case-4', caseNumber: 'OTC-2024-004', procedure: 'Craniotomy', roomId: 3, surgeon: 'Dr. Nathan Hughes', status: 'scheduled', urgency: 'emergency', start: now + 90 * MIN, end: now + 180 * MIN, postOpRequired: true, postOpWard: 'ICU', patientAlias: 'P2024019' },
    { id: 'case-5', caseNumber: 'OTC-2024-005', procedure: 'Laparoscopic Cholecystectomy', roomId: 4, surgeon: 'Dr. Nathan Hughes', status: 'scheduled', urgency: 'elective', start: now + 160 * MIN, end: now + 230 * MIN, postOpRequired: true, postOpWard: 'Post-Operative Recovery Ward', patientAlias: 'P2024021' },
    { id: 'case-6', caseNumber: 'OTC-2024-006', procedure: 'Hip Arthroplasty', roomId: 3, surgeon: 'Dr. Nathan Hughes', status: 'scheduled', urgency: 'elective', start: now + 240 * MIN, end: now + 330 * MIN, postOpRequired: true, postOpWard: 'Post-Operative Recovery Ward', patientAlias: 'P2024022' },
  ];
  const staffPlan = [['Emergency', 3, 1, 1], ['General Ward', 7, 1, 2], ['ICU', 5, 1, 1], ['HDU', 2, 0, 0], ['OT', 1, 0, 0]];
  const staff = [];
  let n = 1;
  for (const [dept, nurses, floats, hk] of staffPlan) {
    for (let i = 0; i < nurses; i++) staff.push({ id: n, name: `Nurse ${pad(n++)}`, role: 'nurse', department: dept, onShift: true });
    for (let i = 0; i < floats; i++) staff.push({ id: n, name: `Nurse ${pad(n++)}`, role: 'float_nurse', department: dept, onShift: dept !== 'Emergency' });
    for (let i = 0; i < hk; i++) staff.push({ id: n, name: `Housekeeping ${pad(n++)}`, role: 'housekeeping', department: dept, onShift: true });
  }
  const kpiSeries = { occupancy: [], icu: [], avgWait: [], otUtil: [] };
  for (let i = 24; i >= 0; i--) {
    const t = now - i * H;
    const h = new Date(t).getUTCHours();
    kpiSeries.occupancy.push({ ts: iso(t), value: r1(72 + 4 * Math.sin((2 * Math.PI * (h - 8)) / 24) + rand() * 2) });
    kpiSeries.icu.push({ ts: iso(t), value: r1(84 + 6 * Math.sin((2 * Math.PI * (h - 6)) / 24) + rand() * 3) });
    kpiSeries.avgWait.push({ ts: iso(t), value: r1(28 + 8 * Math.sin((2 * Math.PI * (h - 10)) / 24) + rand() * 4) });
    kpiSeries.otUtil.push({ ts: iso(t), value: r1(62 + 18 * Math.sin((2 * Math.PI * (h - 9)) / 24) + rand() * 5) });
  }
  return {
    beds,
    patients,
    otRooms,
    cases,
    staff,
    kpiSeries,
    surgeFactor: 1,
    recommendations: [],
    events: [],
    simulations: [],
    notifications: [
      { id: uid('n'), type: 'alert', title: 'ICU at 92% occupancy', message: '11 of 12 ICU beds occupied.', isRead: false, createdAt: iso(now - 12 * MIN) },
      { id: uid('n'), type: 'general', title: 'Housekeeping: 5 beds waiting', message: 'ED-10, ISO-05, PO-05, PO-06, PO-07', isRead: false, createdAt: iso(now - 30 * MIN) },
    ],
  };
}

function st() {
  if (!S) {
    S = buildState();
    startAnalysisLoop();
  }
  return S;
}

const emit = (event, payload) => {
  try {
    liveEmitter.emit(event, payload);
  } catch {
    /* ignore */
  }
};
const delay = () => new Promise((r) => setTimeout(r, 150 + Math.random() * 200));

function logEvent(type, payload, result) {
  const e = { id: uid('evt'), eventType: type, payload, processed: true, result, createdAt: new Date().toISOString(), user: 'Demo user', userType: 'admin' };
  st().events.unshift(e);
  return e;
}

function notify(title, message, type = 'general') {
  const n = { id: uid('n'), type, title, message, isRead: false, createdAt: new Date().toISOString() };
  st().notifications.unshift(n);
  emit('notification.new', { notification: n });
  return n;
}

function addRec(rec) {
  const r = { id: uid('rec'), status: 'pending', risk: 'low', createdAt: new Date().toISOString(), ...rec };
  st().recommendations.unshift(r);
  emit('recommendation.new', r);
  return r;
}

/* ───────────────────────── engines ───────────────────────── */

function deptStats(name) {
  const s = st();
  if (name === 'OT') {
    const cap = s.otRooms.filter((r) => r.status !== 'maintenance').length;
    const busy = s.otRooms.filter((r) => ['in_surgery', 'cleaning', 'reserved', 'emergency'].includes(r.status)).length;
    return { name, capacity: cap, occupied: s.otRooms.filter((r) => r.status === 'in_surgery').length, busy, cleaning: s.otRooms.filter((r) => r.status === 'cleaning').length, available: s.otRooms.filter((r) => r.status === 'available').length };
  }
  const beds = s.beds.filter((b) => b.department === name);
  return {
    name,
    capacity: beds.filter((b) => b.status !== 'blocked').length,
    occupied: beds.filter((b) => b.status === 'occupied').length,
    cleaning: beds.filter((b) => b.status === 'cleaning').length,
    reserved: beds.filter((b) => b.status === 'reserved').length,
    available: beds.filter((b) => b.status === 'available').length,
  };
}

function forecast(dept, horizon = 6) {
  const p = ARRIVAL_PROFILE[dept] || ARRIVAL_PROFILE.Emergency;
  const base = new Date();
  base.setUTCMinutes(0, 0, 0);
  const out = { timestamps: [], predicted: [], lower: [], upper: [], samples: [] };
  const factor = dept === 'Emergency' || !dept ? st().surgeFactor : 1;
  for (let h = 1; h <= horizon; h++) {
    const t = new Date(base.getTime() + h * H);
    const v = p.base * factor * (0.62 + 0.38 * Math.sin((2 * Math.PI * (t.getUTCHours() - 8)) / 24));
    const sd = p.base * 0.18;
    out.timestamps.push(t.toISOString());
    out.predicted.push(r1(v));
    out.lower.push(r1(Math.max(0, v - 1.28 * sd)));
    out.upper.push(r1(v + 1.28 * sd));
    out.samples.push(4);
  }
  return { departmentId: dept, horizonHours: horizon, ...out, confidence: 0.9, historicalAdmissionRate: p.rate, historyRows: 672 };
}

function admissionProbability(p, arrival = new Date()) {
  const a = Number(p.acuity) || 3;
  let prob = ADMIT_BASE[a] ?? 0.6;
  const factors = [{ factor: `Acuity ${a}`, impact: prob }];
  if (p.requiresIcu) {
    prob += 0.1;
    factors.push({ factor: 'Requires ICU', impact: 0.1 });
  }
  if (p.requiresIsolation) {
    prob += 0.05;
    factors.push({ factor: 'Requires isolation', impact: 0.05 });
  }
  const h = new Date(arrival).getHours();
  if (h >= 22 || h < 6) {
    prob += 0.15;
    factors.push({ factor: 'Night arrival (22:00-06:00)', impact: 0.15 });
  }
  return { probability: Math.round(Math.min(0.99, prob) * 100) / 100, factors };
}

function los(p) {
  const hours = LOS_DEFAULT[p.acuity] || 48;
  const admitted = p.admittedAt ? new Date(p.admittedAt).getTime() : Date.now();
  const sample = 8 + ((p.acuity || 3) * 3);
  const expected = iso(admitted + hours * H);
  return { predictedHours: hours, expectedReleaseTime: expected, confidence: Math.round(Math.min(0.92, 0.5 + sample / 100) * 100) / 100, sampleCount: sample, hoursRemaining: r1((new Date(expected).getTime() - Date.now()) / H) };
}

function readiness(p) {
  let score = 0;
  const blocking = [];
  if (p.acuity >= 4) score += 40;
  else blocking.push(`Clinical acuity ${p.acuity}: not yet stable`);
  if (!p.requiresImaging) score += 20;
  else blocking.push('Imaging pending');
  const exp = p.expectedDischarge ? new Date(p.expectedDischarge).getTime() : null;
  if (exp && exp < Date.now() + 4 * H) score += 30;
  else blocking.push(exp ? 'Expected discharge beyond 4h' : 'No expected discharge time');
  if (p.dischargeDate) score += 10;
  else blocking.push('Discharge date not set');
  for (const t of p.pendingTasks || []) blocking.push(t);
  return { score, probability: score / 100, blockingFactors: blocking };
}

function dischargeCandidates() {
  const s = st();
  const rows = s.patients
    .filter((p) => p.bedId && p.status !== 'discharged' && p.status !== 'waiting')
    .map((p) => {
      const r = readiness(p);
      const bed = s.beds.find((b) => b.id === p.bedId);
      return {
        patientId: p.id,
        alias: p.alias,
        acuity: p.acuity,
        status: p.status,
        ward: bed ? bed.ward : null,
        bedId: p.bedId,
        department: p.department,
        doctorId: p.doctorId,
        doctorName: p.doctorName,
        admittedAt: p.admittedAt,
        expectedDischarge: p.expectedDischarge,
        pendingTasks: p.pendingTasks,
        ...r,
        ready: r.probability >= NUDGE,
        los: los(p),
      };
    })
    .sort((a, b) => b.score - a.score);
  return { threshold: NUDGE, readyCount: rows.filter((r) => r.ready).length, candidates: rows };
}

function demand(dept, h) {
  const d = deptStats(dept);
  const f = forecast(dept, Math.max(6, h));
  const arrivals = f.predicted.slice(0, h).reduce((a, b) => a + b, 0);
  const rate = f.historicalAdmissionRate;
  const discharges = st()
    .beds.filter((b) => b.department === dept && b.status === 'occupied' && b.expectedRelease && new Date(b.expectedRelease).getTime() <= Date.now() + h * H)
    .reduce((a, b) => a + (b.releaseConfidence || 0.7), 0);
  const dem = r1(d.occupied + arrivals * rate - discharges);
  return { department: dept, horizon: h, currentOccupied: d.occupied, capacity: d.capacity, expectedArrivals: r1(arrivals), admissionRate: rate, expectedAdmissions: r1(arrivals * rate), expectedDischarges: r1(discharges), demand: dem, gap: r1(dem - d.capacity), shortage: dem - d.capacity > 0, predictedUtilization: d.capacity ? r3(Math.max(0, dem) / d.capacity) : 0, confidence: f.confidence };
}

function nursesOn(dept) {
  return st().staff.filter((x) => x.department === dept && x.role === 'nurse' && x.onShift).length;
}

function actionsFor(b, all) {
  const out = [];
  const idx = all.findIndex((x) => x.department === b.department);
  const next = all[idx + 1];
  if (b.cleaning > 2) out.push({ type: 'cleaning', department: b.department, count: b.cleaning, text: `Prioritize cleaning of ${b.cleaning} empty beds in ${b.department}`, impact: `+${b.cleaning} beds within ~45 min`, why: `${b.cleaning} beds in ${b.department} are in 'cleaning' status (rule: more than 2 dirty beds)` });
  if (b.dischargeReady > 0) out.push({ type: 'discharge', department: b.department, count: b.dischargeReady, text: `Expedite discharge for ${b.dischargeReady} medically ready patients`, impact: `+${b.dischargeReady} beds within ~2h`, why: `${b.dischargeReady} patients score at or above 60% discharge readiness` });
  if (b.utilization > 0.9) {
    const prev = all[idx - 1];
    const target = [next, b.department === 'ICU' ? prev : null].find((t) => t && t.department !== 'OT' && t.utilization < 0.7 && t.capacity > 0);
    if (target) {
      const n = Math.max(1, Math.min(target.available || 1, Math.ceil(b.occupied - 0.85 * b.capacity)));
      out.push({ type: 'transfer', department: b.department, targetDepartment: target.department, count: n, text: `Move ${n} stable patient${n > 1 ? 's' : ''} to ${target.department}`, impact: `${b.department} utilization -${Math.round((n / b.capacity) * 100)} pts`, why: `${b.department} is at ${Math.round(b.utilization * 100)}% (rule: >90%) while ${target.department} is at ${Math.round(target.utilization * 100)}% (rule: <70%)` });
    }
  }
  const typical = (ARRIVAL_PROFILE[b.department]?.base || 0) * 2 * 0.62;
  if (b.expectedArrivals2h > typical * 1.25 * (st().surgeFactor > 1 ? 0.8 : 1.6) && b.expectedAdmissions2h >= 1) {
    const n = Math.max(1, Math.round(b.expectedAdmissions2h * 0.5));
    out.push({ type: 'reserve', department: b.department, count: n, text: `Reserve ${n} bed${n > 1 ? 's' : ''} for incoming high-acuity patients`, impact: `Avoids ~${n * 20} min boarding delay`, why: `Forecast ${b.expectedArrivals2h} arrivals in 2h is above the usual level for this hour` });
  }
  if (b.department !== 'OT' && b.nursesOnShift > 0 && b.occupied / b.nursesOnShift > 4) {
    const donor = all.filter((x) => x.department !== b.department && x.department !== 'OT' && x.nursesOnShift > 1).sort((a, c) => a.occupied / a.nursesOnShift - c.occupied / c.nursesOnShift)[0];
    if (donor && donor.occupied / donor.nursesOnShift < 3) out.push({ type: 'staffing', department: b.department, sourceDepartment: donor.department, count: 1, text: `Reassign a nurse from ${donor.department} to ${b.department}`, impact: `Nurse ratio 1:${(b.occupied / b.nursesOnShift).toFixed(1)} to 1:${(b.occupied / (b.nursesOnShift + 1)).toFixed(1)}`, why: `${b.department} has 1 nurse per ${(b.occupied / b.nursesOnShift).toFixed(1)} patients (safe limit 1:4)` });
  }
  return out.map((a, i) => ({ id: `${b.department}-${a.type}-${i}`.replace(/\s+/g, '_'), ...a }));
}

function analyse() {
  const cands = dischargeCandidates();
  const readyBy = {};
  for (const c of cands.candidates) if (c.ready) readyBy[c.department] = (readyBy[c.department] || 0) + 1;
  const depts = CHAIN.map((name) => {
    const d = deptStats(name);
    if (name === 'OT') {
      const upcoming = st().cases.filter((c) => c.status === 'scheduled' && c.start <= Date.now() + 2 * H).length;
      const util = d.capacity ? r3(d.busy / d.capacity) : 0;
      const gap = Math.max(0, d.busy + upcoming * 0.5 - d.capacity);
      return { department: name, departmentId: name, floor: '4', capacity: d.capacity, occupied: d.occupied, cleaning: d.cleaning, available: d.available, utilization: util, predictedGap: r1(gap), predicted: { 1: util, 2: d.capacity ? r3(Math.min(1.5, (d.busy + upcoming * 0.5) / d.capacity)) : 0, 4: util }, dischargeReady: 0, nursesOnShift: nursesOn(name) };
    }
    const dm = [1, 2, 4].map((h) => demand(name, h));
    return {
      department: name,
      departmentId: name,
      floor: { Emergency: '1', Radiology: '1', 'General Ward': '2', HDU: '3', ICU: '3' }[name],
      capacity: d.capacity,
      occupied: d.occupied,
      cleaning: d.cleaning,
      available: d.available,
      utilization: d.capacity ? r3(d.occupied / d.capacity) : 0,
      predictedGap: dm[1].gap,
      predicted: { 1: dm[0].predictedUtilization, 2: dm[1].predictedUtilization, 4: dm[2].predictedUtilization },
      demand: dm,
      dischargeReady: readyBy[name] || 0,
      nursesOnShift: nursesOn(name),
      expectedArrivals2h: dm[1].expectedArrivals,
      expectedAdmissions2h: dm[1].expectedAdmissions,
    };
  }).map((d) => ({ ...d, severity: d.utilization > DANGER || d.predictedGap > 0 ? 'HIGH' : d.utilization > WARN ? 'MEDIUM' : 'LOW' }));
  const rootIdx = depts.findIndex((d) => d.severity !== 'LOW');
  const rootCause = rootIdx >= 0 ? depts[rootIdx].department : null;
  const cascade = rootIdx >= 0 ? depts.slice(rootIdx + 1).filter((d) => d.severity !== 'LOW').map((d) => d.department) : [];
  const list = depts.map((d) => ({ ...d, rootCause: d.department === rootCause, isCascade: cascade.includes(d.department), cascade: d.department === rootCause ? cascade : [], recommendedActions: actionsFor(d, depts) }));
  return { analyzedAt: new Date().toISOString(), thresholds: { warn: WARN, danger: DANGER, source: 'auto(50-200 beds)' }, rootCause, cascade, bottlenecks: list, dischargeCandidates: cands };
}

function totals() {
  const beds = st().beds;
  const count = (s, t) => beds.filter((b) => b.status === s && (!t || b.type === t)).length;
  const capacity = beds.filter((b) => b.status !== 'blocked').length;
  return { total: beds.length, capacity, occupied: count('occupied'), cleaning: count('cleaning'), reserved: count('reserved'), available: count('available'), icuTotal: beds.filter((b) => b.type === 'icu').length, icuOccupied: count('occupied', 'icu') };
}

function stateSummary() {
  const a = analyse();
  const t = totals();
  const root = a.bottlenecks.find((d) => d.rootCause);
  const all = a.bottlenecks.flatMap((d) => d.recommendedActions);
  const worst = a.bottlenecks.filter((d) => d.department !== 'OT').sort((x, y) => y.predictedGap - x.predictedGap)[0];
  const amb = st().ambulance && Date.now() - new Date(st().ambulance.receivedAt).getTime() < 60000 ? st().ambulance : null;
  return {
    generatedAt: new Date().toISOString(),
    lastAnalysisAt: lastAnalysisAt || a.analyzedAt,
    occupancy: { occupied: t.occupied, capacity: t.capacity, total: t.total, pct: r1((t.occupied / t.capacity) * 100) },
    icu: { occupied: t.icuOccupied, total: t.icuTotal, pct: r1((t.icuOccupied / t.icuTotal) * 100) },
    dirtyBeds: t.cleaning,
    reservedBeds: t.reserved,
    availableBeds: t.available,
    dischargeReady: a.dischargeCandidates.readyCount,
    departments: a.bottlenecks.map((d) => ({ department: d.department, departmentId: d.departmentId, utilization: d.utilization, utilizationPct: Math.round(d.utilization * 100), predicted2h: d.predicted[2], predicted2hPct: Math.round(d.predicted[2] * 100), predictedGap: d.predictedGap, severity: d.severity, rootCause: d.rootCause, isCascade: d.isCascade, capacity: d.capacity, occupied: d.occupied })),
    rootCause: a.rootCause,
    cascade: a.cascade,
    topAction: (root && root.recommendedActions[0]) || all[0] || null,
    actionsCount: all.length,
    shortage2h: worst ? { department: worst.department, gap: worst.predictedGap, shortage: worst.predictedGap > 0, confidence: 0.9 } : null,
    thresholds: a.thresholds,
    ambulance: amb,
  };
}

const MAP_STATUS = { in_surgery: 'occupied', emergency: 'occupied', cleaning: 'cleaning', available: 'available', reserved: 'reserved', maintenance: 'blocked' };

function bedMap() {
  const s = st();
  const zones = ['ED', 'Radiology', 'General Ward', 'HDU', 'ICU', 'PACU', 'OT'].map((z) => ({ zone: z, tiles: [], counts: { available: 0, occupied: 0, cleaning: 0, reserved: 0, blocked: 0, total: 0 } }));
  const byZone = Object.fromEntries(zones.map((z) => [z.zone, z]));
  for (const b of s.beds) {
    const p = b.patientId ? s.patients.find((x) => x.id === b.patientId) : null;
    const z = byZone[b.zone];
    z.tiles.push({ id: b.id, kind: 'bed', status: b.status, rawStatus: b.status === 'blocked' ? 'maintenance' : b.status, type: b.type, ward: b.ward, floor: b.floor, department: b.department, patientId: p?.id || null, patientAlias: p?.alias || null, acuity: p?.acuity || null, patientStatus: p?.status || null, admittedAt: p?.admittedAt || null, expectedRelease: b.expectedRelease, releaseConfidence: b.releaseConfidence, doctorName: p?.doctorName || null, lastCleanedAt: b.lastCleanedAt, cleaningSince: b.cleaningSince });
    z.counts[b.status] += 1;
    z.counts.total += 1;
  }
  for (const r of s.otRooms) {
    const c = s.cases.find((x) => x.roomId === r.id && x.status === 'in_progress');
    const status = MAP_STATUS[r.status] || 'blocked';
    byZone.OT.tiles.push({ id: `THEATRE ${r.id}`, roomId: r.id, kind: 'ot_room', name: r.name, status, rawStatus: r.status, floor: '4', patientAlias: c?.patientAlias || null, caseNumber: c?.caseNumber || null, procedure: c?.procedure || null, doctorName: c?.surgeon || null, expectedRelease: c ? iso(c.end) : null });
    byZone.OT.counts[status] += 1;
    byZone.OT.counts.total += 1;
  }
  const bedZones = zones.filter((z) => z.zone !== 'OT');
  const totalBeds = bedZones.reduce((a, z) => a + z.counts.total - z.counts.blocked, 0);
  const occupied = bedZones.reduce((a, z) => a + z.counts.occupied, 0);
  const nurses = s.staff.filter((x) => (x.role === 'nurse' || x.role === 'float_nurse') && x.onShift).length;
  const cleaning = s.beds.filter((b) => b.status === 'cleaning');
  return {
    generatedAt: new Date().toISOString(),
    header: { occupied, totalBeds, occupancyPct: r1((occupied / totalBeds) * 100), flowActive: true },
    legend: ['available', 'occupied', 'cleaning', 'reserved', 'blocked'].map((x) => ({ status: x, count: bedZones.reduce((a, z) => a + z.counts[x], 0) })),
    zones,
    info: {
      inTransit: { reservedBeds: bedZones.reduce((a, z) => a + z.counts.reserved, 0), inSurgery: s.otRooms.filter((r) => r.status === 'in_surgery').length },
      nurseRatio: { patients: occupied, nurses, ratio: r1(occupied / nurses) },
      cleaningQueue: { beds: cleaning.length, oldestMinutes: cleaning.length ? Math.round(Math.max(...cleaning.map((b) => (Date.now() - new Date(b.cleaningSince).getTime()) / MIN))) : 0 },
      equipment: { available: 9, total: 20 },
    },
  };
}

function otImpact() {
  const s = st();
  const pool = { post_op: s.beds.filter((b) => b.type === 'post_op' && b.status === 'available').length, icu: s.beds.filter((b) => b.type === 'icu' && b.status === 'available').length };
  const rel = { post_op: [], icu: [] };
  s.beds.filter((b) => (b.type === 'post_op' || b.type === 'icu') && b.status === 'occupied' && b.expectedRelease).sort((a, b) => new Date(a.expectedRelease) - new Date(b.expectedRelease)).forEach((b) => rel[b.type].push(new Date(b.expectedRelease).getTime()));
  const needsIcu = (c) => /icu/i.test(c.postOpWard || '') || c.urgency === 'critical';
  const inProg = s.cases.filter((c) => c.status === 'in_progress');
  for (const c of inProg) {
    if (!c.postOpRequired || c.postOpBedId) continue;
    const t = needsIcu(c) ? 'icu' : 'post_op';
    if (pool[t] > 0) pool[t] -= 1;
    else rel[t].shift();
  }
  const upcoming = s.cases.filter((c) => c.status === 'scheduled').sort((a, b) => a.start - b.start).map((c) => {
    const type = needsIcu(c) ? 'icu' : 'post_op';
    let availability = 'N/A';
    let risk = null;
    if (c.postOpRequired) {
      if (pool[type] > 0) {
        pool[type] -= 1;
        availability = 'YES';
      } else if (rel[type].length && rel[type][0] <= c.end) {
        rel[type].shift();
        availability = 'PREDICTED_FREE';
        risk = `Depends on a ${type === 'icu' ? 'ICU' : 'post-op'} bed releasing before ${new Date(c.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
      } else {
        availability = 'NO';
        risk = `No ${type === 'icu' ? 'ICU' : 'post-op'} bed expected; consider deferring${c.urgency === 'elective' ? ' (elective)' : ''}`;
      }
    }
    return { caseId: c.id, caseNumber: c.caseNumber, procedure: c.procedure, room: `OT-${c.roomId}`, surgeon: c.surgeon, alias: c.patientAlias, urgency: c.urgency, status: c.status, scheduledStart: iso(c.start), scheduledEnd: iso(c.end), postOpRequired: c.postOpRequired, postOpType: type, availability, risk };
  });
  const in3h = Date.now() + 3 * H;
  const icuDemand = inProg.filter((c) => c.postOpRequired && needsIcu(c)).length + s.cases.filter((c) => c.status === 'scheduled' && c.postOpRequired && needsIcu(c) && c.end <= in3h).length;
  const icuAvailable = s.beds.filter((b) => b.type === 'icu' && b.status === 'available').length;
  return {
    generatedAt: new Date().toISOString(),
    holdingPostOpBeds: inProg.filter((c) => c.postOpRequired).length,
    inProgress: inProg.map((c) => ({ caseId: c.id, caseNumber: c.caseNumber, procedure: c.procedure, room: `OT-${c.roomId}`, alias: c.patientAlias, expectedEnd: iso(c.end), postOpRequired: c.postOpRequired, postOpBedId: c.postOpBedId, postOpType: needsIcu(c) ? 'icu' : 'post_op' })),
    upcoming,
    overflow: { icuDemand, icuAvailable, shortageRisk: icuDemand > icuAvailable, label: `ICU demand ${icuDemand} | available ${icuAvailable}${icuDemand > icuAvailable ? ' | SHORTAGE RISK' : ''}` },
  };
}

function doctorPatients() {
  return st()
    .patients.filter((p) => p.doctorId === ME_DOCTOR && p.status !== 'discharged')
    .map((p) => {
      const adm = admissionProbability(p, p.waitingSince || p.admittedAt || new Date());
      const l = los(p);
      const bed = st().beds.find((b) => b.id === p.bedId);
      return { patientId: p.id, alias: p.alias, status: p.status, acuity: p.acuity, bedId: p.bedId, ward: bed?.ward || null, department: p.department, admittedAt: p.admittedAt, expectedDischarge: p.expectedDischarge || l.expectedReleaseTime, admissionProbability: adm.probability, factors: [...adm.factors].sort((a, b) => b.impact - a.impact).slice(0, 3), icuRisk: predictIcuNeed({ age: p.age, gender: p.gender, acuity: p.acuity, requiresOt: p.requiresOt, arrivalTime: p.admittedAt || p.waitingSince }), los: l, readiness: readiness(p), requiresOt: p.requiresOt };
    });
}

function utilStatus(p) {
  return p > 90 ? 'danger' : p >= 70 ? 'warning' : 'success';
}

function dashboardNumbers(scope = 'admin') {
  const s = st();
  if (scope === 'doctor') {
    const mine = doctorPatients();
    const cands = dischargeCandidates().candidates.filter((c) => c.doctorId === ME_DOCTOR);
    const census = Array.from({ length: 7 }, (_, i) => ({ ts: iso(Date.now() - (6 - i) * 24 * H), value: Math.max(1, mine.length - 3 + ((i * 7) % 4)) }));
    return {
      scope,
      kpis: [
        { key: 'myPatients', label: 'My patients', value: mine.length, unit: '', sub: 'active in care', delta: census[6].value - census[5].value, deltaUnit: 'vs yesterday', status: 'neutral', seriesKey: 'myCensus', chartType: 'bar' },
        { key: 'critical', label: 'Critical (acuity 1-2)', value: mine.filter((p) => p.acuity <= 2).length, unit: '', sub: 'needs close watch', status: 'danger', seriesKey: null },
        { key: 'dischargeReady', label: 'Discharge-ready', value: cands.filter((c) => c.ready).length, unit: '', sub: 'sign to free beds', status: 'warning', seriesKey: 'myReadiness', chartType: 'bar' },
        { key: 'pendingOt', label: 'Pending OT requests', value: 1, unit: '', sub: 'awaiting approval', status: 'neutral', seriesKey: null },
      ],
      series: { myCensus: census, myReadiness: cands.map((c) => ({ ts: c.alias, value: c.score, label: c.alias })) },
    };
  }
  if (scope === 'ot') {
    const imp = otImpact();
    const post = s.beds.filter((b) => b.type === 'post_op');
    return {
      scope,
      kpis: [
        { key: 'casesToday', label: 'Cases today', value: s.cases.length, unit: '', sub: `${s.cases.filter((c) => c.status === 'completed').length} completed`, status: 'neutral', seriesKey: 'casesByHour', chartType: 'bar' },
        { key: 'inProgress', label: 'In progress', value: imp.inProgress.length, unit: '', sub: `${imp.holdingPostOpBeds} holding post-op beds`, status: 'neutral', seriesKey: null },
        { key: 'postOpAvailable', label: 'Post-op beds free', value: post.filter((b) => b.status === 'available').length, unit: '', sub: `of ${post.length}`, status: 'warning', seriesKey: null },
        { key: 'icuDemand3h', label: 'ICU demand from OT (3h)', value: imp.overflow.icuDemand, unit: '', sub: `${imp.overflow.icuAvailable} ICU beds free`, status: imp.overflow.shortageRisk ? 'danger' : 'success', seriesKey: null },
        { key: 'otUtil', label: 'OT utilization', value: s.kpiSeries.otUtil.at(-1).value, unit: '%', sub: 'snapshot', delta: r1(s.kpiSeries.otUtil.at(-1).value - s.kpiSeries.otUtil.at(-2).value), deltaUnit: 'pts', status: utilStatus(s.kpiSeries.otUtil.at(-1).value), seriesKey: 'otUtil', chartType: 'line' },
      ],
      series: { otUtil: s.kpiSeries.otUtil, casesByHour: s.cases.map((c) => ({ ts: iso(Math.floor(c.start / H) * H), value: 1 })) },
    };
  }
  const sum = stateSummary();
  const f = forecast('Emergency', 6);
  const ed = [1, 2, 4, 6].map((h) => demand('Emergency', h));
  const otPct = r1((s.otRooms.filter((r) => r.status === 'in_surgery').length / s.otRooms.length) * 100);
  const d1 = (k) => r1(s.kpiSeries[k].at(-1).value - s.kpiSeries[k].at(-2).value);
  const wait = s.kpiSeries.avgWait.at(-1).value;
  return {
    scope: 'admin',
    kpis: [
      { key: 'occupancy', label: 'Bed occupancy', value: sum.occupancy.pct, unit: '%', sub: `${sum.occupancy.occupied}/${sum.occupancy.capacity} beds`, delta: d1('occupancy'), deltaUnit: 'pts', status: utilStatus(sum.occupancy.pct), seriesKey: 'occupancy', chartType: 'line' },
      { key: 'icu', label: 'ICU occupancy', value: sum.icu.pct, unit: '%', sub: `${sum.icu.occupied}/${sum.icu.total} beds`, delta: d1('icu'), deltaUnit: 'pts', status: utilStatus(sum.icu.pct), seriesKey: 'icu', chartType: 'line' },
      { key: 'edArrivals', label: 'ED arrivals next 6h', value: r1(f.predicted.reduce((a, b) => a + b, 0)), unit: '', sub: 'confidence 90%', status: 'neutral', seriesKey: 'edForecast', chartType: 'band' },
      { key: 'edDemand', label: 'ED bed gap in 2h', value: ed[1].gap, unit: ' beds', sub: `demand ${ed[1].demand} vs cap ${ed[1].capacity}`, status: ed[1].gap > 0 ? 'danger' : 'success', seriesKey: 'edDemand', chartType: 'demandCapacity' },
      { key: 'avgWait', label: 'Avg ED wait', value: wait, unit: ' min', sub: 'from KPI snapshots', delta: d1('avgWait'), deltaUnit: 'min', invertDelta: true, status: wait > 45 ? 'danger' : wait > 25 ? 'warning' : 'success', seriesKey: 'avgWait', chartType: 'line' },
      { key: 'dirtyBeds', label: 'Dirty beds', value: sum.dirtyBeds, unit: '', sub: 'awaiting cleaning', status: sum.dirtyBeds > 2 ? 'warning' : 'success', seriesKey: null },
      { key: 'dischargeReady', label: 'Discharge-ready', value: sum.dischargeReady, unit: '', sub: '≥ 60% readiness', status: 'neutral', seriesKey: null },
      { key: 'otUtil', label: 'OT utilization', value: otPct, unit: '%', sub: `${s.otRooms.filter((r) => r.status === 'in_surgery').length}/${s.otRooms.length} theatres`, delta: d1('otUtil'), deltaUnit: 'pts', status: utilStatus(otPct), seriesKey: 'otUtil', chartType: 'line' },
    ],
    series: {
      occupancy: s.kpiSeries.occupancy,
      icu: s.kpiSeries.icu,
      avgWait: s.kpiSeries.avgWait,
      otUtil: s.kpiSeries.otUtil,
      edForecast: f.timestamps.map((ts, i) => ({ ts, value: f.predicted[i], lower: f.lower[i], upper: f.upper[i] })),
      edDemand: ed.map((d) => ({ ts: iso(Date.now() + d.horizon * H), horizon: d.horizon, value: d.demand, capacity: d.capacity })),
    },
  };
}

/* ───────────────────────── simulator ───────────────────────── */

function simulate(params) {
  const t = totals();
  const nurses = st().staff.filter((x) => x.role === 'nurse' && x.onShift).length;
  const floats = st().staff.filter((x) => x.role === 'float_nurse' && x.onShift).length;
  const cands = dischargeCandidates();
  const b = { totalBeds: t.capacity, currentPatients: t.occupied, dirtyBeds: t.cleaning, dischargeReadyCount: cands.readyCount, icuTotal: t.icuTotal, icuOccupied: t.icuOccupied, icuShare: 0.1, totalNurses: nurses, floatAvailable: floats, forecastArrivals: r1(forecast('Emergency', 6).predicted.reduce((a, c) => a + c, 0)), admissionRate: 0.32, avgServiceTimeMin: 30, dischargeRatePerHour: 1.4, electiveOtCases: st().cases.filter((c) => c.status === 'scheduled' && c.urgency === 'elective').length, baselineWaitMin: st().kpiSeries.avgWait.at(-1).value, horizonHours: 6 };
  const p = { arrivalIncreasePct: Math.max(0, Math.min(200, +params.arrivalIncreasePct || 0)), nursesAbsent: Math.max(0, Math.min(b.totalNurses, +params.nursesAbsent || 0)), icuBedsClosed: Math.max(0, Math.min(b.icuTotal, +params.icuBedsClosed || 0)) };
  const sc = (label, { extraBeds = 0, extraNurses = 0, deferredElective = 0 }) => {
    const cap = b.totalBeds - p.icuBedsClosed + extraBeds;
    const staff = Math.max(0, b.totalNurses - p.nursesAbsent + extraNurses);
    const surge = b.forecastArrivals * (1 + p.arrivalIncreasePct / 100);
    const dem = b.currentPatients + surge * b.admissionRate - deferredElective;
    const supply = Math.min(cap, staff * 4);
    return { label, avgWaitMin: Math.round(Math.max(0, ((dem - supply) * b.avgServiceTimeMin) / Math.max(1, b.dischargeRatePerHour))), bedShortage: Math.max(0, Math.ceil(dem - cap)), nurseShortage: Math.max(0, Math.ceil(dem / 4 - staff)), icuOverflow: Math.max(0, Math.ceil(b.icuOccupied + surge * b.icuShare * b.admissionRate - (b.icuTotal - p.icuBedsClosed))), effectiveCapacity: cap, effectiveStaff: staff, demand: r1(dem), supply, extraBeds, extraNurses, deferredElective };
  };
  const A = sc('Do Nothing', {});
  const B = sc('Partial Action', { extraBeds: Math.floor(b.dirtyBeds * 0.5), extraNurses: Math.min(1, b.floatAvailable) });
  const full = b.dirtyBeds + b.dischargeReadyCount;
  const probe = sc('probe', { extraBeds: full });
  const fl = Math.min(Math.max(0, Math.ceil(probe.demand / 4) - probe.effectiveStaff), b.floatAvailable);
  let C = sc('Full Orchestration', { extraBeds: full, extraNurses: fl });
  if ((C.bedShortage > 0 || C.avgWaitMin > 0) && b.electiveOtCases > 0) C = sc('Full Orchestration', { extraBeds: full, extraNurses: fl, deferredElective: b.electiveOtCases });
  const base = Math.round(b.baselineWaitMin * (1 + p.arrivalIncreasePct / 200));
  for (const x of [A, B, C]) {
    x.queueWaitMin = x.avgWaitMin;
    x.avgWaitMin += base;
  }
  const actions = [];
  if (b.dirtyBeds) actions.push({ type: 'cleaning', text: `Prioritize cleaning of ${b.dirtyBeds} dirty beds`, impact: `+${b.dirtyBeds} beds`, count: b.dirtyBeds });
  if (b.dischargeReadyCount) actions.push({ type: 'discharge', text: `Expedite discharge for ${b.dischargeReadyCount} medically ready patients`, impact: `+${b.dischargeReadyCount} beds`, count: b.dischargeReadyCount });
  if (fl) actions.push({ type: 'staffing', text: `Deploy ${fl} reserve nurse${fl > 1 ? 's' : ''} to the busiest wards`, impact: `+${fl * 4} safe patient slots`, count: fl });
  if (C.deferredElective) actions.push({ type: 'defer_ot', text: `Defer ${C.deferredElective} elective OT cases needing post-op beds`, impact: `-${C.deferredElective} bed demand`, count: C.deferredElective });
  const pct = A.avgWaitMin > 0 ? Math.round(((A.avgWaitMin - C.avgWaitMin) / A.avgWaitMin) * 100) : 0;
  const run = { id: uid('sim'), createdAt: new Date().toISOString(), createdBy: 'Demo admin', applied: false, params: p, baseline: b, scenarioA: A, scenarioB: B, scenarioC: C, recommendedScenario: 'C', actions, expectedWaitReduction: `${A.avgWaitMin} min to ${C.avgWaitMin} min`, waitReductionPct: pct };
  st().simulations.unshift(run);
  logEvent('SIMULATION_RUN', p, { expectedWaitReduction: run.expectedWaitReduction });
  return run;
}

/* ───────────────────────── events ───────────────────────── */

function processEvent(eventType, payload = {}) {
  const s = st();
  const t0 = performance.now();
  let result;
  switch (eventType) {
    case 'DISCHARGE_SIGNED': {
      const p = s.patients.find((x) => x.id === payload.patientId);
      if (!p) throw new Error('Patient not found');
      const bed = s.beds.find((b) => b.id === p.bedId);
      Object.assign(p, { status: 'discharged', bedId: null, lastBedId: p.bedId, dischargedAt: new Date().toISOString(), pendingTasks: [] });
      if (bed) Object.assign(bed, { status: 'cleaning', patientId: null, expectedRelease: null, cleaningSince: new Date().toISOString() });
      notify(`Housekeeping: clean ${bed?.id}`, `Bed ${bed?.id} released after discharge of ${p.alias}.`);
      emit('bed.updated', { bedId: bed?.id, status: 'cleaning', patientId: null });
      emit('patient.updated', { patientId: p.id, status: 'discharged' });
      result = { patientId: p.id, alias: p.alias, bedId: bed?.id, bedStatus: 'cleaning', housekeepingNotified: 1 };
      break;
    }
    case 'CLEANING_DONE': {
      const bed = s.beds.find((b) => b.id === payload.bedId);
      if (!bed) throw new Error('Bed not found');
      if (bed.status === 'occupied') throw new Error('Bed is occupied');
      Object.assign(bed, { status: 'available', cleaningSince: null, lastCleanedAt: new Date().toISOString(), patientId: null });
      const match = s.patients.filter((p) => p.status === 'waiting' && (bed.type === 'icu' ? p.requiresIcu : !p.requiresIcu)).sort((a, b) => a.acuity - b.acuity || new Date(a.waitingSince) - new Date(b.waitingSince))[0];
      let rec = null;
      if (match) {
        const mins = Math.round((Date.now() - new Date(match.waitingSince).getTime()) / MIN);
        rec = addRec({ type: 'bed_assignment', title: `Assign ${match.alias} to ${bed.id}`, detail: `Acuity ${match.acuity}, waiting ${mins} min.`, expectedImpact: `Ends a ${mins} min wait for ${match.alias}`, risk: 'low', payload: { bedId: bed.id, patientId: match.id } });
      }
      emit('bed.updated', { bedId: bed.id, status: 'available', patientId: null });
      result = { bedId: bed.id, bedStatus: 'available', recommendation: rec };
      break;
    }
    case 'OT_COMPLETE': {
      const c = s.cases.find((x) => x.id === payload.caseId || x.caseNumber === payload.caseId);
      if (!c) throw new Error('OT case not found');
      if (c.status === 'completed') throw new Error('Already completed');
      c.status = 'completed';
      const room = s.otRooms.find((r) => r.id === c.roomId);
      if (room) room.status = 'cleaning';
      const type = 'post_op';
      const bed = s.beds.find((b) => b.type === type && (b.status === 'available' || b.status === 'reserved'));
      let postOpBedId = null;
      if (bed && c.postOpRequired) {
        const p = { id: uid('pt'), alias: c.patientAlias, acuity: 3, status: 'in_recovery', bedId: bed.id, department: 'General Ward', doctorId: 'doc-hughes', doctorName: c.surgeon, admittedAt: new Date().toISOString(), expectedDischarge: iso(Date.now() + 6 * H), dischargeDate: null, requiresImaging: false, requiresIcu: false, pendingTasks: [] };
        s.patients.push(p);
        Object.assign(bed, { status: 'occupied', patientId: p.id, expectedRelease: p.expectedDischarge, releaseConfidence: 0.7 });
        postOpBedId = bed.id;
        emit('bed.updated', { bedId: bed.id, status: 'occupied' });
      }
      emit('ot.caseCompleted', { caseId: c.id, caseNumber: c.caseNumber, roomId: c.roomId, nextStatus: 'cleaning', postOpBedId });
      emit('doctor.statusChanged', { doctorId: 'doc-menon', staffId: 'doc-menon', name: c.surgeon, newStatus: 'available' });
      result = { caseId: c.id, caseNumber: c.caseNumber, roomId: c.roomId, roomStatus: 'cleaning', postOpBedId };
      break;
    }
    case 'PATIENT_DETERIORATED': {
      const p = s.patients.find((x) => x.id === payload.patientId);
      if (!p) throw new Error('Patient not found');
      const acuity = Math.max(1, Math.min(5, +payload.newAcuity || p.acuity - 1));
      Object.assign(p, { acuity, status: acuity <= 2 ? 'critical' : p.status, requiresIcu: acuity === 1 || p.requiresIcu });
      let rec = null;
      const bed = s.beds.find((b) => b.id === p.bedId);
      if (p.requiresIcu && bed?.type !== 'icu') {
        const icu = s.beds.find((b) => b.type === 'icu' && b.status === 'available');
        rec = addRec({ type: 'icu_transfer', title: `Transfer ${p.alias} to ICU (${icu ? icu.id : 'next free ICU bed'})`, detail: `Acuity now ${acuity}.`, expectedImpact: 'Escalates care level within 30 min', risk: 'high' });
      }
      emit('patient.updated', { patientId: p.id, status: p.status, acuity });
      emit('alert.created', { alertId: uid('alt'), severity: 'critical', title: `${p.alias} deteriorated to acuity ${acuity}`, description: `Bed ${p.bedId}` });
      result = { patientId: p.id, alias: p.alias, acuity, status: p.status, requiresIcu: p.requiresIcu, recommendation: rec };
      break;
    }
    case 'AMBULANCE_INCOMING': {
      const eta = +payload.eta || 8;
      const acuity = +payload.acuity || 1;
      const arrival = new Date(Date.now() + eta * MIN);
      const icu = predictIcuNeed({ age: payload.age, gender: payload.gender, acuity, requiresOt: payload.requiresOt, arrivalTime: arrival });
      const requiresIcu = payload.requiresIcu !== undefined ? Boolean(payload.requiresIcu) : icu ? icu.needsIcu : acuity === 1;
      const adm = admissionProbability({ acuity, requiresIcu }, arrival);
      let bed = null;
      let bedMode = null;
      if (adm.probability > 0.7) {
        for (const type of [requiresIcu ? 'icu' : 'ed', 'ed']) {
          const free = s.beds.find((b) => b.type === type && b.status === 'available');
          if (free) {
            free.status = 'reserved';
            bed = free;
            bedMode = 'reserved';
            break;
          }
          const soon = s.beds.filter((b) => b.type === type && b.status === 'occupied' && b.expectedRelease && new Date(b.expectedRelease).getTime() < Date.now() + 30 * MIN)[0];
          if (soon) {
            bed = soon;
            bedMode = 'releasing';
            break;
          }
        }
      }
      const banner = { eventId: uid('evt'), eta, acuity, injuryType: payload.injuryType || 'Road traffic collision, chest trauma', vitals: payload.vitals || { HR: 128, BP: '88/54', SpO2: '89%' }, probability: adm.probability, factors: adm.factors, age: payload.age ?? null, icuProbability: icu?.probability ?? null, icuFactors: icu?.factors || [], requiresIcu, bedId: bed?.id || null, bedMode, arrivesAt: iso(Date.now() + eta * MIN), receivedAt: new Date().toISOString() };
      s.ambulance = banner;
      addRec({ type: 'trauma_team', title: `Prepare trauma team: ambulance ETA ${eta} min (acuity ${acuity})`, detail: banner.injuryType, expectedImpact: 'Door-to-treatment under 10 min', risk: 'high' });
      notify(`Ambulance ETA ${eta} min: acuity ${acuity}`, `${banner.injuryType}. ${bed ? `Bed ${bed.id} ${bedMode}.` : ''}`, 'alert');
      if (bed && bedMode === 'reserved') emit('bed.updated', { bedId: bed.id, status: 'reserved' });
      emit('flow.ambulanceIncoming', banner);
      emit('alert.created', { alertId: uid('alt'), severity: 'critical', title: `Ambulance incoming: ETA ${eta} min | Acuity ${acuity}`, description: banner.injuryType });
      result = { ...banner, teamNotified: 3 };
      break;
    }
    default:
      throw new Error(`Unknown event type '${eventType}'`);
  }
  const ev = logEvent(eventType, payload, result);
  setTimeout(() => runAnalysis(), 50);
  return { eventId: ev.id, eventType, processedAt: ev.createdAt, tookMs: Math.round(performance.now() - t0), result };
}

function runAnalysis() {
  lastAnalysisAt = new Date().toISOString();
  const a = analyse();
  const summary = stateSummary();
  if (a.bottlenecks.some((b) => b.severity === 'HIGH')) emit('flow.bottleneckDetected', { bottlenecks: a.bottlenecks, rootCause: a.rootCause, cascade: a.cascade, detectedAt: a.analyzedAt });
  emit('flow.analysisComplete', { analyzedAt: lastAnalysisAt, stateSummary: summary, bottlenecks: a.bottlenecks });
}

function startAnalysisLoop() {
  if (analysisTimer) return;
  lastAnalysisAt = new Date().toISOString();
  analysisTimer = setInterval(runAnalysis, 30000);
}

/* ───────────────────────── AI report (local template) ───────────────────────── */

function aiReport(scope = 'admin', format = 'detailed') {
  let text;
  let snapshot;
  if (scope === 'doctor') {
    const pts = doctorPatients();
    snapshot = { scope, patients: pts.map((p) => ({ alias: p.alias, acuity: p.acuity, bed: p.bedId, readiness: p.readiness.score, losHours: p.los.predictedHours })) };
    const ready = pts.filter((p) => p.readiness.score >= 60);
    text = [
      '## 1) Situation summary',
      `You have ${pts.length} active patients: ${pts.filter((p) => p.acuity <= 2).length} critical and ${ready.length} close to discharge.`,
      '',
      '## 2) Key numbers',
      ...pts.map((p) => `- ${p.alias} (${p.bedId || 'no bed'}): acuity ${p.acuity}, predicted LOS ${p.los.predictedHours}h, readiness ${p.readiness.score}/100`),
      '',
      '## 3) Root cause and cascade',
      'Not applicable at the individual patient level.',
      '',
      '## 4) Predicted next 2-4 hours',
      ready.length ? ready.map((p) => `- ${p.alias} expected discharge ${new Date(p.expectedDischarge).toLocaleTimeString()}`).join('\n') : '- No discharges expected.',
      '',
      '## 5) Recommended actions',
      ready.length ? ready.map((p, i) => `${i + 1}. Review discharge for ${p.alias}${p.readiness.blockingFactors.length ? `; clear: ${p.readiness.blockingFactors.join(', ')}` : ''}`).join('\n') : '1. No discharge actions right now.',
      '',
      '## 6) Risks and confidence',
      '- LOS predictions use historical averages for the same acuity and department.',
    ].join('\n');
  } else if (scope === 'ot') {
    const imp = otImpact();
    snapshot = { scope, inProgress: imp.inProgress.length, upcoming: imp.upcoming.map((c) => ({ case: c.caseNumber, bed: c.availability })), overflow: imp.overflow };
    text = [
      '## 1) Situation summary',
      `${imp.inProgress.length} surgeries in progress, ${imp.upcoming.length} upcoming. ${imp.overflow.label}.`,
      '',
      '## 2) Key numbers',
      `- ICU demand from OT (3h): ${imp.overflow.icuDemand}`,
      `- ICU beds available: ${imp.overflow.icuAvailable}`,
      '',
      '## 3) Root cause and cascade',
      imp.overflow.shortageRisk ? 'ICU capacity is the constraint for post-op flow.' : 'No OT-driven bottleneck detected.',
      '',
      '## 4) Predicted next 2-4 hours',
      ...imp.upcoming.map((c) => `- ${c.caseNumber} ${c.procedure}: post-op bed ${c.availability}`),
      '',
      '## 5) Recommended actions',
      ...imp.upcoming.filter((c) => c.availability === 'NO').map((c, i) => `${i + 1}. ${c.urgency === 'elective' ? 'Consider deferring' : 'Secure a bed for'} ${c.caseNumber}`),
      '',
      '## 6) Risks and confidence',
      '- Bed availability relies on predicted release times.',
    ].join('\n');
  } else {
    const sum = stateSummary();
    const a = analyse();
    snapshot = { scope: format === 'handover' ? 'handover' : 'admin', occupancy: sum.occupancy, icu: sum.icu, dirtyBeds: sum.dirtyBeds, dischargeReady: sum.dischargeReady, bottleneck: { rootCause: a.rootCause, cascade: a.cascade }, departments: a.bottlenecks.map((d) => ({ department: d.department, utilizationPct: Math.round(d.utilization * 100), predicted2hPct: Math.round(d.predicted[2] * 100), gap2h: d.predictedGap, severity: d.severity })), topActions: a.bottlenecks.flatMap((d) => d.recommendedActions).slice(0, 6).map((x) => ({ action: x.text, impact: x.impact, why: x.why })), lastSimulation: st().simulations[0] ? { expectedWaitReduction: st().simulations[0].expectedWaitReduction } : null };
    const lines = [];
    if (format === 'handover') {
      const counts = {};
      for (const e of st().events) counts[e.eventType] = (counts[e.eventType] || 0) + 1;
      lines.push('## 1) What changed in the last 8 hours', ...(Object.keys(counts).length ? Object.entries(counts).map(([k, v]) => `- ${k}: ${v}`) : ['- No flow events recorded.']), '');
      lines.push('## 2) Current key numbers');
    } else {
      lines.push('## 1) Situation summary', `Hospital occupancy is ${sum.occupancy.pct}% (${sum.occupancy.occupied}/${sum.occupancy.capacity} beds) and ICU is at ${sum.icu.pct}%. ${a.rootCause ? `${a.rootCause} is the root-cause bottleneck${a.cascade.length ? `, cascading to ${a.cascade.join(', ')}` : ''}.` : 'No department is above threshold.'} ${sum.dirtyBeds} beds await cleaning and ${sum.dischargeReady} patients are ready for discharge.`, '', '## 2) Key numbers');
    }
    lines.push(`- Occupancy: ${sum.occupancy.pct}%`, `- ICU: ${sum.icu.pct}%`, ...snapshot.departments.map((d) => `- ${d.department}: ${d.utilizationPct}% now, ${d.predicted2hPct}% in 2h (${d.severity})`), `- Dirty beds: ${sum.dirtyBeds}`, `- Discharge-ready: ${sum.dischargeReady}`, '');
    if (format === 'handover') {
      lines.push('## 3) Open risks', a.rootCause ? `- Bottleneck: ${a.rootCause}${a.cascade.length ? `, then ${a.cascade.join(', ')}` : ''}` : '- None.', '', '## 4) Pending discharges', ...dischargeCandidates().candidates.filter((c) => c.ready).map((c) => `- ${c.alias} (${c.bedId}), owner ${c.doctorName}; blocked by: ${c.blockingFactors.join(', ') || 'none'}`), '', '## 5) First actions for the incoming shift');
    } else {
      lines.push('## 3) Root cause and cascade', a.rootCause ? `${a.rootCause} is the first department in the flow chain above threshold.${a.cascade.length ? ` Downstream impact: ${a.cascade.join(', ')}.` : ''}` : 'No root cause.', ...(format === 'explain' && a.rootCause ? [`Why: ${a.rootCause} is at ${Math.round(a.bottlenecks.find((b) => b.rootCause).utilization * 100)}% utilization (warn 75%, danger 88%) and every department before it in the chain is LOW.`] : []), '', '## 4) Predicted next 2-4 hours', ...(snapshot.departments.filter((d) => d.gap2h > 0).map((d) => `- ${d.department}: short by ${d.gap2h} beds in 2h`).concat(['- Forecasts based on 4 weeks of same-hour history.'])), '', '## 5) Recommended actions');
    }
    lines.push(...snapshot.topActions.map((x, i) => (format === 'explain' ? `${i + 1}. ${x.action}
   - Because: ${x.why || 'department numbers above'}
   - Expected impact: ${x.impact}` : `${i + 1}. ${x.action} (expected impact: ${x.impact})`)));
    if (format !== 'handover') lines.push('', '## 6) Risks and confidence', snapshot.lastSimulation ? `- Last simulation: ${snapshot.lastSimulation.expectedWaitReduction}.` : '- No simulation run yet.', '- Thresholds: warn 75%, danger 88% (auto, 50-200 beds).');
    text = lines.join('\n');
  }
  logEvent('AI_REPORT', { scope, format }, { provider: 'local-template' });
  return { id: uid('rep'), reportText: text, provider: 'local-template', model: 'mock-deterministic', generatedAt: new Date().toISOString(), scope, format, snapshotSummary: snapshot.occupancy ? { occupancyPct: snapshot.occupancy.pct, rootCause: snapshot.bottleneck.rootCause } : {}, snapshot, cached: false };
}

/* ───────────────────────── router ───────────────────────── */

function applyActions(actions, autoApprove, source) {
  let notificationsSent = 0;
  let nudges = 0;
  const created = actions.map((a) => {
    const r = addRec({ type: a.type, title: a.text, expectedImpact: a.impact, risk: 'medium', status: autoApprove ? 'approved' : 'pending', source, payload: a });
    if (autoApprove || source === 'simulator') {
      if (a.type === 'discharge') {
        const ready = dischargeCandidates().candidates.filter((c) => c.ready);
        for (const c of ready) {
          notify(`Discharge nudge: ${c.alias} (${c.bedId})`, `Readiness ${c.score}/100.`);
          emit('flow.dischargeNudge', { patientId: c.patientId, alias: c.alias, doctorId: c.doctorId, probability: c.probability, bedId: c.bedId, score: c.score });
        }
        nudges += ready.length;
        notificationsSent += ready.length;
      } else {
        notify(a.type === 'cleaning' ? 'Housekeeping priority' : `Flow action: ${a.type}`, a.text);
        notificationsSent += 1;
      }
    }
    return r;
  });
  return { created: created.length, recommendations: created, notificationsSent, nudges };
}

const routes = {
  '/forecast': (q) => forecast(q?.department && q.department !== 'all' ? q.department : 'Emergency', +q?.horizon || 6),
  '/bed-demand': (q) => [1, 2, 4, 6].map((h) => demand(q?.department || 'Emergency', h)),
  '/discharge-candidates': () => dischargeCandidates(),
  '/bottlenecks': (q) => {
    const a = analyse();
    return { ...a, bottlenecks: q?.severity ? a.bottlenecks.filter((b) => b.severity === q.severity) : a.bottlenecks };
  },
  '/state-summary': () => stateSummary(),
  '/bed-map': () => bedMap(),
  '/dashboard-numbers': (q) => dashboardNumbers(q?.scope),
  '/config': () => ({ warn: WARN, danger: DANGER, thresholdSource: 'auto(50-200 beds)', dischargeNudgeThreshold: NUDGE, analysisIntervalMs: 30000, horizonHours: 6, aiProvider: 'local-template', aiConfigured: { gemini: false, groq: false }, lastAnalysisAt }),
  '/simulations/history': (q) => st().simulations.slice(0, +q?.limit || 5),
  '/recommendations': (q) => st().recommendations.filter((r) => !q?.status || r.status === q.status),
  '/beds/about-to-free': (q) => st().beds.filter((b) => b.status === 'occupied' && b.expectedRelease && new Date(b.expectedRelease).getTime() <= Date.now() + (+q?.hours || 4) * H).sort((a, b) => new Date(a.expectedRelease) - new Date(b.expectedRelease)).map((b) => {
    const pre = st().recommendations.find((r) => r.type === 'pre_assignment' && r.payload?.bedId === b.id);
    return { bedId: b.id, ward: b.ward, zone: b.zone, type: b.type, expectedFreeAt: b.expectedRelease, minutesUntilFree: Math.round((new Date(b.expectedRelease).getTime() - Date.now()) / MIN), confidence: b.releaseConfidence, currentAlias: st().patients.find((p) => p.id === b.patientId)?.alias, preAssignedTo: pre?.payload?.alias || null };
  }),
  '/waiting-patients': () => st().patients.filter((p) => p.status === 'waiting').map((p) => ({ id: p.id, alias: p.alias, acuity: p.acuity, requires_icu: p.requiresIcu, department_name: p.department, waiting_minutes: Math.round((Date.now() - new Date(p.waitingSince).getTime()) / MIN) })),
  '/ot-impact': () => otImpact(),
  '/doctor/patients': () => doctorPatients(),
  '/staff-roster': () => {
    const pres = { available: 'online', in_consultation: 'online', in_surgery: 'away', on_break: 'away', emergency: 'away', off_duty: 'offline' };
    const doctors = DOCTORS.map((d) => ({ ...d, presence: pres[d.status], location: d.status === 'in_surgery' ? 'OT' : d.department, surgeriesToday: d.department === 'OT' ? 2 : 0, onCall: d.id === 'doc-khan' }));
    const depts = ['Emergency', 'Radiology', 'General Ward', 'HDU', 'ICU', 'OT'].map((name) => ({ departmentId: name, department: name, doctors: doctors.filter((d) => d.department === name && d.presence !== 'offline').length, nurses: st().staff.filter((x) => x.department === name && x.role === 'nurse' && x.onShift).length, staff: st().staff.filter((x) => x.department === name && x.role === 'housekeeping').length }));
    return { doctors, departments: depts, totals: { doctorsOnline: doctors.filter((d) => d.presence === 'online').length, doctorsAway: doctors.filter((d) => d.presence === 'away').length, nursesOnShift: depts.reduce((a, d) => a + d.nurses, 0) } };
  },
  '/housekeeping': () => {
    const now = Date.now();
    const cleaning = st().beds.filter((b) => b.status === 'cleaning').map((b) => ({ id: b.id, status: b.status, ward: b.ward, floor: b.floor, zone: b.zone, waitingMinutes: Math.round((now - new Date(b.cleaningSince).getTime()) / MIN) }));
    const ready = st().beds.filter((b) => b.status === 'available' && now - new Date(b.lastCleanedAt).getTime() < 4 * H).map((b) => ({ id: b.id, status: b.status, ward: b.ward, zone: b.zone, cleanedMinutesAgo: Math.round((now - new Date(b.lastCleanedAt).getTime()) / MIN) }));
    return { cleaning, ready, counts: { dirty: cleaning.length, cleanedLast4h: ready.length, available: totals().available, overdue: cleaning.filter((b) => b.waitingMinutes > 45).length } };
  },
  '/audit': (q) => {
    const counts = {};
    for (const e of st().events) counts[e.eventType] = (counts[e.eventType] || 0) + 1;
    return { events: st().events.filter((e) => !q?.type || e.eventType === q.type).slice(0, +q?.limit || 100), types: Object.entries(counts).map(([event_type, n]) => ({ event_type, n })) };
  },
};

function matchGet(path, params) {
  if (routes[path]) return routes[path](params || {});
  let m = path.match(/^\/admission-probability\/(.+)$/);
  if (m) {
    const p = st().patients.find((x) => x.id === m[1]);
    return { patientId: m[1], alias: p?.alias, acuity: p?.acuity, ...admissionProbability(p || { acuity: 3 }) };
  }
  m = path.match(/^\/los\/(.+)$/);
  if (m) {
    const p = st().patients.find((x) => x.id === m[1]);
    return { patientId: m[1], alias: p?.alias, ...los(p || { acuity: 3 }) };
  }
  throw new Error(`Mock route not found: GET ${path}`);
}

function matchPost(path, body = {}) {
  const s = st();
  if (path === '/event') return processEvent(body.eventType, body.payload);
  if (path === '/simulate') return simulate(body);
  if (path === '/recommendations/batch') {
    const r = applyActions(body.actions || [], !!body.autoApprove, body.source || 'bottleneck');
    logEvent('RECOMMENDATIONS_BATCH', { count: r.created }, r);
    return { ...r, status: body.autoApprove ? 'approved' : 'pending' };
  }
  if (path === '/discharge/nudge') {
    const ids = body.patientIds || [];
    const targets = dischargeCandidates().candidates.filter((c) => (ids.length ? ids.includes(c.patientId) : c.ready));
    for (const c of targets) {
      notify(`Discharge nudge: ${c.alias} (${c.bedId})`, `Readiness ${c.score}/100.`);
      emit('flow.dischargeNudge', { patientId: c.patientId, alias: c.alias, doctorId: c.doctorId, probability: c.probability, bedId: c.bedId, score: c.score });
    }
    logEvent('DISCHARGE_NUDGE_SENT', { patientIds: targets.map((t) => t.patientId) }, { notified: targets.length });
    return { nudged: targets.length, notificationsSent: targets.length, patients: targets.map((t) => t.alias) };
  }
  let m = path.match(/^\/discharge\/(.+)\/mark-ready$/);
  if (m) {
    const p = s.patients.find((x) => x.id === m[1]);
    if (!p) throw new Error('Patient not found');
    p.pendingTasks = [];
    p.dischargeDate = p.dischargeDate || iso(Date.now() + H);
    p.expectedDischarge = iso(Math.min(new Date(p.expectedDischarge || Date.now() + H).getTime(), Date.now() + H));
    const bed = s.beds.find((b) => b.id === p.bedId);
    if (bed) Object.assign(bed, { expectedRelease: p.expectedDischarge, releaseConfidence: 0.85 });
    logEvent('DISCHARGE_MARKED_READY', { patientId: p.id }, readiness(p));
    emit('patient.updated', { patientId: p.id, dischargeReady: true });
    return { patientId: p.id, alias: p.alias, ...readiness(p) };
  }
  m = path.match(/^\/simulations\/(.+)\/apply$/);
  if (m) {
    const run = s.simulations.find((x) => x.id === m[1]);
    if (!run) throw new Error('Simulation not found');
    run.applied = true;
    const r = applyActions(run.actions, false, 'simulator');
    notify('Surge plan submitted for approval', `Scenario C: ${run.expectedWaitReduction}.`);
    logEvent('SIMULATION_PLAN_APPLIED', { simulationId: run.id }, r);
    return { simulationId: run.id, recommendationsCreated: r.created, notificationsSent: r.notificationsSent + 1, nudges: r.nudges, status: 'pending_approval' };
  }
  m = path.match(/^\/beds\/(.+)\/pre-assign$/);
  if (m) {
    const p = s.patients.find((x) => x.id === body.patientId);
    const r = addRec({ type: 'pre_assignment', title: `Pre-assign ${p?.alias} to ${m[1]}`, status: 'approved', expectedImpact: 'Zero idle time between occupants', payload: { bedId: m[1], patientId: body.patientId, alias: p?.alias } });
    logEvent('BED_PRE_ASSIGNED', { bedId: m[1], patientId: body.patientId }, { recommendationId: r.id });
    return r;
  }
  if (path === '/ai-report') return aiReport(body.scope, body.format);
  if (path === '/demo/reset') {
    const events = s.events;
    S = buildState();
    S.events = events;
    logEvent('DEMO_RESET', {}, { ok: true });
    runAnalysis();
    return { reset: true };
  }
  if (path === '/demo/ambulance') return processEvent('AMBULANCE_INCOMING', { eta: 8, acuity: 1, age: 68, gender: 'M', ...body });
  if (path === '/demo/surge') {
    s.surgeFactor = 1.6;
    const free = s.beds.filter((b) => b.type === 'ed' && b.status === 'available').slice(0, 4);
    free.forEach((b, i) => {
      const p = { id: uid('ps'), alias: `PS${i + 1}`, acuity: [1, 2, 2, 3][i], status: 'admitted', bedId: b.id, department: 'Emergency', doctorId: 'doc-patel', doctorName: 'Dr. Sunita Patel', admittedAt: new Date().toISOString(), expectedDischarge: iso(Date.now() + 8 * H), dischargeDate: null, requiresImaging: true, requiresIcu: i === 0, pendingTasks: [] };
      s.patients.push(p);
      Object.assign(b, { status: 'occupied', patientId: p.id, expectedRelease: p.expectedDischarge, releaseConfidence: 0.6 });
      emit('bed.updated', { bedId: b.id, status: 'occupied' });
    });
    logEvent('DEMO_SURGE', { patients: free.length }, {});
    runAnalysis();
    return { injected: free.length };
  }
  throw new Error(`Mock route not found: POST ${path}`);
}

function matchPatch(path, body = {}) {
  const m = path.match(/^\/recommendations\/(.+)$/);
  if (m) {
    const r = st().recommendations.find((x) => x.id === m[1]);
    if (!r) throw new Error('Recommendation not found');
    r.status = body.status;
    logEvent('RECOMMENDATION_DECIDED', { id: r.id, decision: body.status }, {});
    return r;
  }
  throw new Error(`Mock route not found: PATCH ${path}`);
}

/* ───────────────────────── shared with careMock ───────────────────────── */

/** Live in-memory hospital (beds, patients, OT rooms, cases, staff). Shared with careMock. */
export function getFlowState() {
  return st();
}
export const FLOW_DOCTORS = DOCTORS;
export const FLOW_ME_DOCTOR = ME_DOCTOR;
export function pushNotification(title, message, type = 'general') {
  return notify(title, message, type);
}
export function emitLive(event, payload) {
  emit(event, payload);
}
export function recordEvent(type, payload, result) {
  return logEvent(type, payload, result);
}
export function patientReadiness(p) {
  return readiness(p);
}

export const flowMock = {
  async get(path, params) {
    await Promise.all([delay(), loadIcuModel()]);
    return matchGet(path, params);
  },
  async post(path, body) {
    await Promise.all([delay(), loadIcuModel()]);
    if (path === '/ai-report') await new Promise((r) => setTimeout(r, 900));
    return matchPost(path, body);
  },
  async patch(path, body) {
    await delay();
    return matchPatch(path, body);
  },
  async requestOt(body) {
    await delay();
    const p = st().patients.find((x) => x.id === body.patientId);
    logEvent('OT_REQUESTED', body, { alias: p?.alias });
    notify(`OT request: ${p?.alias || 'patient'}`, `${body.procedureName} (${body.urgency})`, 'ot_assigned');
    return { id: uid('otr'), status: 'pending', ...body };
  },
  async getNotifications() {
    await delay();
    return st().notifications;
  },
  async markNotificationRead(id) {
    const n = st().notifications.find((x) => x.id === id);
    if (n) n.isRead = true;
    return n;
  },
  async markAllNotificationsRead() {
    st().notifications.forEach((n) => {
      n.isRead = true;
    });
    return { success: true };
  },
};

export default flowMock;
