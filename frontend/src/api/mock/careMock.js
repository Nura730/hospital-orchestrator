/**
 * @file careMock.js
 * Patient-care data for the Doctor, Nurse, Patient, OT and Admin screens: patient profiles, treatment
 * journeys, today's schedules, requests, shared reports, nurse shifts and tasks, the doctor calendar and
 * the OT room board. Everything is derived from the same in-memory hospital as flowMock, so a discharge,
 * an OT completion or a cleaned bed shows up on every screen.
 *
 * Privacy rule: no clinical values (lab numbers, doses) are produced, only event names and statuses.
 */

import {
  getFlowState,
  FLOW_DOCTORS,
  FLOW_ME_DOCTOR,
  pushNotification,
  emitLive,
  recordEvent,
  patientReadiness,
} from './flowMock.js';
import { predictIcuNeed } from '../../ml/icuNeed.js';

const MIN = 60 * 1000;
const H = 60 * MIN;
const DAY = 24 * H;

/* ───────────────────────── helpers ───────────────────────── */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(key) {
  let a = hash(String(key));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length) % list.length];
const iso = (ms) => new Date(ms).toISOString();
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const pad = (n) => String(n).padStart(2, '0');

function startOfDay(ms = Date.now()) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function at(dayStartMs, hh, mm = 0) {
  return dayStartMs + hh * H + mm * MIN;
}

function dayIndex(admittedAt, ms) {
  return Math.round((startOfDay(ms) - startOfDay(new Date(admittedAt).getTime())) / DAY) + 1;
}

const clone = (x) => JSON.parse(JSON.stringify(x));

/* ───────────────────────── reference data ───────────────────────── */

const DIAGNOSES = {
  ICU: ['Septic shock', 'Acute respiratory failure', 'Post cardiac arrest care', 'Diabetic ketoacidosis', 'Severe pneumonia'],
  HDU: ['Acute kidney injury', 'Unstable angina', 'COPD exacerbation', 'Upper GI bleed'],
  'General Ward': ['Community-acquired pneumonia', 'Cellulitis, left leg', 'Heart failure exacerbation', 'Urinary tract infection', 'Type 2 diabetes, poor control', 'Dengue fever, monitoring'],
  Emergency: ['Chest pain, under evaluation', 'Abdominal pain, under evaluation', 'Head injury, observation', 'Fracture, awaiting fixation'],
  Radiology: ['Suspected stroke, imaging'],
  PACU: ['Post-operative recovery'],
};

const BLOOD_GROUPS = ['A+', 'B+', 'O+', 'AB+', 'A-', 'O-', 'B-'];
const PHONE = (id) => `+91 98450 ${String(10000 + (hash(id) % 89999)).slice(0, 5)}`;

const NURSES = [
  { id: 'nur-priya', name: 'Nurse Priya Sharma', department: 'General Ward', ward: 'General Ward A', beds: [...range('GW', 1, 10), 'ISO-05', 'ISO-06'], shift: ['08:00', '20:00'] },
  { id: 'nur-anita', name: 'Nurse Anita George', department: 'General Ward', ward: 'General Ward B', beds: range('GW', 11, 20), shift: ['08:00', '20:00'] },
  { id: 'nur-meera', name: 'Nurse Meera Iyer', department: 'General Ward', ward: 'General Ward C', beds: [...range('GW', 21, 25), ...range('ISO', 1, 4)], shift: ['08:00', '20:00'] },
  { id: 'nur-joseph', name: 'Nurse Joseph Mathew', department: 'ICU', ward: 'Critical Care Unit', beds: range('ICU', 1, 6), shift: ['08:00', '20:00'] },
  { id: 'nur-fatima', name: 'Nurse Fatima Khan', department: 'ICU', ward: 'Critical Care Unit', beds: range('ICU', 7, 12), shift: ['08:00', '20:00'] },
  { id: 'nur-rekha', name: 'Nurse Rekha Pillai', department: 'HDU', ward: 'High Dependency Ward', beds: range('HDU', 1, 8), shift: ['08:00', '20:00'] },
  { id: 'nur-sanjay', name: 'Nurse Sanjay Das', department: 'Emergency', ward: 'Emergency Observation', beds: range('ED', 1, 8), shift: ['08:00', '20:00'] },
  { id: 'nur-lakshmi', name: 'Nurse Lakshmi Rao', department: 'Emergency', ward: 'Emergency Observation', beds: range('ED', 9, 15), shift: ['08:00', '20:00'] },
  { id: 'nur-kiran', name: 'Nurse Kiran Bose', department: 'General Ward', ward: 'Post-Operative Recovery Ward', beds: range('PO', 1, 9), shift: ['08:00', '20:00'] },
  { id: 'nur-divya', name: 'Nurse Divya Menon', department: 'OT', ward: 'Operating Theatres', beds: [], shift: ['20:00', '08:00'] },
];
const ME_NURSE = 'nur-priya';
/** Bed of the patient who signs in to the patient portal. */
const PORTAL_BED = 'GW-04';
const PORTAL_NAME = 'Rahul Verma';

const SHIFT_PLAN = [
  ['08:00', '09:00', 'Morning rounds and vitals'],
  ['09:00', '10:00', 'Medication administration'],
  ['10:00', '12:00', 'Patient monitoring'],
  ['12:00', '13:00', 'Lunch break'],
  ['13:00', '15:00', 'Afternoon assessments'],
  ['15:00', '17:00', 'Documentation'],
  ['17:00', '19:00', 'Evening rounds'],
  ['19:00', '20:00', 'Handover preparation'],
];

export const REQUEST_TYPES = {
  doctor_review: 'Doctor Review Needed',
  bed_transfer: 'Bed Transfer Required',
  diagnostic_test: 'Diagnostic Test Required',
  discharge_approval: 'Discharge Approval',
  family_notification: 'Family Notification',
  equipment: 'Equipment Needed',
  nurse_assistance: 'Nurse Assistance',
  medication_query: 'Medication Query',
  dietary: 'Dietary Request',
  general_query: 'General Query',
};

export const TASK_TYPES = {
  medication: 'Administer medication',
  vitals: 'Take vitals',
  clean_bed: 'Clean bed',
  transport: 'Patient transport',
  document: 'Document update',
  notify_doctor: 'Doctor notification',
  pre_op: 'Pre-op preparation',
  post_op: 'Settle post-op patient',
};

function range(prefix, from, to) {
  return Array.from({ length: to - from + 1 }, (_, i) => `${prefix}-${pad(from + i)}`);
}

/* ───────────────────────── care state ───────────────────────── */

let C = null;

function care() {
  const S = getFlowState();
  if (C && C.flowRef === S) return C;
  C = buildCare(S);
  seedPortal(S, C);
  seedOtQueue(S, C);
  return C;
}

function buildCare(S) {
  const now = Date.now();
  const mine = S.patients.filter((p) => p.doctorId === FLOW_ME_DOCTOR && p.bedId && !p.pendingTasks?.length);
  // A doctor's board needs some admissions from today
  mine.slice(0, 2).forEach((p, i) => {
    // Earlier today, whatever the current hour
    p.admittedAt = iso(Math.min(now - (5 + i * 5) * MIN, Math.max(startOfDay(now) + (10 + i * 25) * MIN, now - (2.5 + i * 3) * H)));
  });
  const portal = S.patients.find((p) => p.bedId === PORTAL_BED);
  // The demo patient is looked after by the demo doctor, so requests flow between the two logins
  if (portal) {
    const me = FLOW_DOCTORS.find((d) => d.id === FLOW_ME_DOCTOR);
    portal.doctorId = me.id;
    portal.doctorName = me.name;
  }
  const otNeeded = {};
  for (const bedId of ['GW-05', 'HDU-02']) {
    const p = S.patients.find((x) => x.bedId === bedId);
    if (p) otNeeded[p.id] = { procedure: bedId === 'GW-05' ? 'Laparoscopic appendectomy' : 'Coronary angiography', requestedAt: iso(now - 50 * MIN), status: 'pending' };
  }

  const c = {
    flowRef: S,
    events: {}, // patientId -> [{ at, type, description, by }]
    requests: [],
    reports: [],
    otNeeded,
    doctorStatus: 'available',
    doctorEvents: [],
    nurseStatus: { [ME_NURSE]: 'on_duty' },
    tasks: [],
    roomCleaningSince: { 3: iso(now - 12 * MIN) },
    portalPatientId: portal?.id || null,
    otRequests: [],
  };

  // Seed nurse tasks for every nurse
  for (const n of NURSES) c.tasks.push(...seedTasks(S, n, now));

  return c;
}

/** Past requests and a shared report for the portal patient (runs after C is set). */
function seedOtQueue(S, c) {
  const seeds = [
    ['GW-05', 'Laparoscopic appendectomy', 'urgent', 75],
    ['HDU-02', 'Coronary angiography', 'emergency', 60],
  ];
  for (const [bedId, procedure, urgency, durationMin] of seeds) {
    const p = S.patients.find((x) => x.bedId === bedId);
    if (!p) continue;
    const d = doctorById(p.doctorId) || doctorByName(p.doctorName);
    const at = iso(Date.now() - 50 * MIN);
    c.otRequests.push({ id: uid('otr'), patientId: p.id, alias: p.alias, bedId: p.bedId, procedure, urgency, requestedBy: { id: d?.id || null, name: d?.name || p.doctorName }, preferredStart: null, durationMin, notes: '', status: 'pending', createdAt: at, linkedRequestId: null, history: [{ at, status: 'pending', by: d?.name || p.doctorName, text: `Requested by ${d?.name || p.doctorName}` }] });
    syncOtNeeded(c, p.id);
  }
}

function seedPortal(S, c) {
  const now = Date.now();
  const portal = S.patients.find((p) => p.id === c.portalPatientId);
  if (portal) {
    c.requests.push(
      { id: uid('req'), patientId: portal.id, alias: portal.alias, type: 'dietary', typeLabel: REQUEST_TYPES.dietary, priority: 'low', note: 'Vegetarian meals please.', status: 'addressed', source: 'patient', createdBy: PORTAL_NAME, createdAt: iso(now - 26 * H), addressedAt: iso(now - 25 * H) },
      { id: uid('req'), patientId: portal.id, alias: portal.alias, type: 'nurse_assistance', typeLabel: REQUEST_TYPES.nurse_assistance, priority: 'medium', note: 'Need help to walk to the washroom.', status: 'pending', source: 'patient', createdBy: PORTAL_NAME, createdAt: iso(now - 40 * MIN) }
    );
    c.reports.push(makeReport(S, c, portal, 'Admission summary', portal.doctorName, true, now - 20 * H));
  }
}

function seedTasks(S, nurse, now) {
  const tasks = [];
  const day = startOfDay(now);
  nurse.beds.forEach((bedId, i) => {
    const bed = S.beds.find((b) => b.id === bedId);
    if (!bed) return;
    const p = bed.patientId ? S.patients.find((x) => x.id === bed.patientId) : null;
    if (p) {
      const rand = seeded(`${p.id}-tasks`);
      tasks.push(task(nurse.id, 'vitals', p, bedId, at(day, 8, i * 4), 'done'));
      tasks.push(task(nurse.id, 'medication', p, bedId, at(day, 9, 10 + i * 3), now > at(day, 10) ? 'done' : 'pending'));
      tasks.push(task(nurse.id, 'vitals', p, bedId, nextSlot(now, 2, i * 5), 'pending', p.acuity <= 2 ? 'urgent' : 'normal'));
      if (rand() < 0.5) tasks.push(task(nurse.id, 'medication', p, bedId, nextSlot(now, 3, 15 + i * 2), 'pending'));
      if (rand() < 0.35) tasks.push(task(nurse.id, 'document', p, bedId, nextSlot(now, 4, i * 3), 'pending'));
      if (rand() < 0.2) tasks.push(task(nurse.id, 'transport', p, bedId, nextSlot(now, 1, 30), 'pending', 'normal', 'Radiology for imaging'));
    } else if (bed.status === 'cleaning') {
      tasks.push(task(nurse.id, 'clean_bed', null, bedId, now - 20 * MIN, 'pending', 'urgent', 'Bed released, needs cleaning before next admission'));
    }
  });
  return tasks;
}

function nextSlot(now, hoursAhead, minutes) {
  const d = new Date(now + hoursAhead * H);
  d.setMinutes(minutes % 60, 0, 0);
  return Math.max(d.getTime(), now + 10 * MIN);
}

function task(nurseId, type, p, bedId, dueMs, status = 'pending', priority = 'normal', notes = '') {
  return { id: uid('tsk'), nurseId, type, title: TASK_TYPES[type], patientId: p?.id || null, alias: p?.alias || null, bedId, dueAt: iso(dueMs), status, priority, notes, createdAt: iso(Date.now() - 3 * H), completedAt: status === 'done' ? iso(Math.min(dueMs + 10 * MIN, Date.now())) : null };
}

function addPatientEvent(patientId, type, description, by) {
  const c = care();
  (c.events[patientId] = c.events[patientId] || []).push({ at: new Date().toISOString(), type, description, by });
}

/* ───────────────────────── patient profile ───────────────────────── */

const doctorById = (id) => FLOW_DOCTORS.find((d) => d.id === id) || null;
const doctorByName = (name) => FLOW_DOCTORS.find((d) => d.name === name) || null;
const nurseForBed = (bedId) => NURSES.find((n) => n.beds.includes(bedId)) || null;

function zoneOf(S, p) {
  const bed = S.beds.find((b) => b.id === (p.bedId || p.lastBedId));
  return bed ? bed.zone : p.department;
}

function patientStatus(S, p) {
  if (p.status === 'discharged') return 'discharged';
  if (p.status === 'waiting') return 'waiting';
  if (S.cases.some((c) => c.status === 'in_progress' && c.patientAlias === p.alias)) return 'in_surgery';
  const bed = S.beds.find((b) => b.id === p.bedId);
  if (p.status === 'in_recovery' || bed?.type === 'post_op') return 'in_recovery';
  return 'admitted';
}

function buildProfile(S, p) {
  const c = care();
  const rand = seeded(p.id);
  const bed = S.beds.find((b) => b.id === (p.bedId || p.lastBedId)) || null;
  const zone = zoneOf(S, p);
  const doctor = doctorById(p.doctorId) || doctorByName(p.doctorName);
  const nurse = bed ? nurseForBed(bed.id) : null;
  const admittedAt = p.admittedAt || p.waitingSince || new Date().toISOString();
  const day = dayIndex(admittedAt, Date.now());
  const expected = p.expectedDischarge ? new Date(p.expectedDischarge).getTime() : Date.now() + 2 * DAY;
  const estimatedDays = Math.max(day, Math.ceil((expected - startOfDay(new Date(admittedAt).getTime())) / DAY));
  const otPending = c.otNeeded[p.id] || null;
  const requiresOt = Boolean(p.requiresOt || otPending);
  const isPortal = p.id === c.portalPatientId;
  return {
    patientId: p.id,
    alias: p.alias,
    name: isPortal ? PORTAL_NAME : null,
    // rand() is still drawn so the rest of the generated profile stays stable
    age: ((r) => p.age ?? 24 + Math.floor(r * 58))(rand()),
    gender: ((r) => (p.gender ? (p.gender === 'M' ? 'Male' : 'Female') : r < 0.52 ? 'Male' : 'Female'))(rand()),
    bloodGroup: pick(rand, BLOOD_GROUPS),
    status: patientStatus(S, p),
    acuity: p.acuity,
    critical: p.acuity <= 2,
    diagnosis: requiresOt && zone === 'PACU' ? DIAGNOSES.PACU[0] : pick(rand, DIAGNOSES[zone] || DIAGNOSES['General Ward']),
    admissionType: zone === 'ED' || zone === 'ICU' ? 'Emergency' : zone === 'PACU' ? 'Elective' : pick(rand, ['Emergency', 'Elective', 'Transfer']),
    admittedAt,
    dischargedAt: p.dischargedAt || null,
    daysAdmitted: day,
    estimatedStayDays: estimatedDays,
    expectedDischarge: p.expectedDischarge,
    bed: bed ? { id: bed.id, ward: bed.ward, floor: bed.floor, department: bed.department, type: bed.type } : null,
    requires: {
      icu: Boolean(p.requiresIcu || bed?.type === 'icu'),
      isolation: bed?.type === 'isolation',
      ventilator: bed?.type === 'icu' && p.acuity === 1 && rand() < 0.6,
      ot: requiresOt,
    },
    otPending,
    doctor: doctor ? { id: doctor.id, name: doctor.name, specialty: doctor.specialization, phone: PHONE(doctor.id) } : { id: null, name: p.doctorName || 'Unassigned', specialty: '', phone: '' },
    nurse: nurse ? { id: nurse.id, name: nurse.name, shift: `${nurse.shift[0]} - ${nurse.shift[1]}` } : null,
    otSurgeon: requiresOt ? (zone === 'PACU' ? 'Dr. Nathan Hughes' : otPending?.surgeon || 'To be assigned') : null,
    readiness: p.bedId ? patientReadiness(p).score : null,
    location: p.location || null,
    icuRisk: bed?.type === 'icu' ? null : predictIcuNeed({ age: p.age, gender: p.gender, acuity: p.acuity, requiresOt: requiresOt, arrivalTime: admittedAt }),
    icuWhatIf: bed?.type === 'icu' ? [] : icuWhatIf({ age: p.age, gender: p.gender, acuity: p.acuity, requiresOt, arrivalTime: admittedAt }),
  };
}

/* ───────────────────────── journey + schedule ───────────────────────── */

function generatedJourney(S, p, prof) {
  const out = [];
  const admitted = new Date(prof.admittedAt).getTime();
  const now = Date.now();
  const doc = prof.doctor.name;
  const ward = prof.bed?.ward || 'the ward';
  const push = (ms, type, description, by) => {
    if (ms <= now) out.push({ at: iso(ms), type, description, by });
  };
  push(admitted, 'admission', `Admitted (${prof.admissionType.toLowerCase()}) to ${ward}`, 'Admissions desk');
  push(admitted + 20 * MIN, 'consultation', `Initial assessment by ${doc}`, doc);
  push(admitted + 45 * MIN, 'test_ordered', prof.requires.icu ? 'Blood panel, chest X-ray and ECG ordered' : 'Blood panel and chest X-ray ordered', doc);
  push(admitted + 3 * H, 'test_result', 'Blood panel results reviewed', doc);
  push(admitted + 4 * H, 'medication', prof.requires.icu ? 'IV support therapy started' : 'Treatment plan started', prof.nurse?.name || 'Ward nurse');

  const lastDay = prof.dischargedAt ? dayIndex(prof.admittedAt, new Date(prof.dischargedAt).getTime()) : prof.daysAdmitted;
  for (let d = 2; d <= lastDay; d++) {
    const base = startOfDay(admitted) + (d - 1) * DAY;
    push(at(base, 8, 30), 'consultation', 'Morning ward round', doc);
    push(at(base, 10), 'medication', 'Morning medications given', prof.nurse?.name || 'Ward nurse');
    if (d % 2 === 0) {
      push(at(base, 11, 30), 'test_ordered', 'Follow-up blood tests ordered', doc);
      push(at(base, 15), 'test_result', 'Follow-up results reviewed', doc);
    }
    if (d === 2 && prof.requires.ot && prof.bed?.type === 'post_op') push(at(base, 13), 'procedure', 'Surgery completed, moved to recovery', prof.otSurgeon);
    if (d === 3) push(at(base, 12), 'status_change', prof.acuity <= 2 ? 'Condition stable, close monitoring continued' : 'Condition improving', doc);
    push(at(base, 17), 'doctor_note', d === lastDay ? 'Progress note updated' : 'Progress note: responding to treatment', doc);
  }
  if (prof.otPending) push(new Date(prof.otPending.requestedAt).getTime(), 'test_ordered', `OT requested: ${prof.otPending.procedure}`, doc);
  if (prof.dischargedAt) push(new Date(prof.dischargedAt).getTime(), 'discharge', 'Discharged home', doc);
  return out;
}

function journeyFor(S, p, prof) {
  const events = [...generatedJourney(S, p, prof), ...(care().events[p.id] || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
  const days = {};
  for (const e of events) {
    const n = dayIndex(prof.admittedAt, new Date(e.at).getTime());
    (days[n] = days[n] || { day: n, date: iso(startOfDay(new Date(e.at).getTime())), events: [] }).events.push(e);
  }
  return Object.values(days).sort((a, b) => b.day - a.day);
}

function scheduleFor(S, p, prof) {
  const day = startOfDay();
  const now = Date.now();
  const items = [
    [8, 0, 'vitals', 'Vitals check', prof.nurse?.name],
    [9, 30, 'consultation', 'Doctor round', prof.doctor.name],
    [11, 0, 'medication', 'Medication round', prof.nurse?.name],
    [14, 0, 'test', p.requiresImaging ? 'CT scan' : 'Blood test', 'Diagnostics'],
    [16, 30, 'consultation', 'Doctor review', prof.doctor.name],
    [20, 0, 'medication', 'Evening medication', prof.nurse?.name],
  ];
  if (prof.otPending) items.push([15, 30, 'procedure', `Pre-op assessment: ${prof.otPending.procedure}`, prof.otSurgeon]);
  return items
    .map(([h, m, type, label, by]) => {
      const t = at(day, h, m);
      return { at: iso(t), type, label, by: by || null, status: t + 30 * MIN < now ? 'done' : t <= now ? 'in_progress' : 'scheduled' };
    })
    .sort((a, b) => new Date(a.at) - new Date(b.at));
}

function requestsFor(patientId) {
  return care().requests.map(normaliseRequest).filter((r) => r.patientId === patientId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function patientById(S, patientId) {
  const p = S.patients.find((x) => x.id === patientId);
  if (!p) throw new Error('Patient not found');
  return p;
}

export function getPatientDetail(patientId) {
  const S = getFlowState();
  care();
  const p = patientById(S, patientId);
  const profile = buildProfile(S, p);
  return { profile, schedule: scheduleFor(S, p, profile), journey: journeyFor(S, p, profile), requests: requestsFor(p.id), reports: care().reports.filter((r) => r.patientId === p.id) };
}

/* ───────────────────────── reports ───────────────────────── */

function makeReport(S, c, p, title, doctorName, shared, createdMs = Date.now()) {
  const prof = buildProfile(S, p);
  const journey = journeyFor(S, p, prof)
    .slice()
    .sort((a, b) => a.day - b.day)
    .map((d) => ({ day: d.day, date: d.date, events: d.events.slice().reverse().map((e) => e.description) }));
  return {
    id: uid('rpt'),
    patientId: p.id,
    title,
    createdAt: iso(createdMs),
    doctorName: doctorName || prof.doctor.name,
    shared,
    content: {
      alias: prof.alias,
      name: prof.name,
      age: prof.age,
      gender: prof.gender,
      bloodGroup: prof.bloodGroup,
      admittedAt: prof.admittedAt,
      daysAdmitted: prof.daysAdmitted,
      diagnosis: prof.diagnosis,
      timeline: journey,
      careTeam: { doctor: `${prof.doctor.name}${prof.doctor.specialty ? `, ${prof.doctor.specialty}` : ''}`, nurse: prof.nurse?.name || 'Not assigned' },
      status: prof.status,
      acuity: prof.acuity,
    },
  };
}

export function generateReport(patientId, { by } = {}) {
  const S = getFlowState();
  const c = care();
  const p = patientById(S, patientId);
  const r = makeReport(S, c, p, `Patient medical report: Day ${dayIndex(p.admittedAt || new Date().toISOString(), Date.now())}`, by, false);
  c.reports.unshift(r);
  recordEvent('REPORT_GENERATED', { patientId }, { reportId: r.id });
  return r;
}

export function shareReport(reportId) {
  const c = care();
  const r = c.reports.find((x) => x.id === reportId);
  if (!r) throw new Error('Report not found');
  r.shared = true;
  r.sharedAt = new Date().toISOString();
  addPatientEvent(r.patientId, 'doctor_note', `Report shared with patient: ${r.title}`, r.doctorName);
  return r;
}

/* ───────────────────────── requests ───────────────────────── */

/** Who handles each request type. */
const REQUEST_ROUTES = {
  nurse_assistance: 'nurse',
  dietary: 'nurse',
  family_notification: 'nurse',
  medication_query: 'doctor',
  general_query: 'doctor',
  doctor_review: 'doctor',
  diagnostic_test: 'doctor',
  discharge_approval: 'doctor',
  bed_transfer: 'admin',
  equipment: 'admin',
};
export const OPEN_REQUEST = ['new', 'acknowledged', 'in_progress', 'scheduled'];
const STATUS_TEXT = { new: 'Sent', acknowledged: 'Seen', in_progress: 'In progress', scheduled: 'Scheduled', done: 'Resolved', declined: 'Declined' };

function routeFor(p, type) {
  const role = REQUEST_ROUTES[type] || 'admin';
  if (role === 'doctor') {
    const d = doctorById(p.doctorId) || doctorByName(p.doctorName);
    return { role, id: d?.id || p.doctorId, name: d?.name || p.doctorName || 'Attending doctor' };
  }
  if (role === 'nurse') {
    const n = p.bedId ? nurseForBed(p.bedId) : null;
    if (n) return { role, id: n.id, name: n.name };
  }
  return { role: 'admin', id: null, name: type === 'equipment' ? 'Equipment desk' : 'Bed management' };
}

/** Notification for specific people: audience = { roles, doctorIds?, nurseIds?, patientId? }. */
function notifyTo(audience, title, message, type = 'general', link = null) {
  const n = pushNotification(title, message, type);
  n.audience = audience;
  if (link) n.link = link;
  return n;
}

/** Tell whoever is responsible for a routed request. */
function notifyRoute(route, title, message, type) {
  if (route.role === 'doctor') return notifyTo({ roles: ['doctor'], doctorIds: [route.id] }, title, message, type, '/doctor/requests');
  if (route.role === 'nurse') return notifyTo({ roles: ['nurse'], nurseIds: [route.id] }, title, message, type, '/nurse/tasks');
  return notifyTo({ roles: ['admin'] }, title, message, type, '/admin/requests');
}

function normaliseRequest(r) {
  if (r.status === 'pending') r.status = 'new';
  if (r.status === 'addressed') r.status = 'done';
  if (!r.history) r.history = [{ at: r.createdAt, status: 'new', by: r.createdBy, text: 'Request sent' }];
  if (!r.routedTo) {
    const p = getFlowState().patients.find((x) => x.id === r.patientId);
    r.routedTo = p ? routeFor(p, r.type) : { role: 'admin', id: null, name: 'Bed management' };
  }
  return r;
}

export function createRequest({ patientId, type, priority = 'medium', note = '', source = 'admin', createdBy = 'Staff' }) {
  const S = getFlowState();
  const c = care();
  const p = patientById(S, patientId);
  if (!REQUEST_TYPES[type]) throw new Error('Unknown request type');
  const route = routeFor(p, type);
  const now = new Date().toISOString();
  const r = {
    id: uid('req'),
    patientId,
    alias: p.alias,
    bedId: p.bedId,
    type,
    typeLabel: REQUEST_TYPES[type],
    priority,
    note: String(note).slice(0, 200),
    status: 'new',
    source,
    createdBy,
    createdAt: now,
    routedTo: route,
    response: null,
    history: [{ at: now, status: 'new', by: createdBy, text: `Sent to ${route.name}` }],
  };
  c.requests.unshift(r);
  const urgent = priority === 'urgent' || type === 'nurse_assistance';
  notifyRoute(route, `${urgent ? 'Urgent: ' : ''}${r.typeLabel} from ${source === 'patient' ? `patient ${p.alias}` : createdBy}`, `${p.alias}${p.bedId ? ` in ${p.bedId}` : ''}: ${r.note || 'no message'}`, urgent ? 'alert' : 'request');
  if (urgent) emitLive('alert.created', { alertId: uid('alt'), severity: priority === 'urgent' ? 'critical' : 'high', title: `${r.typeLabel}: ${p.alias}`, description: r.note || `Raised by ${createdBy}` });
  // Nurse-handled requests become a task on the bedside nurse's list
  if (route.role === 'nurse') {
    const t = task(route.id, type === 'family_notification' ? 'document' : 'notify_doctor', p, p.bedId, Date.now() + 10 * MIN, 'pending', urgent ? 'urgent' : 'normal', `${r.typeLabel}: ${r.note || 'no message'}`);
    t.title = r.typeLabel;
    t.requestId = r.id;
    c.tasks.push(t);
  }
  addPatientEvent(p.id, 'doctor_note', `Request sent to ${route.name}: ${r.typeLabel}`, createdBy);
  recordEvent('REQUEST_CREATED', { patientId, type, priority, routedTo: route.name }, { requestId: r.id });
  return r;
}

/**
 * Move a request along: acknowledged, in_progress, scheduled, done or declined, with an optional reply.
 * @param {string} requestId
 * @param {string|{status: string, response?: string, by?: string, text?: string}} update
 */
export function updateRequest(requestId, update) {
  const c = care();
  const S = getFlowState();
  const r = c.requests.find((x) => x.id === requestId);
  if (!r) throw new Error('Request not found');
  normaliseRequest(r);
  const { status, response = null, by = r.routedTo?.name || 'Staff', text = null } = typeof update === 'string' ? { status: update } : update;
  const value = status === 'addressed' ? 'done' : status;
  if (!STATUS_TEXT[value]) throw new Error(`Unknown request status '${status}'`);
  r.status = value;
  if (response) r.response = String(response).slice(0, 300);
  if (value === 'done') r.addressedAt = new Date().toISOString();
  r.history.push({ at: new Date().toISOString(), status: value, by, text: text || (response ? `${STATUS_TEXT[value]}: ${response}` : STATUS_TEXT[value]) });
  const p = S.patients.find((x) => x.id === r.patientId);
  if (r.source === 'patient') notifyTo({ roles: ['patient'], patientId: r.patientId }, `${r.typeLabel}: ${STATUS_TEXT[value].toLowerCase()}`, text || response || `${by} updated your request`, 'request', '/patient/requests');
  else notifyTo({ roles: ['admin'] }, `${r.typeLabel} ${STATUS_TEXT[value].toLowerCase()} for ${r.alias}`, `${by}${response ? `: ${response}` : ''}`, 'request', '/admin/requests');
  if (p && value === 'done') addPatientEvent(p.id, 'doctor_note', `${r.typeLabel} resolved by ${by}`, by);
  // close the linked nurse task too
  if (['done', 'declined'].includes(value)) {
    for (const t of c.tasks.filter((x) => x.requestId === r.id && x.status !== 'done')) {
      t.status = 'done';
      t.completedAt = new Date().toISOString();
    }
  }
  return r;
}

/** Requests visible to a viewer: routed to them, or everything (admin). */
export function listRequests(role) {
  const c = care();
  const v = viewerFor(role);
  c.requests.forEach(normaliseRequest);
  const mine = c.requests.filter((r) => {
    if (role === 'admin') return true;
    if (role === 'doctor') return r.routedTo?.role === 'doctor' && r.routedTo.id === v.doctorId;
    if (role === 'nurse') return r.routedTo?.role === 'nurse' && r.routedTo.id === v.nurseId;
    if (role === 'patient') return r.patientId === v.patientId;
    return false;
  });
  const S = getFlowState();
  return mine
    .map((r) => {
      const p = S.patients.find((x) => x.id === r.patientId);
      return { ...r, bedId: p?.bedId ?? r.bedId, acuity: p?.acuity ?? null, patientStatus: p?.status ?? null, otRequest: (c.otRequests || []).find((o) => o.linkedRequestId === r.id) || null };
    })
    .sort((a, b) => Number(OPEN_REQUEST.includes(b.status)) - Number(OPEN_REQUEST.includes(a.status)) || new Date(b.createdAt) - new Date(a.createdAt));
}

/* ───────────────────────── admin lists ───────────────────────── */

export function listPatients() {
  const S = getFlowState();
  const c = care();
  return S.patients
    .filter((p) => p.status !== 'discharged')
    .map((p) => {
      const prof = buildProfile(S, p);
      return {
        patientId: p.id,
        alias: p.alias,
        bedId: p.bedId,
        ward: prof.bed?.ward || (p.status === 'waiting' ? 'Waiting for bed' : null),
        department: p.department,
        acuity: p.acuity,
        status: prof.status,
        doctorName: prof.doctor.name,
        admittedAt: p.admittedAt || p.waitingSince,
        daysAdmitted: prof.daysAdmitted,
        diagnosis: prof.diagnosis,
        requires: prof.requires,
        openRequests: c.requests.filter((r) => r.patientId === p.id && OPEN_REQUEST.includes(normaliseRequest(r).status)).length,
      };
    })
    .sort((a, b) => a.acuity - b.acuity || String(a.bedId).localeCompare(String(b.bedId)));
}

export function listNurses() {
  const S = getFlowState();
  const c = care();
  return NURSES.map((n) => {
    const beds = n.beds.map((id) => S.beds.find((b) => b.id === id)).filter(Boolean);
    const night = n.shift[0] === '20:00';
    return {
      id: n.id,
      name: n.name,
      department: n.department,
      ward: n.ward,
      shift: `${n.shift[0]} - ${n.shift[1]}`,
      status: c.nurseStatus[n.id] || (night ? 'off_duty' : 'on_duty'),
      beds: beds.length,
      bedRange: bedRange(n.beds),
      patients: beds.filter((b) => b.patientId).length,
      critical: beds.filter((b) => b.patientId && S.patients.find((p) => p.id === b.patientId)?.acuity <= 2).length,
      tasksPending: c.tasks.filter((t) => t.nurseId === n.id && t.status !== 'done').length,
    };
  });
}

function bedRange(beds) {
  if (!beds.length) return 'Theatre support';
  const gw = beds.filter((b) => b.startsWith(beds[0].split('-')[0]));
  const rest = beds.filter((b) => !gw.includes(b));
  return `${gw[0]} to ${gw[gw.length - 1]}${rest.length ? `, ${rest.join(', ')}` : ''}`;
}

/* ───────────────────────── nurse ───────────────────────── */

export function getNurseDashboard(nurseId = ME_NURSE) {
  const S = getFlowState();
  const c = care();
  const n = NURSES.find((x) => x.id === nurseId) || NURSES[0];
  const tasks = c.tasks.filter((t) => t.nurseId === n.id).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const beds = n.beds
    .map((id) => S.beds.find((b) => b.id === id))
    .filter(Boolean)
    .map((b) => {
      const p = b.patientId ? S.patients.find((x) => x.id === b.patientId) : null;
      const next = tasks.find((t) => t.bedId === b.id && t.status !== 'done');
      return { bedId: b.id, ward: b.ward, type: b.type, status: b.status, patientId: p?.id || null, alias: p?.alias || null, acuity: p?.acuity || null, nextTask: next ? { title: next.title, dueAt: next.dueAt } : null, lastCleanedAt: b.lastCleanedAt, cleaningSince: b.cleaningSince };
    });
  const patients = beds
    .filter((b) => b.patientId)
    .map((b) => {
      const p = S.patients.find((x) => x.id === b.patientId);
      const prof = buildProfile(S, p);
      const rand = seeded(`${p.id}-vitals`);
      const done = tasks.filter((t) => t.patientId === p.id && t.type === 'vitals' && t.status === 'done').sort((a, z) => new Date(z.completedAt) - new Date(a.completedAt))[0];
      const next = tasks.find((t) => t.patientId === p.id && t.status !== 'done');
      const overdue = tasks.some((t) => t.patientId === p.id && t.status !== 'done' && new Date(t.dueAt).getTime() < Date.now());
      return {
        patientId: p.id,
        alias: p.alias,
        bedId: b.bedId,
        acuity: p.acuity,
        status: prof.status,
        diagnosis: prof.diagnosis,
        lastVitalsAt: done ? done.completedAt : iso(Date.now() - (40 + rand() * 120) * MIN),
        nextTask: next ? { id: next.id, title: next.title, dueAt: next.dueAt } : null,
        alert: p.acuity <= 2 ? 'Critical' : overdue ? 'Task overdue' : null,
      };
    })
    .sort((a, b) => a.acuity - b.acuity);
  // Current shift window: start today (or yesterday for a night shift still running), end after start
  const [bh, bm] = n.shift[0].split(':').map(Number);
  const [eh, em] = n.shift[1].split(':').map(Number);
  const shiftStart = new Date();
  shiftStart.setHours(bh, bm, 0, 0);
  const shiftEnd = new Date(shiftStart);
  shiftEnd.setHours(eh, em, 0, 0);
  if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);
  const now = Date.now();
  if (shiftStart.getTime() - DAY <= now && shiftEnd.getTime() - DAY > now) {
    // Overnight shift that started yesterday and is still running
    shiftStart.setDate(shiftStart.getDate() - 1);
    shiftEnd.setDate(shiftEnd.getDate() - 1);
  } else if (shiftEnd.getTime() <= now) {
    // Today's shift is over: show the next one
    shiftStart.setDate(shiftStart.getDate() + 1);
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }
  return {
    nurse: { id: n.id, name: n.name, department: n.department, ward: n.ward, shift: `${n.shift[0]} - ${n.shift[1]}`, shiftStartsAt: iso(shiftStart.getTime()), shiftEndsAt: iso(shiftEnd.getTime()), status: c.nurseStatus[n.id] || 'on_duty' },
    allocation: { ward: n.ward, bedRange: bedRange(n.beds), time: `${n.shift[0]} - ${n.shift[1]}` },
    shiftPlan: SHIFT_PLAN.map(([start, end, label]) => ({ start, end, label })),
    patients,
    tasks,
    beds,
  };
}

export function setNurseStatus(status, nurseId = ME_NURSE) {
  care().nurseStatus[nurseId] = status;
  return { status };
}

export function updateTask(taskId, status) {
  const t = care().tasks.find((x) => x.id === taskId);
  if (!t) throw new Error('Task not found');
  t.status = status;
  t.completedAt = status === 'done' ? new Date().toISOString() : null;
  if (status === 'done' && t.patientId) addPatientEvent(t.patientId, t.type === 'medication' ? 'medication' : 'status_change', `${t.title} completed`, NURSES.find((n) => n.id === t.nurseId)?.name);
  if (status === 'done' && t.type === 'clean_bed') {
    const bed = getFlowState().beds.find((b) => b.id === t.bedId);
    if (bed && bed.status === 'cleaning') {
      Object.assign(bed, { status: 'available', cleaningSince: null, lastCleanedAt: new Date().toISOString() });
      emitLive('bed.updated', { bedId: bed.id, status: 'available', patientId: null });
    }
  }
  return t;
}

export function addTask({ type, patientId, bedId, dueAt, notes, priority = 'normal' }, nurseId = ME_NURSE) {
  const S = getFlowState();
  const p = patientId ? S.patients.find((x) => x.id === patientId) : null;
  const t = task(nurseId, type, p, bedId || p?.bedId || null, new Date(dueAt).getTime(), 'pending', priority, notes || '');
  t.createdAt = new Date().toISOString();
  care().tasks.push(t);
  return t;
}

export function addNote(patientId, note, by = 'Nurse') {
  addPatientEvent(patientId, 'doctor_note', `Nursing note: ${String(note).slice(0, 200)}`, by);
  return { ok: true };
}

export function alertDoctor(patientId, message, by = 'Nurse') {
  const S = getFlowState();
  const p = patientById(S, patientId);
  pushNotification(`Nurse alert: ${p.alias} (${p.bedId})`, message || `Please review ${p.alias}`, 'alert');
  emitLive('alert.created', { alertId: uid('alt'), severity: 'high', title: `Nurse alert: ${p.alias}`, description: message || 'Doctor review requested' });
  addPatientEvent(p.id, 'doctor_note', `Doctor alerted by ${by}`, by);
  return { ok: true };
}

/* ───────────────────────── doctor ───────────────────────── */

const SURGERIES = ['Cardiac bypass', 'Valve repair', 'Laparoscopic cholecystectomy', 'Hernia repair', 'Appendectomy'];

function generatedDoctorEvents(dayStart, myAliases) {
  const d = new Date(dayStart);
  const rand = seeded(`doc-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  const events = [];
  const ev = (h, m, dur, type, title, location, alias = null) => events.push({ id: `gen-${dayStart}-${h}${m}-${type}`, start: iso(at(dayStart, h, m)), end: iso(at(dayStart, h, m) + dur * MIN), type, title, location, alias });
  if (!weekend) ev(9, 0, 60, 'rounds', 'Morning rounds', 'General Ward A');
  const consults = weekend ? (rand() < 0.5 ? 1 : 0) : 1 + Math.floor(rand() * 3);
  const slots = [[10, 30], [11, 30], [15, 0]];
  for (let i = 0; i < consults; i++) {
    const alias = myAliases.length ? myAliases[Math.floor(rand() * myAliases.length)] : `PF${100 + i}`;
    ev(slots[i][0], slots[i][1], 30, 'consultation', `Consultation: ${alias}`, `Room ${2 + i}`, alias);
  }
  if ((!weekend && rand() < 0.4) || dayStart === startOfDay()) {
    const s = pick(rand, SURGERIES);
    ev(13, 30, 150, 'surgery', `Surgery: ${s}`, `OT-${1 + Math.floor(rand() * 4)}`);
  }
  if (rand() < 0.14) ev(18, 0, 45, 'emergency', 'Emergency call', 'Emergency Department');
  return events;
}

function myPatientsRaw(S) {
  return S.patients.filter((p) => p.doctorId === FLOW_ME_DOCTOR);
}

/** ICU risk under one change at a time (acuity one step better or worse, surgery planned or not). */
function icuWhatIf(base) {
  const now = predictIcuNeed(base);
  if (!now) return [];
  const a = Number(base.acuity) || 3;
  const out = [];
  const add = (label, inputs) => {
    const r = predictIcuNeed({ ...base, ...inputs });
    if (r) out.push({ label, probability: r.probability, delta: r.probability - now.probability });
  };
  if (a < 5) add(`If acuity improves to ${a + 1}`, { acuity: a + 1 });
  if (a > 1) add(`If acuity worsens to ${a - 1}`, { acuity: a - 1 });
  add(base.requiresOt ? 'If surgery is no longer needed' : 'If surgery becomes necessary', { requiresOt: !base.requiresOt });
  return out;
}

export function getDoctorEvents(fromMs, toMs) {
  const S = getFlowState();
  const c = care();
  const aliases = myPatientsRaw(S).filter((p) => p.bedId).map((p) => p.alias);
  const out = [];
  for (let d = startOfDay(fromMs); d <= toMs; d += DAY) {
    // DST-safe: normalise to local midnight each step
    const day = startOfDay(d + 2 * H);
    out.push(...generatedDoctorEvents(day, aliases));
    if (day === startOfDay()) {
      const review = myPatientsRaw(S).find((p) => p.bedId && p.acuity <= 3);
      if (review) out.push({ id: `gen-${day}-review`, start: iso(at(day, 16, 30)), end: iso(at(day, 17)), type: 'consultation', title: `Review: ${review.alias}`, location: review.bedId, alias: review.alias });
    }
  }
  out.push(...c.doctorEvents.filter((e) => new Date(e.start).getTime() >= startOfDay(fromMs) && new Date(e.start).getTime() <= toMs));
  return out.sort((a, b) => new Date(a.start) - new Date(b.start));
}

export function addDoctorEvent({ start, durationMin = 30, type = 'consultation', title, location = '' }) {
  const e = { id: uid('evt'), start: iso(new Date(start).getTime()), end: iso(new Date(start).getTime() + durationMin * MIN), type, title: title || 'Reminder', location, custom: true };
  care().doctorEvents.push(e);
  pushNotification(`Reminder added: ${e.title}`, `${new Date(e.start).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}${location ? ` · ${location}` : ''}`);
  return e;
}

const DOCTOR_STATUSES = ['available', 'in_surgery', 'in_consultation', 'on_break', 'off_duty', 'emergency'];

/** Same values as the backend (PATCH /doctor/status). 'break' is accepted as an alias of 'on_break'. */
export function setDoctorStatus(status) {
  const value = status === 'break' ? 'on_break' : status;
  if (!DOCTOR_STATUSES.includes(value)) throw new Error(`Unknown status '${status}'`);
  const c = care();
  c.doctorStatus = value;
  const me = FLOW_DOCTORS.find((d) => d.id === FLOW_ME_DOCTOR);
  if (me) me.status = value;
  emitLive('doctor.statusChanged', { doctorId: FLOW_ME_DOCTOR, staffId: FLOW_ME_DOCTOR, name: me?.name, newStatus: value });
  return { status: value };
}

export function getDoctorDashboard() {
  const S = getFlowState();
  const c = care();
  const me = FLOW_DOCTORS.find((d) => d.id === FLOW_ME_DOCTOR);
  const today = startOfDay();
  const all = myPatientsRaw(S);
  const active = all.filter((p) => p.bedId && p.status !== 'discharged');
  const rows = active
    .map((p) => {
      const prof = buildProfile(S, p);
      return { patientId: p.id, alias: p.alias, bedId: p.bedId, ward: prof.bed?.ward, acuity: p.acuity, status: prof.status, admittedAt: p.admittedAt, daysAdmitted: prof.daysAdmitted, diagnosis: prof.diagnosis, readiness: prof.readiness, otPending: Boolean(c.otNeeded[p.id]), icuRisk: prof.icuRisk };
    })
    .sort((a, b) => a.acuity - b.acuity || a.daysAdmitted - b.daysAdmitted);
  const admittedToday = rows.filter((r) => new Date(r.admittedAt).getTime() >= today);
  const dischargedToday = all.filter((p) => p.status === 'discharged' && p.dischargedAt && new Date(p.dischargedAt).getTime() >= today).map((p) => ({ patientId: p.id, alias: p.alias, bedId: p.lastBedId, at: p.dischargedAt, done: true }));
  const dueToday = rows.filter((r) => r.readiness >= 60).map((r) => ({ patientId: r.patientId, alias: r.alias, bedId: r.bedId, readiness: r.readiness, done: false }));
  const myWards = [...new Set(active.map((p) => S.beds.find((b) => b.id === p.bedId)?.ward).filter(Boolean))];
  const freeBeds = S.beds.filter((b) => myWards.includes(b.ward) && b.status !== 'occupied').slice(0, 3);
  const bedStatus = [
    ...rows.map((r) => ({ bedId: r.bedId, state: r.acuity <= 2 ? 'critical' : 'occupied', alias: r.alias, patientId: r.patientId })),
    ...freeBeds.map((b) => ({ bedId: b.id, state: b.status === 'cleaning' ? 'cleaning' : 'available', alias: null, patientId: null })),
  ];
  const todayEvents = getDoctorEvents(today, today + DAY - 1);
  const surgeries = todayEvents.filter((e) => e.type === 'surgery');
  const pendingRequests = listRequests('doctor').filter((r) => ['new', 'acknowledged'].includes(r.status));
  return {
    doctor: { id: me.id, name: me.name, specialty: me.specialization, department: me.department, status: c.doctorStatus, shiftEnd: '20:00' },
    stats: {
      patientsToday: rows.length,
      surgeriesScheduled: surgeries.length,
      surgeriesDone: surgeries.filter((e) => new Date(e.end).getTime() < Date.now()).length,
      dischargesToday: dischargedToday.length + dueToday.length,
      pendingTasks: pendingRequests.length + dueToday.length,
    },
    admittedToday,
    discharges: [...dischargedToday, ...dueToday],
    bedStatus,
    patients: rows,
    schedule: todayEvents,
    pendingRequests,
  };
}

export function requestOtForPatient(patientId, procedure, by) {
  return escalateToOt(null, patientId, { procedure, urgency: 'urgent' }, by);
}

export function updatePatientStatus(patientId, { acuity, note }, by) {
  const S = getFlowState();
  const p = patientById(S, patientId);
  if (acuity && acuity !== p.acuity) {
    const from = p.acuity;
    p.acuity = Math.max(1, Math.min(5, Number(acuity)));
    p.status = p.acuity <= 2 ? 'critical' : p.status === 'critical' ? 'admitted' : p.status;
    addPatientEvent(p.id, 'status_change', `Acuity changed from ${from} to ${p.acuity}`, by);
    emitLive('patient.updated', { patientId: p.id, acuity: p.acuity, status: p.status });
  }
  if (note) addPatientEvent(p.id, 'doctor_note', String(note).slice(0, 200), by);
  return buildProfile(S, p);
}

/* ───────────────────────── OT board ───────────────────────── */

function activity(S, d) {
  const now = Date.now();
  const live = S.cases.find((c) => c.status === 'in_progress' && (c.surgeon === d.name || c.anesthetist === d.name));
  switch (d.status) {
    case 'in_surgery':
      return live ? { text: `In OT-${live.roomId} (${live.procedure})`, freeAt: iso(live.end) } : { text: 'In surgery', freeAt: iso(now + 60 * MIN) };
    case 'in_consultation':
      return { text: 'In consultation', freeAt: iso(now + 25 * MIN) };
    case 'emergency':
      return { text: 'Handling emergency in ED', freeAt: iso(now + 45 * MIN) };
    case 'on_break':
      return { text: 'On break', freeAt: iso(now + 15 * MIN) };
    case 'off_duty':
      return { text: 'Off duty', freeAt: null };
    default:
      return { text: 'Available', freeAt: null };
  }
}

export function getDoctorAvailability() {
  const S = getFlowState();
  care();
  return FLOW_DOCTORS.map((d) => {
    const cases = S.cases.filter((c) => c.surgeon === d.name || c.anesthetist === d.name);
    const a = activity(S, d);
    return { id: d.id, name: d.name, specialty: d.specialization, department: d.department, status: d.status, available: d.status === 'available', surgeriesToday: cases.filter((c) => c.status !== 'scheduled').length, surgeriesPlanned: cases.length, maxPerDay: 4, activity: a.text, freeAt: a.freeAt };
  });
}

export function getOtBoard() {
  const S = getFlowState();
  const c = care();
  const now = Date.now();
  const rooms = S.otRooms.map((r) => {
    const live = S.cases.find((x) => x.roomId === r.id && x.status === 'in_progress');
    const next = S.cases.filter((x) => x.roomId === r.id && x.status === 'scheduled').sort((a, b) => a.start - b.start)[0];
    const base = { roomId: r.id, name: r.name, rawStatus: r.status };
    if (live) {
      const pct = Math.max(2, Math.min(99, Math.round(((now - live.start) / (live.end - live.start)) * 100)));
      return { ...base, state: 'in_surgery', case: { id: live.id, caseNumber: live.caseNumber, alias: live.patientAlias, procedure: live.procedure, surgeon: live.surgeon, startedAt: iso(live.start), expectedEnd: iso(live.end), progress: pct, overrun: now > live.end } };
    }
    if (r.status === 'cleaning') {
      const since = c.roomCleaningSince[r.id] || iso(now - 10 * MIN);
      return { ...base, state: 'cleaning', cleaningSince: since, readyAt: iso(new Date(since).getTime() + 30 * MIN) };
    }
    if (r.status === 'maintenance') return { ...base, state: 'maintenance' };
    return { ...base, state: 'available', nextCase: next ? { id: next.id, caseNumber: next.caseNumber, alias: next.patientAlias, procedure: next.procedure, surgeon: next.surgeon, start: iso(next.start) } : null };
  });
  const cases = S.cases.slice().sort((a, b) => a.start - b.start).map((x) => ({ id: x.id, caseNumber: x.caseNumber, alias: x.patientAlias, procedure: x.procedure, roomId: x.roomId, room: `OT-${x.roomId}`, surgeon: x.surgeon, urgency: x.urgency, status: x.status, start: iso(x.start), end: iso(x.end), postOpWard: x.postOpWard }));
  return { rooms, cases, doctors: getDoctorAvailability(), generatedAt: new Date().toISOString() };
}

export function delayCase(caseId, minutes = 30) {
  const x = getFlowState().cases.find((cs) => cs.id === caseId);
  if (!x) throw new Error('Case not found');
  x.end += minutes * MIN;
  for (const later of getFlowState().cases.filter((cs) => cs.roomId === x.roomId && cs.status === 'scheduled' && cs.start < x.end)) {
    later.start += minutes * MIN;
    later.end += minutes * MIN;
  }
  pushNotification(`${x.caseNumber} delayed ${minutes} min`, `${x.procedure} in OT-${x.roomId}`);
  recordEvent('OT_DELAYED', { caseId, minutes }, {});
  return { caseId, expectedEnd: iso(x.end) };
}

export function markRoomReady(roomId) {
  const S = getFlowState();
  const r = S.otRooms.find((x) => x.id === Number(roomId));
  if (!r) throw new Error('Room not found');
  r.status = 'available';
  delete care().roomCleaningSince[r.id];
  emitLive('ot.roomUpdated', { roomId: r.id, status: 'available' });
  recordEvent('OT_ROOM_READY', { roomId: r.id }, {});
  return { roomId: r.id, status: 'available' };
}

export function noteRoomCleaning(roomId) {
  care().roomCleaningSince[roomId] = new Date().toISOString();
}

export function assignCase(roomId, caseId) {
  const S = getFlowState();
  const r = S.otRooms.find((x) => x.id === Number(roomId));
  if (!r) throw new Error('Room not found');
  if (S.cases.some((x) => x.roomId === r.id && x.status === 'in_progress')) throw new Error('Room is busy');
  const x = caseId ? S.cases.find((cs) => cs.id === caseId) : S.cases.filter((cs) => cs.status === 'scheduled').sort((a, b) => (a.roomId === r.id ? -1 : 0) - (b.roomId === r.id ? -1 : 0) || a.start - b.start)[0];
  if (!x) throw new Error('No scheduled case to start');
  const dur = x.end - x.start;
  Object.assign(x, { roomId: r.id, status: 'in_progress', start: Date.now(), end: Date.now() + dur });
  r.status = 'in_surgery';
  const surgeon = FLOW_DOCTORS.find((d) => d.name === x.surgeon);
  if (surgeon) surgeon.status = 'in_surgery';
  onCaseStarted(S, care(), x);
  pushNotification(`${x.caseNumber} started in ${r.name}`, `${x.procedure} · ${x.surgeon}`);
  emitLive('ot.roomUpdated', { roomId: r.id, status: 'in_surgery' });
  recordEvent('OT_STARTED', { caseId: x.id, roomId: r.id }, {});
  return { caseId: x.id, roomId: r.id };
}

export function assignOtDoctor(patientId, doctorId, { roomId, start } = {}) {
  const c = care();
  let o = (c.otRequests || []).find((x) => x.patientId === patientId && x.status === 'pending');
  if (!o) o = escalateToOt(null, patientId, { procedure: c.otNeeded[patientId]?.procedure }, 'OT coordinator');
  return scheduleOtRequest(o.id, { surgeonId: doctorId, roomId: Number(roomId) || 4, start: start || iso(Date.now() + 2 * H), durationMin: o.durationMin }, 'OT coordinator');
}

export function assignSurgeon(caseId, doctorId) {
  const S = getFlowState();
  const x = S.cases.find((cs) => cs.id === caseId);
  const d = FLOW_DOCTORS.find((dd) => dd.id === doctorId);
  if (!x || !d) throw new Error('Case or doctor not found');
  if (x.status !== 'scheduled') throw new Error('Only scheduled cases can be reassigned');
  x.surgeon = d.name;
  pushNotification(`${x.caseNumber} assigned to ${d.name}`, `${x.procedure} · OT-${x.roomId} at ${new Date(x.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`, 'ot_assigned');
  recordEvent('OT_SURGEON_ASSIGNED', { caseId, doctorId }, {});
  return { caseId, surgeon: d.name };
}

/* ───────────────────────── OT request queue ───────────────────────── */

const URGENCY_RANK = { emergency: 0, urgent: 1, elective: 2 };
const SURGICAL = /surg|ortho|anesth|trauma|cardio/i;
const hhmm = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

function syncOtNeeded(c, patientId) {
  const active = (c.otRequests || [])
    .filter((o) => o.patientId === patientId && ['pending', 'scheduled', 'in_progress'].includes(o.status))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  if (!active) {
    delete c.otNeeded[patientId];
    return;
  }
  c.otNeeded[patientId] = {
    procedure: active.procedure,
    requestedAt: active.createdAt,
    status: active.status === 'pending' ? 'pending' : 'scheduled',
    surgeon: active.surgeon || null,
    room: active.roomId ? `OT-${active.roomId}` : null,
    start: active.start || null,
    otRequestId: active.id,
  };
}

/**
 * Doctor sends a patient for surgery scheduling, optionally answering a patient request.
 * @returns the OT request
 */
export function escalateToOt(requestId, patientId, { procedure, urgency = 'urgent', preferredStart = null, durationMin = 90, notes = '' } = {}, by = 'Doctor') {
  const S = getFlowState();
  const c = care();
  const p = patientById(S, patientId);
  const doctor = FLOW_DOCTORS.find((d) => d.name === by) || doctorById(p.doctorId) || FLOW_DOCTORS.find((d) => d.id === FLOW_ME_DOCTOR);
  const now = new Date().toISOString();
  const o = {
    id: uid('otr'),
    patientId: p.id,
    alias: p.alias,
    bedId: p.bedId,
    procedure: procedure || 'Procedure to be confirmed',
    urgency,
    requestedBy: { id: doctor?.id || null, name: by },
    preferredStart: preferredStart ? iso(new Date(preferredStart).getTime()) : null,
    durationMin: Number(durationMin) || 90,
    notes: String(notes || '').slice(0, 200),
    status: 'pending',
    createdAt: now,
    linkedRequestId: requestId || null,
    history: [{ at: now, status: 'pending', by, text: `Requested by ${by}` }],
  };
  (c.otRequests = c.otRequests || []).unshift(o);
  syncOtNeeded(c, p.id);
  if (requestId) updateRequest(requestId, { status: 'in_progress', by, text: `Sent to the theatre team for scheduling: ${o.procedure}` });
  notifyTo({ roles: ['ot_manager'] }, `New OT request: ${o.procedure}`, `${p.alias}${p.bedId ? ` (${p.bedId})` : ''}, ${urgency}, from ${by}`, urgency === 'emergency' ? 'alert' : 'ot_assigned', '/ot/requests');
  notifyTo({ roles: ['admin'] }, `OT requested for ${p.alias}`, `${o.procedure} (${urgency}) by ${by}`, 'ot_assigned', '/admin/requests');
  if (p.id === c.portalPatientId && !requestId) notifyTo({ roles: ['patient'], patientId: p.id }, 'Surgery being scheduled', `${by} asked the theatre team to schedule: ${o.procedure}`, 'request', '/patient/requests');
  addPatientEvent(p.id, 'test_ordered', `OT requested: ${o.procedure}`, by);
  recordEvent('OT_REQUESTED', { patientId: p.id, urgency }, { otRequestId: o.id });
  return o;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/** Earliest time (15-minute steps, next 24 h) when a surgical surgeon and a theatre are both free. */
function nextFreeSlot(fromMs, durationMin) {
  const step = 15 * MIN;
  let t = Math.ceil(fromMs / step) * step;
  for (let i = 0; i < 96; i++, t += step) {
    const a = otAvailabilityAt(t, durationMin);
    if (a.rooms.some((r) => r.free) && a.surgeons.some((s) => s.free && s.surgical)) return iso(t);
  }
  return null;
}

/** Which surgeons and theatres are free for [start, start + duration), plus the next fully free slot. */
export function otAvailability(start, durationMin = 90) {
  const startMs = start ? new Date(start).getTime() : Date.now() + H;
  const a = otAvailabilityAt(startMs, durationMin);
  const ok = a.rooms.some((r) => r.free) && a.surgeons.some((s) => s.free && s.surgical);
  return { ...a, nextFree: ok ? null : nextFreeSlot(startMs + 15 * MIN, durationMin) };
}

function otAvailabilityAt(start, durationMin = 90) {
  const S = getFlowState();
  const now = Date.now();
  const startMs = start ? new Date(start).getTime() : now + H;
  const endMs = startMs + (Number(durationMin) || 90) * MIN;
  const active = S.cases.filter((x) => ['scheduled', 'in_progress'].includes(x.status));
  const soon = startMs - now < 60 * MIN;
  const surgeons = FLOW_DOCTORS.map((d) => {
    const mine = active.filter((x) => x.surgeon === d.name);
    const clash = mine.find((x) => overlaps(startMs, endMs, x.start, x.end));
    let reason = null;
    if (d.status === 'off_duty') reason = 'Off duty';
    else if (clash) reason = `Booked for ${clash.procedure} in OT-${clash.roomId} until ${hhmm(clash.end)}`;
    else if (soon && ['in_surgery', 'emergency'].includes(d.status)) reason = d.status === 'emergency' ? 'Handling an emergency' : 'In surgery now';
    const next = mine.filter((x) => x.end > now).sort((a, b) => a.start - b.start);
    return {
      id: d.id,
      name: d.name,
      specialty: d.specialization,
      status: d.status,
      surgical: SURGICAL.test(d.specialization),
      free: !reason,
      reason,
      casesToday: S.cases.filter((x) => x.surgeon === d.name).length,
      nextCase: next[0] ? { procedure: next[0].procedure, start: iso(next[0].start), end: iso(next[0].end), room: `OT-${next[0].roomId}` } : null,
    };
  }).sort((a, b) => Number(b.free) - Number(a.free) || Number(b.surgical) - Number(a.surgical) || a.casesToday - b.casesToday);
  const rooms = S.otRooms.map((r) => {
    const clash = active.find((x) => x.roomId === r.id && overlaps(startMs, endMs, x.start, x.end));
    let reason = null;
    if (r.status === 'maintenance') reason = 'Maintenance';
    else if (clash) reason = `${clash.procedure} until ${hhmm(clash.end)}`;
    else if (soon && r.status === 'cleaning') reason = 'Being cleaned';
    return { roomId: r.id, name: r.name, free: !reason, reason };
  });
  return { start: iso(startMs), end: iso(endMs), surgeons, rooms };
}

export function listOtRequests() {
  const S = getFlowState();
  const c = care();
  return (c.otRequests || [])
    .map((o) => {
      const p = S.patients.find((x) => x.id === o.patientId);
      const prof = p ? buildProfile(S, p) : null;
      return { ...o, bedId: p?.bedId ?? o.bedId, ward: prof?.bed?.ward || null, acuity: p?.acuity ?? null, age: prof?.age ?? null, doctorName: prof?.doctor.name || null, diagnosis: prof?.diagnosis || null, icuRisk: prof?.icuRisk || null, patientStatus: p?.status || null, location: p?.location || null };
    })
    .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || new Date(a.createdAt) - new Date(b.createdAt));
}

/** OT manager books a pending request: surgeon + theatre + time. Updates everyone involved. */
export function scheduleOtRequest(otRequestId, { surgeonId, roomId, start, durationMin } = {}, by = 'OT Manager') {
  const S = getFlowState();
  const c = care();
  const o = (c.otRequests || []).find((x) => x.id === otRequestId);
  if (!o) throw new Error('OT request not found');
  if (o.status !== 'pending') throw new Error('This request is already handled');
  const dur = Number(durationMin) || o.durationMin || 90;
  const avail = otAvailability(start, dur);
  const surgeon = avail.surgeons.find((x) => x.id === surgeonId);
  const room = avail.rooms.find((x) => x.roomId === Number(roomId));
  if (!surgeon) throw new Error('Choose a surgeon');
  if (!surgeon.free) throw new Error(`${surgeon.name} is not free: ${surgeon.reason}`);
  if (!room) throw new Error('Choose a theatre');
  if (!room.free) throw new Error(`${room.name} is not free: ${room.reason}`);
  const p = patientById(S, o.patientId);
  const startMs = new Date(avail.start).getTime();
  const n = S.cases.length + 1;
  const caseRow = {
    id: `case-${n}-${Date.now()}`,
    caseNumber: `OTC-2026-${String(n).padStart(3, '0')}`,
    procedure: o.procedure,
    roomId: room.roomId,
    surgeon: surgeon.name,
    surgeonId: surgeon.id,
    status: 'scheduled',
    urgency: o.urgency,
    start: startMs,
    end: startMs + dur * MIN,
    postOpRequired: true,
    postOpWard: 'Post-Operative Recovery Ward',
    patientAlias: p.alias,
    patientId: p.id,
    otRequestId: o.id,
  };
  S.cases.push(caseRow);
  const t = hhmm(startMs);
  Object.assign(o, { status: 'scheduled', caseId: caseRow.id, surgeon: surgeon.name, surgeonId: surgeon.id, roomId: room.roomId, start: iso(startMs), end: iso(caseRow.end) });
  o.history.push({ at: new Date().toISOString(), status: 'scheduled', by, text: `Booked ${room.name} at ${t} with ${surgeon.name}` });
  syncOtNeeded(c, p.id);
  if (o.linkedRequestId) updateRequest(o.linkedRequestId, { status: 'scheduled', by, text: `Surgery booked: ${room.name} at ${t} with ${surgeon.name}` });

  // Bedside nurse: preparation and transport tasks
  const nurse = p.bedId ? nurseForBed(p.bedId) : null;
  if (nurse) {
    const prep = task(nurse.id, 'pre_op', p, p.bedId, Math.max(Date.now() + 10 * MIN, startMs - 60 * MIN), 'pending', o.urgency === 'emergency' ? 'urgent' : 'normal', `${o.procedure} at ${t} in ${room.name}`);
    const move = task(nurse.id, 'transport', p, p.bedId, Math.max(Date.now() + 15 * MIN, startMs - 15 * MIN), 'pending', 'normal', `Take to ${room.name} for ${o.procedure}`);
    prep.otRequestId = o.id;
    move.otRequestId = o.id;
    c.tasks.push(prep, move);
    notifyTo({ roles: ['nurse'], nurseIds: [nurse.id] }, `Pre-op: ${p.alias} to ${room.name} at ${t}`, `${o.procedure} with ${surgeon.name}`, 'ot_assigned', '/nurse/tasks');
  }
  const ids = [...new Set([o.requestedBy.id, surgeon.id, p.doctorId].filter(Boolean))];
  notifyTo({ roles: ['doctor'], doctorIds: ids }, `Surgery booked: ${p.alias} at ${t}`, `${o.procedure} in ${room.name} with ${surgeon.name}`, 'ot_assigned', '/doctor/ot-cases');
  notifyTo({ roles: ['admin'] }, `Surgery booked: ${p.alias}`, `${o.procedure} in ${room.name} at ${t}`, 'ot_assigned', '/admin/requests');
  if (p.id === c.portalPatientId && !o.linkedRequestId) notifyTo({ roles: ['patient'], patientId: p.id }, `Your surgery is booked for ${t}`, `${o.procedure} with ${surgeon.name} in ${room.name}`, 'request', '/patient/dashboard');
  addPatientEvent(p.id, 'procedure', `Surgery booked: ${o.procedure} with ${surgeon.name}, ${room.name} at ${t}`, by);
  emitLive('ot.roomUpdated', { roomId: room.roomId });
  recordEvent('OT_SCHEDULED', { otRequestId: o.id, surgeon: surgeon.name, room: room.name }, { caseId: caseRow.id });
  return o;
}

export function declineOtRequest(otRequestId, reason = '', by = 'OT Manager') {
  const c = care();
  const o = (c.otRequests || []).find((x) => x.id === otRequestId);
  if (!o) throw new Error('OT request not found');
  if (o.status !== 'pending') throw new Error('Only pending requests can be declined');
  o.status = 'declined';
  o.history.push({ at: new Date().toISOString(), status: 'declined', by, text: reason ? `Declined: ${reason}` : 'Declined' });
  syncOtNeeded(c, o.patientId);
  if (o.linkedRequestId) updateRequest(o.linkedRequestId, { status: 'declined', by, response: reason || 'The theatre team could not take this request' });
  notifyTo({ roles: ['doctor'], doctorIds: [o.requestedBy.id].filter(Boolean) }, `OT request declined: ${o.alias}`, reason || o.procedure, 'alert', '/doctor/ot-cases');
  return o;
}

/** Surgery starts: the patient leaves their ward bed, which goes to housekeeping. */
function onCaseStarted(S, c, x) {
  const p = x.patientId ? S.patients.find((pp) => pp.id === x.patientId) : null;
  const o = x.otRequestId ? (c.otRequests || []).find((r) => r.id === x.otRequestId) : null;
  if (o) {
    o.status = 'in_progress';
    o.history.push({ at: new Date().toISOString(), status: 'in_progress', by: x.surgeon, text: `Surgery started in OT-${x.roomId}` });
  }
  if (!p || !p.bedId) return;
  const bed = S.beds.find((b) => b.id === p.bedId);
  const nurse = nurseForBed(p.bedId);
  p.preOpBedId = p.bedId;
  p.bedId = null;
  p.location = `OT-${x.roomId}`;
  if (bed) {
    Object.assign(bed, { status: 'cleaning', patientId: null, expectedRelease: null, cleaningSince: new Date().toISOString() });
    emitLive('bed.updated', { bedId: bed.id, status: 'cleaning', patientId: null });
  }
  for (const tk of c.tasks.filter((tt) => tt.patientId === p.id && tt.status !== 'done' && tt.otRequestId === x.otRequestId)) {
    tk.status = 'done';
    tk.completedAt = new Date().toISOString();
  }
  if (nurse && bed) c.tasks.push(task(nurse.id, 'clean_bed', null, bed.id, Date.now(), 'pending', 'urgent', `${p.alias} went to OT-${x.roomId}; prepare the bed for the next admission`));
  syncOtNeeded(c, p.id);
  notifyTo({ roles: ['doctor'], doctorIds: [p.doctorId, x.surgeonId].filter(Boolean) }, `${p.alias} is in surgery`, `${x.procedure} started in OT-${x.roomId}`, 'ot_assigned', '/doctor/ot-cases');
  notifyTo({ roles: ['admin'] }, `Housekeeping: clean ${bed?.id}`, `${p.alias} moved to OT-${x.roomId}`, 'general', '/admin/flow/housekeeping');
  if (p.id === c.portalPatientId) notifyTo({ roles: ['patient'], patientId: p.id }, 'Your surgery has started', `${x.procedure} in OT-${x.roomId}`, 'request', '/patient/dashboard');
  addPatientEvent(p.id, 'procedure', `Surgery started: ${x.procedure} (OT-${x.roomId})`, x.surgeon);
}

/** After OT_COMPLETE (flowMock moves the patient into a recovery bed): close the loop for everyone. */
export function onCaseCompleted(caseId) {
  const S = getFlowState();
  const c = care();
  const x = S.cases.find((cs) => cs.id === caseId);
  if (!x || !x.patientId) return { ok: true };
  const p = S.patients.find((pp) => pp.id === x.patientId);
  const where = p?.bedId ? `recovering in ${p.bedId}` : p?.status === 'waiting' ? 'waiting for a recovery bed' : 'in recovery';
  const o = x.otRequestId ? (c.otRequests || []).find((r) => r.id === x.otRequestId) : null;
  if (o) {
    o.status = 'completed';
    o.history.push({ at: new Date().toISOString(), status: 'completed', by: x.surgeon, text: `Surgery completed, ${where}` });
    if (o.linkedRequestId) updateRequest(o.linkedRequestId, { status: 'done', by: x.surgeon, text: `Surgery completed, ${where}` });
  }
  if (p) {
    syncOtNeeded(c, p.id);
    const nurse = p.bedId ? nurseForBed(p.bedId) : null;
    if (nurse) {
      c.tasks.push(task(nurse.id, 'post_op', p, p.bedId, Date.now() + 5 * MIN, 'pending', 'urgent', `Back from ${x.procedure}`));
      notifyTo({ roles: ['nurse'], nurseIds: [nurse.id] }, `Post-op arrival: ${p.alias} in ${p.bedId}`, x.procedure, 'alert', '/nurse/tasks');
    }
    notifyTo({ roles: ['doctor'], doctorIds: [p.doctorId, x.surgeonId].filter(Boolean) }, `Surgery completed: ${p.alias}`, `${x.procedure}, ${where}`, 'ot_assigned', '/doctor/patients');
    if (p.id === c.portalPatientId && !o?.linkedRequestId) notifyTo({ roles: ['patient'], patientId: p.id }, 'Surgery completed', `You are ${where}`, 'request', '/patient/dashboard');
    addPatientEvent(p.id, 'procedure', `Surgery completed; ${where}`, x.surgeon);
  }
  return { ok: true };
}

/** Move a patient to another bed type (e.g. recovery to general ward). The old bed goes to cleaning. */
export function transferPatient(patientId, toType = 'general', by = 'Doctor') {
  const S = getFlowState();
  const c = care();
  const p = patientById(S, patientId);
  const from = S.beds.find((b) => b.id === p.bedId);
  // Ward beds only (radiology bays share the 'general' type but are not ward beds)
  const WARD_ZONE = { general: 'General Ward', icu: 'ICU', hdu: 'HDU', post_op: 'PACU', isolation: 'General Ward' };
  const to = S.beds.find((b) => b.type === toType && b.zone === (WARD_ZONE[toType] || b.zone) && b.status === 'available');
  if (!to) throw new Error(`No free ${toType === 'general' ? 'general ward' : toType} bed right now`);
  if (from) {
    Object.assign(from, { status: 'cleaning', patientId: null, expectedRelease: null, cleaningSince: new Date().toISOString() });
    const n = nurseForBed(from.id);
    if (n) c.tasks.push(task(n.id, 'clean_bed', null, from.id, Date.now(), 'pending', 'urgent', `${p.alias} moved to ${to.id}`));
    emitLive('bed.updated', { bedId: from.id, status: 'cleaning', patientId: null });
  }
  Object.assign(to, { status: 'occupied', patientId: p.id, expectedRelease: iso(Date.now() + 24 * H), releaseConfidence: 0.7 });
  Object.assign(p, { bedId: to.id, department: to.department, status: p.acuity <= 2 ? 'critical' : 'admitted', location: null });
  emitLive('bed.updated', { bedId: to.id, status: 'occupied', patientId: p.id });
  const nn = nurseForBed(to.id);
  if (nn) {
    c.tasks.push(task(nn.id, 'transport', p, to.id, Date.now() + 10 * MIN, 'pending', 'normal', `Receive ${p.alias} from ${from?.id || 'recovery'}`));
    notifyTo({ roles: ['nurse'], nurseIds: [nn.id] }, `Incoming: ${p.alias} to ${to.id}`, `From ${from?.id || 'recovery'}`, 'general', '/nurse/beds');
  }
  notifyTo({ roles: ['admin'] }, `${p.alias} moved to ${to.id}`, `${from?.id || 'Previous bed'} needs cleaning`, 'general', '/admin/flow/housekeeping');
  if (p.id === c.portalPatientId) notifyTo({ roles: ['patient'], patientId: p.id }, `You moved to ${to.id}`, `${to.ward}, floor ${to.floor}`, 'request', '/patient/dashboard');
  addPatientEvent(p.id, 'status_change', `Moved from ${from?.id || 'recovery'} to ${to.id} (${to.ward})`, by);
  recordEvent('PATIENT_TRANSFERRED', { patientId: p.id, from: from?.id, to: to.id }, {});
  return { patientId: p.id, from: from?.id || null, to: to.id };
}

/* ───────────────────────── who is looking (demo identities) ───────────────────────── */

export function viewerFor(role) {
  const c = care();
  return { role, doctorId: role === 'doctor' ? FLOW_ME_DOCTOR : null, nurseId: role === 'nurse' ? ME_NURSE : null, patientId: role === 'patient' ? c.portalPatientId : null };
}

function viewerKey(v) {
  return `${v.role}:${v.doctorId || v.nurseId || v.patientId || ''}`;
}

/** Notifications without an audience are staff broadcasts (admin, doctors, OT). */
function canSee(n, v) {
  const a = n.audience;
  if (!a) return ['admin', 'doctor', 'ot_manager'].includes(v.role);
  if (!a.roles.includes(v.role)) return false;
  if (v.role === 'doctor' && a.doctorIds && !a.doctorIds.includes(v.doctorId)) return false;
  if (v.role === 'nurse' && a.nurseIds && !a.nurseIds.includes(v.nurseId)) return false;
  if (v.role === 'patient' && a.patientId !== v.patientId) return false;
  return true;
}

const isReadFor = (n, v) => Boolean(n.readBy?.[viewerKey(v)] || (!n.audience && n.isRead));

/** Live counts for the sidebar. */
export function getBadgeCounts(role) {
  const c = care();
  const v = viewerFor(role);
  const out = { notifications: getFlowState().notifications.filter((n) => canSee(n, v) && !isReadFor(n, v)).length };
  if (role === 'doctor') out.requests = listRequests('doctor').filter((r) => ['new', 'acknowledged'].includes(r.status)).length;
  if (role === 'ot_manager') out.otRequests = (c.otRequests || []).filter((o) => o.status === 'pending').length;
  if (role === 'admin') {
    c.requests.forEach(normaliseRequest);
    out.requests = c.requests.filter((r) => OPEN_REQUEST.includes(r.status)).length + (c.otRequests || []).filter((o) => o.status === 'pending').length;
    out.cleaning = getFlowState().beds.filter((b) => b.status === 'cleaning').length;
  }
  if (role === 'nurse') out.tasks = c.tasks.filter((t) => t.nurseId === v.nurseId && t.status !== 'done').length;
  if (role === 'patient') out.requests = listRequests('patient').filter((r) => OPEN_REQUEST.includes(r.status)).length;
  return out;
}

/* ───────────────────────── patient journey page ───────────────────────── */

export function getJourney(patientId) {
  const S = getFlowState();
  const c = care();
  const p = patientById(S, patientId);
  const prof = buildProfile(S, p);
  const admitted = new Date(prof.admittedAt).getTime();
  const now = Date.now();
  const done = (ms, by, mins) => ({ status: 'done', at: iso(ms), by, durationMin: mins });
  const ot = c.otNeeded[p.id];
  const hadOt = prof.bed?.type === 'post_op';
  const discharged = p.status === 'discharged';
  const ready = (prof.readiness || 0) >= 60;
  const steps = [
    { key: 'registration', label: 'Registration', ...done(admitted - 50 * MIN, 'Front desk', 8) },
    { key: 'triage', label: 'Triage', ...done(admitted - 40 * MIN, prof.nurse?.name || 'Triage nurse', 10) },
    { key: 'consultation', label: 'Consultation', ...done(admitted - 25 * MIN, prof.doctor.name, 20) },
    { key: 'diagnostics', label: 'Diagnostics', ...(p.requiresImaging && prof.daysAdmitted === 1 ? { status: 'in_progress', at: iso(admitted + 45 * MIN), by: 'Radiology' } : done(admitted + 45 * MIN, 'Diagnostics lab', 135)) },
    { key: 'admission', label: 'Admission', ...done(admitted, `Bed ${prof.bed?.id || '—'}`, 15) },
    { key: 'treatment', label: 'Treatment', ...(discharged ? done(admitted + H, prof.doctor.name, Math.round((new Date(p.dischargedAt).getTime() - admitted) / MIN)) : { status: hadOt || (ot && ot.status !== 'scheduled') ? 'done' : 'in_progress', at: iso(admitted + H), by: prof.doctor.name, durationMin: hadOt || (ot && ot.status !== 'scheduled') ? Math.round((now - admitted) / MIN) : null }) },
    { key: 'ot', label: 'OT', ...(hadOt ? done(admitted + DAY, prof.otSurgeon, 120) : ot ? { status: ot.status === 'scheduled' ? 'pending' : 'in_progress', at: ot.start || ot.requestedAt, by: ot.surgeon || 'Awaiting surgeon', detail: ot.procedure } : { status: 'skipped', by: 'Not required' }) },
    { key: 'recovery', label: 'Recovery', ...(hadOt ? { status: 'in_progress', at: iso(admitted + DAY + 2 * H), by: prof.nurse?.name } : ot ? { status: 'pending' } : { status: 'skipped', by: 'Not required' }) },
    { key: 'discharge', label: 'Discharge', ...(discharged ? done(new Date(p.dischargedAt).getTime(), prof.doctor.name, 30) : { status: ready && !ot ? 'in_progress' : 'pending', by: ready ? 'Discharge being prepared' : null }) },
  ];
  // Only one step may be "in progress": the first one
  let seen = false;
  for (const s of steps) {
    if (s.status === 'in_progress') {
      if (seen) s.status = 'pending';
      seen = true;
    }
  }
  const log = journeyFor(S, p, prof).flatMap((d) => d.events).sort((a, b) => new Date(a.at) - new Date(b.at));
  return { profile: prof, steps, log, needsOt: Boolean(ot && ot.status !== 'scheduled'), ot: ot || null, doctors: getDoctorAvailability() };
}

/* ───────────────────────── patient portal ───────────────────────── */

export function getPortal() {
  const S = getFlowState();
  const c = care();
  const p = S.patients.find((x) => x.id === c.portalPatientId) || S.patients.find((x) => x.bedId);
  const detail = getPatientDetail(p.id);
  const today = startOfDay();
  return {
    ...detail,
    name: PORTAL_NAME,
    reports: detail.reports.filter((r) => r.shared),
    stats: {
      daysAdmitted: detail.profile.daysAdmitted,
      proceduresToday: detail.schedule.filter((s) => ['test', 'procedure'].includes(s.type) && new Date(s.at).getTime() >= today).length,
      pendingTests: detail.schedule.filter((s) => s.type === 'test' && s.status !== 'done').length,
      doctorName: detail.profile.doctor.name,
    },
    nextEvent: detail.schedule.find((s) => s.status !== 'done') || null,
  };
}

export function submitPortalRequest({ type, message }) {
  const c = care();
  return createRequest({ patientId: c.portalPatientId, type, priority: type === 'nurse_assistance' ? 'high' : 'medium', note: message, source: 'patient', createdBy: PORTAL_NAME });
}

/* ───────────────────────── notifications ───────────────────────── */

export function getNotifications(role = 'admin') {
  const v = viewerFor(role);
  return getFlowState()
    .notifications.filter((n) => canSee(n, v))
    .map((n) => ({ ...n, isRead: isReadFor(n, v) }));
}

export function markAllRead(role = 'admin') {
  const v = viewerFor(role);
  const key = viewerKey(v);
  getFlowState().notifications.forEach((n) => {
    if (!canSee(n, v)) return;
    n.readBy = { ...(n.readBy || {}), [key]: true };
  });
  return { ok: true };
}

export function markRead(id, role = 'admin') {
  const v = viewerFor(role);
  const n = getFlowState().notifications.find((x) => x.id === id);
  if (n) n.readBy = { ...(n.readBy || {}), [viewerKey(v)]: true };
  return n;
}

/* ───────────────────────── shared state (hospitalSync) ───────────────────────── */

export function exportCareState() {
  const { flowRef, ...rest } = care(); // eslint-disable-line no-unused-vars
  return rest;
}

/** Call after importFlowState so the care data points at the new hospital. */
export function importCareState(data) {
  C = { ...data, flowRef: getFlowState() };
}

export { clone };
