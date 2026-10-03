/**
 * Flow Intelligence demo seed — `npm run seed:flow`
 *
 * Requires the core seed (`npm run db:setup`) to have run first.
 * Creates (idempotently):
 *   - 4 weeks of hourly arrivals_history per department
 *   - Radiology imaging bays (RAD-01..04) → ~79 beds across ED / Radiology / Ward / HDU / ICU / PACU
 *   - nursing, float and housekeeping roster (flow_staff)
 *   - 40 historical discharged patients (LOS model training data)
 *   - flow cohort patients so ~60 beds are occupied (~76% occupancy)
 *   - 24h of hourly kpi_snapshots
 * and applies a deterministic demo state (applyDemoState) that the "Reset demo data" button re-applies:
 *   General Ward = root cause (MEDIUM), ICU + OT = cascade, 3 discharge-ready patients each blocked
 *   by one admin task, ICU-04 free for the ambulance demo, OT schedule re-timed around "now".
 */
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');
const logger = require('../src/utils/logger');

const DEMO_DOCTOR_EMAIL = 'vikram.seth@hospital.com';

/** Deterministic PRNG so every reset produces the same hospital. */
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

async function deptMap(client) {
  const res = await client.query('SELECT id, name FROM departments');
  const map = Object.fromEntries(res.rows.map((r) => [r.name, r.id]));
  for (const name of ['Emergency', 'General Ward', 'ICU', 'HDU', 'OT', 'Radiology']) {
    if (!map[name]) throw new Error(`Department '${name}' missing. Run "npm run db:setup" before "npm run seed:flow".`);
  }
  return map;
}

async function doctorMap(client) {
  const res = await client.query(
    `SELECT d.id, u.email, dep.name AS dept FROM doctors d JOIN users u ON u.id = d.id LEFT JOIN departments dep ON dep.id = d.department_id ORDER BY u.email`
  );
  const byDept = {};
  for (const r of res.rows) (byDept[r.dept] = byDept[r.dept] || []).push(r.id);
  const demo = res.rows.find((r) => r.email === DEMO_DOCTOR_EMAIL);
  return { byDept, all: res.rows.map((r) => r.id), demoDoctorId: demo ? demo.id : res.rows[0] && res.rows[0].id };
}

/* ───────────────────────── static structure (idempotent) ───────────────────────── */

async function seedRadiologyBays(client, depts) {
  for (let i = 1; i <= 4; i++) {
    await client.query(
      `INSERT INTO beds (id, department_id, ward, type, status, has_monitor, has_oxygen, floor, room_number)
       VALUES ($1, $2, 'Imaging Bay', 'general', 'available', TRUE, TRUE, '1', $3)
       ON CONFLICT (id) DO NOTHING`,
      [`RAD-${pad(i)}`, depts.Radiology, `IMG-${i}`]
    );
  }
}

async function seedStaff(client, depts) {
  await client.query('DELETE FROM flow_staff');
  const plan = [
    ['Emergency', 'nurse', 3],
    ['General Ward', 'nurse', 7],
    ['ICU', 'nurse', 5],
    ['HDU', 'nurse', 2],
    ['OT', 'nurse', 1],
    ['General Ward', 'float_nurse', 1],
    ['ICU', 'float_nurse', 1],
    ['Emergency', 'float_nurse', 1],
    ['General Ward', 'housekeeping', 2],
    ['Emergency', 'housekeeping', 1],
    ['ICU', 'housekeeping', 1],
  ];
  const first = ['Asha', 'Ben', 'Chloe', 'Dev', 'Elena', 'Farid', 'Grace', 'Hiro', 'Isla', 'Jonah', 'Kiran', 'Lena', 'Mateo', 'Nadia', 'Omar', 'Pia', 'Quinn', 'Rosa', 'Sanjay', 'Tara', 'Uma', 'Victor', 'Wen', 'Yara', 'Zane'];
  let i = 0;
  for (const [dept, role, count] of plan) {
    for (let k = 0; k < count; k++) {
      const name = `${first[i % first.length]} ${role === 'housekeeping' ? 'HK' : role === 'float_nurse' ? 'Float' : 'RN'}-${pad(i + 1)}`;
      await client.query(
        `INSERT INTO flow_staff (full_name, role, department_id, on_shift, shift_start, shift_end)
         VALUES ($1, $2, $3, $4, '07:00', '19:00')`,
        [name, role, depts[dept], !(role === 'float_nurse' && dept === 'Emergency')]
      );
      i++;
    }
  }
  // Two extra off-shift nurses for roster realism
  await client.query(
    `INSERT INTO flow_staff (full_name, role, department_id, on_shift, shift_start, shift_end)
     VALUES ('Night RN-90', 'nurse', $1, FALSE, '19:00', '07:00'), ('Night RN-91', 'nurse', $2, FALSE, '19:00', '07:00')`,
    [depts['General Ward'], depts.ICU]
  );
}

async function seedArrivalsHistory(client, depts) {
  await client.query('DELETE FROM arrivals_history');
  // base arrivals/hour, admission rate, high-acuity share
  const profile = [
    ['Emergency', 4.0, 0.32, 0.12],
    ['General Ward', 1.4, 0.9, 0.05],
    ['ICU', 0.35, 0.95, 0.6],
    ['HDU', 0.45, 0.9, 0.3],
    ['Radiology', 2.5, 0.15, 0.05],
    ['OT', 0.6, 0.9, 0.2],
  ];
  for (const [name, base, rate, hi] of profile) {
    await client.query(
      `INSERT INTO arrivals_history (department_id, hour_start, arrivals, admitted, high_acuity)
       SELECT $1, h, a, LEAST(a, FLOOR(a * $3::float + random())), LEAST(a, FLOOR(a * $4::float + random()))
       FROM (
         SELECT h,
           GREATEST(0, ROUND(
             $2::float
             * (0.62 + 0.38 * sin(2 * pi() * (EXTRACT(HOUR FROM h AT TIME ZONE 'UTC') - 8) / 24))
             * CASE EXTRACT(DOW FROM h AT TIME ZONE 'UTC') WHEN 1 THEN 1.15 WHEN 0 THEN 0.85 WHEN 6 THEN 0.88 ELSE 1 END
             + (random() - 0.5) * $2::float * 0.5
           ))::int AS a
         FROM generate_series(date_trunc('hour', NOW()) - INTERVAL '28 days', date_trunc('hour', NOW()) - INTERVAL '1 hour', INTERVAL '1 hour') AS h
       ) s
       ON CONFLICT (department_id, hour_start) DO NOTHING`,
      [depts[name], base, rate, hi]
    );
  }
}

async function seedKpiHistory(client) {
  const existing = await client.query(`SELECT COUNT(*)::int AS n FROM kpi_snapshots WHERE ts > NOW() - INTERVAL '24 hours'`);
  if (existing.rows[0].n >= 12) return;
  await client.query(`
    INSERT INTO kpi_snapshots (ts, total_patients, waiting_patients, admitted_patients, critical_patients, discharged_today,
      total_beds, occupied_beds, available_beds, icu_occupied, icu_total, ot_in_progress, ot_available,
      doctors_available, doctors_in_surgery, avg_wait_minutes, bed_occupancy_pct, icu_occupancy_pct, ot_utilization_pct)
    SELECT h,
      70, 4, 58, 6, 3,
      79, ROUND(79 * occ / 100), 79 - ROUND(79 * occ / 100), ROUND(12 * icu / 100), 12, 2, 2,
      6, 2,
      ROUND((28 + 8 * sin(2 * pi() * (EXTRACT(HOUR FROM h) - 10) / 24) + random() * 4)::numeric, 1),
      occ, icu,
      ROUND((62 + 18 * sin(2 * pi() * (EXTRACT(HOUR FROM h) - 9) / 24) + random() * 5)::numeric, 1)
    FROM (
      SELECT h,
        ROUND((72 + 4 * sin(2 * pi() * (EXTRACT(HOUR FROM h) - 8) / 24) + random() * 2)::numeric, 1) AS occ,
        ROUND((84 + 6 * sin(2 * pi() * (EXTRACT(HOUR FROM h) - 6) / 24) + random() * 3)::numeric, 1) AS icu
      FROM generate_series(NOW() - INTERVAL '24 hours', NOW() - INTERVAL '5 minutes', INTERVAL '1 hour') AS h
    ) s
  `);
}

async function seedDischargedHistory(client, depts, docs) {
  const rand = rng(4242);
  const losBase = { 1: 120, 2: 72, 3: 48, 4: 24, 5: 8 };
  const deptCycle = ['General Ward', 'General Ward', 'ICU', 'HDU', 'Emergency'];
  for (let i = 1; i <= 40; i++) {
    const acuity = 1 + Math.floor(rand() * 5);
    const dept = acuity <= 2 && rand() < 0.6 ? 'ICU' : deptCycle[i % deptCycle.length];
    const los = losBase[acuity] * (0.7 + rand() * 0.6);
    const daysAgo = 2 + rand() * 25;
    const doctors = docs.byDept[dept] || docs.all;
    await client.query(
      `INSERT INTO patients (patient_id, full_name, date_of_birth, status, acuity, department_id, assigned_doctor_id,
                             admission_date, discharge_date, diagnosis)
       VALUES ($1, $2, DATE '1960-01-01' + $3::int, 'discharged', $4, $5, $6,
               NOW() - ($7 || ' days')::interval - ($8 || ' hours')::interval,
               NOW() - ($7 || ' days')::interval, 'Historical stay')
       ON CONFLICT (patient_id) DO NOTHING`,
      [`PH${String(i).padStart(4, '0')}`, `History Patient ${i}`, Math.floor(rand() * 18000), acuity, depts[dept], doctors[i % doctors.length], daysAgo.toFixed(2), los.toFixed(1)]
    );
  }
}

/* ───────────────────────── demo state (re-applied by Reset) ───────────────────────── */

const ZONE_LAYOUT = {
  ED: { occupied: ['ED-01', 'ED-02', 'ED-03', 'ED-04', 'ED-05', 'ED-06', 'ED-07', 'ED-08', 'ED-09'], cleaning: ['ED-10'] },
  Radiology: { occupied: ['RAD-01', 'RAD-02'], cleaning: [] },
  ICU: { occupied: ['ICU-01', 'ICU-02', 'ICU-03', 'ICU-05', 'ICU-06', 'ICU-07', 'ICU-08', 'ICU-09', 'ICU-10', 'ICU-11', 'ICU-12'], cleaning: [] },
  HDU: { occupied: ['HDU-01', 'HDU-02', 'HDU-03', 'HDU-04', 'HDU-05'], cleaning: [] },
  Ward: {
    occupied: [
      ...Array.from({ length: 25 }, (_, i) => `GW-${pad(i + 1)}`),
      'ISO-01', 'ISO-02', 'ISO-03', 'ISO-04',
      'PO-01', 'PO-02', 'PO-03', 'PO-04',
    ],
    cleaning: ['ISO-05', 'PO-05', 'PO-06', 'PO-07'],
  },
};

const READY_TRIO = [
  { bed: 'GW-03', task: 'Pharmacy reconciliation pending', hours: 1.5, acuity: 4 },
  { bed: 'GW-07', task: 'Transport not booked', hours: 2, acuity: 5 },
  { bed: 'GW-12', task: 'Discharge summary unsigned', hours: 3, acuity: 4 },
];

async function applyDemoState(client) {
  const depts = await deptMap(client);
  const docs = await doctorMap(client);
  const rand = rng(1337);

  // 0. Remove surge patients injected by the demo controls
  await client.query(`UPDATE beds SET patient_id = NULL WHERE patient_id IN (SELECT id FROM patients WHERE patient_id LIKE 'PS%')`);
  await client.query(`DELETE FROM patient_timeline WHERE patient_id IN (SELECT id FROM patients WHERE patient_id LIKE 'PS%')`);
  await client.query(`DELETE FROM patients WHERE patient_id LIKE 'PS%'`);

  // 1. Revert OT cases completed through the flow engine so the demo can be replayed
  await client.query(`
    UPDATE ot_cases SET status = 'in_progress', actual_end = NULL, actual_duration_min = NULL
    WHERE id::text IN (
      SELECT payload->>'caseId' FROM flow_events WHERE event_type = 'OT_COMPLETE' AND processed = TRUE
      UNION SELECT result->>'caseId' FROM flow_events WHERE event_type = 'OT_COMPLETE' AND processed = TRUE
    )`);
  // Re-open patients discharged through the flow engine (except history patients)
  await client.query(`
    UPDATE patients SET status = 'admitted', discharge_date = NULL
    WHERE patient_id NOT LIKE 'PH%' AND id::text IN (
      SELECT payload->>'patientId' FROM flow_events WHERE event_type = 'DISCHARGE_SIGNED' AND processed = TRUE
    )`);

  // 2. Clear every bed
  await client.query(`UPDATE beds SET status = 'available', patient_id = NULL, expected_release_time = NULL, release_confidence = NULL`);
  await client.query(`UPDATE patients SET bed_id = NULL WHERE status <> 'discharged'`);

  // 3. Occupant pool: existing in-care patients (not in surgery / waiting) + flow cohort
  const core = await client.query(`
    SELECT id, patient_id, acuity, assigned_doctor_id FROM patients
    WHERE status IN ('admitted', 'critical', 'in_recovery', 'in_consultation')
      AND patient_id NOT LIKE 'PH%' AND patient_id NOT LIKE 'PF%'
      AND id NOT IN (SELECT patient_id FROM ot_cases WHERE status = 'in_progress')
    ORDER BY acuity ASC NULLS LAST, patient_id`);
  const slots =
    ZONE_LAYOUT.ICU.occupied.length + ZONE_LAYOUT.HDU.occupied.length + ZONE_LAYOUT.Ward.occupied.length +
    ZONE_LAYOUT.ED.occupied.length + ZONE_LAYOUT.Radiology.occupied.length;
  const cohortNeeded = Math.max(0, slots - core.rows.length);

  await client.query(`UPDATE patients SET status = 'discharged', bed_id = NULL WHERE patient_id LIKE 'PF%' AND patient_id NOT LIKE 'PFW%'`);
  const cohort = [];
  for (let i = 1; i <= cohortNeeded; i++) {
    const alias = `PF${String(i).padStart(3, '0')}`;
    const res = await client.query(
      `INSERT INTO patients (patient_id, full_name, date_of_birth, status, acuity, diagnosis)
       VALUES ($1, $2, DATE '1955-01-01' + $3::int, 'admitted', 3, 'Flow cohort')
       ON CONFLICT (patient_id) DO UPDATE SET status = 'admitted', discharge_date = NULL
       RETURNING id, patient_id, acuity, assigned_doctor_id`,
      [alias, `Cohort Patient ${i}`, Math.floor(rand() * 20000)]
    );
    cohort.push(res.rows[0]);
  }

  // Order: most acute first → ICU, HDU, then Ward, ED, Radiology
  const pool = [...core.rows, ...cohort];
  const assignment = [];
  const take = (beds, zone, acuityFn) => {
    for (const bedId of beds) {
      const p = pool.shift();
      if (!p) return;
      assignment.push({ p, bedId, zone, acuity: acuityFn(p) });
    }
  };
  take(ZONE_LAYOUT.ICU.occupied, 'ICU', () => (rand() < 0.5 ? 1 : 2));
  take(ZONE_LAYOUT.HDU.occupied, 'HDU', () => (rand() < 0.6 ? 2 : 3));
  take(ZONE_LAYOUT.Ward.occupied, 'Ward', (p) => (p.acuity && p.acuity >= 2 ? Math.min(p.acuity, 4) : 3));
  take(ZONE_LAYOUT.ED.occupied, 'ED', () => (rand() < 0.5 ? 3 : 4));
  take(ZONE_LAYOUT.Radiology.occupied, 'Radiology', () => 3);

  const bedDept = await client.query(`SELECT id, department_id FROM beds`);
  const bedDeptMap = Object.fromEntries(bedDept.rows.map((r) => [r.id, r.department_id]));
  const deptName = Object.fromEntries(Object.entries(depts).map(([k, v]) => [v, k]));

  for (const a of assignment) {
    const trio = READY_TRIO.find((t) => t.bed === a.bedId);
    const deptId = bedDeptMap[a.bedId];
    const dName = deptName[deptId];
    const doctors = docs.byDept[dName] || docs.all;
    let doctorId = a.p.assigned_doctor_id || doctors[Math.floor(rand() * doctors.length)];
    let acuity = a.acuity;
    let requiresImaging = false;
    let pending = [];
    let expectedHours;
    let dischargeDate = null;
    let releaseConf = 0.6 + rand() * 0.3;
    const admittedHoursAgo = a.zone === 'ED' ? 1 + rand() * 6 : a.zone === 'Radiology' ? 0.5 + rand() : 12 + rand() * 96;

    if (trio) {
      acuity = trio.acuity;
      doctorId = docs.demoDoctorId || doctorId;
      pending = [trio.task];
      expectedHours = trio.hours;
      dischargeDate = trio.hours + 0.5;
      releaseConf = 0.85;
    } else if (a.zone === 'Radiology') {
      requiresImaging = true;
      expectedHours = 0.5 + rand() * 0.4;
      releaseConf = 0.9;
    } else if (a.zone === 'ED') {
      requiresImaging = acuity >= 4 || rand() < 0.3;
      expectedHours = 3 + rand() * 7;
    } else {
      // Anyone stable enough to score ≥ 60 without being in the trio waits on imaging
      if (acuity >= 4) requiresImaging = true;
      else requiresImaging = rand() < 0.2;
      expectedHours = { 1: 60, 2: 36, 3: 20, 4: 10, 5: 6 }[acuity] * (0.5 + rand());
      if (a.zone === 'ICU' && a.bedId === 'ICU-02') expectedHours = 0.4; // releasing soon (ambulance fallback)
      if (a.zone === 'Ward' && a.bedId.startsWith('PO-')) doctorId = (docs.byDept.OT || docs.all)[0];
    }
    if (doctorId === docs.demoDoctorId && !trio && a.zone === 'Ward' && a.bedId > 'GW-15') {
      doctorId = doctors.find((d) => d !== docs.demoDoctorId) || doctorId;
    }

    await client.query(
      `UPDATE patients SET
         status = CASE WHEN $2 <= 2 AND status <> 'in_recovery' THEN 'critical'::patient_status
                       WHEN status IN ('critical') AND $2 > 2 THEN 'admitted'::patient_status
                       ELSE status END,
         acuity = $2, bed_id = $3, department_id = $4, assigned_doctor_id = $5,
         admission_date = NOW() - ($6 || ' hours')::interval,
         expected_discharge = NOW() + ($7 || ' hours')::interval,
         discharge_date = CASE WHEN $8::float IS NULL THEN NULL ELSE NOW() + make_interval(secs => $8::float * 3600) END,
         requires_imaging = $9, pending_tasks = $10, requires_icu = ($2 = 1), waiting_since = NULL
       WHERE id = $1`,
      [a.p.id, acuity, a.bedId, deptId, doctorId, admittedHoursAgo.toFixed(2), expectedHours.toFixed(2), dischargeDate, requiresImaging, pending]
    );
    await client.query(
      `UPDATE beds SET status = 'occupied', patient_id = $1,
         expected_release_time = NOW() + ($2 || ' hours')::interval, release_confidence = $3
       WHERE id = $4`,
      [a.p.id, expectedHours.toFixed(2), releaseConf.toFixed(2), a.bedId]
    );
  }

  // Patients that did not get a bed (pool overflow) wait in ED
  for (const p of pool) {
    await client.query(`UPDATE patients SET status = 'waiting', department_id = $2, waiting_since = NOW() - INTERVAL '20 minutes' WHERE id = $1`, [p.id, depts.Emergency]);
  }

  // 4. Dirty beds
  const dirty = [...ZONE_LAYOUT.ED.cleaning, ...ZONE_LAYOUT.Ward.cleaning];
  await client.query(`UPDATE beds SET status = 'cleaning', updated_at = NOW() - INTERVAL '35 minutes' WHERE id = ANY($1)`, [dirty]);

  // 5. Waiting room: exactly three waiting patients in ED (flow waiting cohort PFW1-3)
  const waiting = [
    { alias: 'PFW1', acuity: 2, mins: 25 },
    { alias: 'PFW2', acuity: 3, mins: 40 },
    { alias: 'PFW3', acuity: 3, mins: 70 },
  ];
  for (const w of waiting) {
    await client.query(
      `INSERT INTO patients (patient_id, full_name, date_of_birth, status, acuity, department_id, waiting_since, diagnosis)
       VALUES ($1, $2, DATE '1980-05-05', 'waiting', $3, $4, NOW() - ($5 || ' minutes')::interval, 'Awaiting bed')
       ON CONFLICT (patient_id) DO UPDATE SET status = 'waiting', acuity = EXCLUDED.acuity, bed_id = NULL,
         department_id = EXCLUDED.department_id, waiting_since = EXCLUDED.waiting_since, discharge_date = NULL, requires_icu = FALSE`,
      [w.alias, `Waiting Patient ${w.alias}`, w.acuity, depts.Emergency, String(w.mins)]
    );
  }
  await client.query(`UPDATE patients SET department_id = $1 WHERE status = 'waiting'`, [depts.Emergency]);

  // 6. OT: re-time schedule around now. In-progress cases end in 30-90 min; upcoming every ~50 min.
  await client.query(`UPDATE ot_rooms SET status = 'in_surgery' WHERE name IN ('OT-1', 'OT-2')`);
  await client.query(`UPDATE ot_rooms SET status = 'cleaning', next_available = NOW() + INTERVAL '25 minutes' WHERE name = 'OT-3'`);
  await client.query(`UPDATE ot_rooms SET status = 'reserved' WHERE name = 'OT-4'`);
  const inProg = await client.query(`SELECT id, ot_room_id, primary_surgeon_id, anesthetist_id, patient_id FROM ot_cases WHERE status = 'in_progress' ORDER BY case_number`);
  let k = 0;
  for (const c of inProg.rows) {
    await client.query(
      `UPDATE ot_cases SET scheduled_start = NOW() - INTERVAL '70 minutes', actual_start = NOW() - INTERVAL '65 minutes',
         scheduled_end = NOW() + ($2 || ' minutes')::interval, post_op_bed_id = NULL, post_op_bed_required = TRUE,
         post_op_ward = CASE WHEN $3 = 0 THEN 'ICU' ELSE 'Post-Operative Recovery Ward' END
       WHERE id = $1`,
      [c.id, String(30 + k * 40), k]
    );
    await client.query(`UPDATE ot_rooms SET current_case_id = $1 WHERE id = $2`, [c.id, c.ot_room_id]);
    await client.query(`UPDATE doctors SET status = 'in_surgery', current_location = 'OT' WHERE id = ANY($1::uuid[])`, [[c.primary_surgeon_id, c.anesthetist_id].filter(Boolean)]);
    await client.query(`UPDATE patients SET status = 'in_surgery', bed_id = NULL WHERE id = $1`, [c.patient_id]);
    k++;
  }
  const upcoming = await client.query(`SELECT id FROM ot_cases WHERE status IN ('scheduled', 'delayed') ORDER BY case_number`);
  let j = 0;
  for (const c of upcoming.rows) {
    const start = 40 + j * 50;
    await client.query(
      `UPDATE ot_cases SET scheduled_start = NOW() + ($2 || ' minutes')::interval,
         scheduled_end = NOW() + ($3 || ' minutes')::interval, post_op_bed_id = NULL,
         post_op_ward = CASE WHEN $4 < 2 THEN 'ICU' ELSE COALESCE(post_op_ward, 'Post-Operative Recovery Ward') END
       WHERE id = $1`,
      [c.id, String(start), String(start + 90), j]
    );
    j++;
  }

  // 7. Fresh flow artefacts (audit history in flow_events is kept)
  await client.query(`DELETE FROM flow_recommendations`);
  await client.query(`DELETE FROM alerts WHERE dedupe_key LIKE 'flow-%' OR dedupe_key LIKE 'ambulance-%' OR dedupe_key LIKE 'deteriorated-%' OR dedupe_key LIKE 'no-postop-%'`);

  logger.info({ occupied: assignment.length, cohort: cohort.length, waiting: waiting.length }, 'Flow demo state applied');
  return { occupied: assignment.length, cohortCreated: cohort.length };
}

async function seedFlow() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', '001_flow_intelligence.sql'), 'utf8');
  await db.query(sql);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const depts = await deptMap(client);
    const docs = await doctorMap(client);
    logger.info('Seeding radiology bays, roster, arrivals history, KPI history, discharged history...');
    await seedRadiologyBays(client, depts);
    await seedStaff(client, depts);
    await seedArrivalsHistory(client, depts);
    await seedKpiHistory(client);
    await seedDischargedHistory(client, depts, docs);
    const state = await applyDemoState(client);
    await client.query('COMMIT');
    const counts = await db.query(`
      SELECT (SELECT COUNT(*) FROM beds)::int AS beds,
             (SELECT COUNT(*) FROM beds WHERE status = 'occupied')::int AS occupied,
             (SELECT COUNT(*) FROM patients WHERE status <> 'discharged')::int AS active_patients,
             (SELECT COUNT(*) FROM arrivals_history)::int AS arrivals_rows,
             (SELECT COUNT(*) FROM flow_staff)::int AS staff`);
    logger.info({ ...counts.rows[0], ...state }, '✅ Flow seed complete');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err: err.message }, '❌ Flow seed failed');
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedFlow()
    .then(() => db.pool.end())
    .catch(async () => {
      await db.pool.end();
      process.exit(1);
    });
}

module.exports = { seedFlow, applyDemoState };
