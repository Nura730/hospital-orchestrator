/**
 * Flow workflow actions: close the loop from prediction to action.
 * Batch recommendations, discharge nudges, mark-ready, pre-assignment, simulator plan apply, demo controls.
 */
const db = require('../config/db');
const flowRepo = require('../repositories/flow.repo');
const emitter = require('../sockets/emitter');
const AppError = require('../utils/AppError');
const prediction = require('./predictionEngine.service');
const bottleneck = require('./bottleneckEngine.service');
const stateEngine = require('./stateEngine.service');
const simulator = require('./whatIfSimulator.service');

function emitNotifications(rows) {
  for (const n of rows || []) emitter.emitNotification(n.userId, n);
}

/* ───────────────────────── discharge ───────────────────────── */

/**
 * Notify the assigned doctor of each discharge-ready patient.
 * @param {{ patientIds?: string[], departmentId?: number, readyOnly?: boolean }} filter
 */
async function sendDischargeNudges(filter = {}, user) {
  const { candidates } = await prediction.getDischargeCandidates();
  let targets = candidates;
  if (filter.patientIds && filter.patientIds.length) {
    const set = new Set(filter.patientIds);
    targets = targets.filter((c) => set.has(c.patientId));
  } else {
    targets = targets.filter((c) => c.ready);
  }
  if (filter.departmentId) targets = targets.filter((c) => c.departmentId === Number(filter.departmentId));

  let notifications = [];
  for (const c of targets) {
    if (!c.doctorId) continue;
    const rows = await flowRepo.notifyUsers([c.doctorId], {
      type: 'general',
      title: `Discharge nudge: ${c.alias} (${c.bedId})`,
      message: `Readiness ${c.score}/100. ${c.blockingFactors.length ? `Blocking: ${c.blockingFactors.join('; ')}.` : 'No blockers.'} Signing frees ${c.bedId}.`,
      relatedId: c.patientId,
    });
    notifications = notifications.concat(rows);
  }
  emitNotifications(notifications);
  for (const c of targets) {
    emitter.emitFlowDischargeNudge({ patientId: c.patientId, alias: c.alias, doctorId: c.doctorId, probability: c.probability, bedId: c.bedId, score: c.score });
  }
  await stateEngine.logEvent('DISCHARGE_NUDGE_SENT', { patientIds: targets.map((t) => t.patientId) }, user, { notified: notifications.length });
  return { nudged: targets.length, notificationsSent: notifications.length, patients: targets.map((t) => t.alias) };
}

async function markDischargeReady(patientId, user) {
  const res = await db.query(
    `UPDATE patients SET
       pending_tasks = '{}',
       discharge_date = COALESCE(discharge_date, NOW() + INTERVAL '1 hour'),
       expected_discharge = LEAST(COALESCE(expected_discharge, NOW() + INTERVAL '1 hour'), NOW() + INTERVAL '1 hour')
     WHERE id = $1 AND status <> 'discharged'
     RETURNING id, patient_id, bed_id`,
    [patientId]
  );
  if (!res.rows[0]) throw new AppError('Active patient not found', 404, 'NOT_FOUND');
  if (res.rows[0].bed_id) {
    await db.query(
      `UPDATE beds SET expected_release_time = NOW() + INTERVAL '1 hour', release_confidence = GREATEST(COALESCE(release_confidence, 0), 0.85) WHERE id = $1`,
      [res.rows[0].bed_id]
    );
  }
  bottleneck.invalidateCache();
  const readiness = await prediction.dischargeReadinessForPatient(patientId);
  await stateEngine.logEvent('DISCHARGE_MARKED_READY', { patientId }, user, readiness);
  emitter.emitPatientUpdated({ patientId, alias: res.rows[0].patient_id, dischargeReady: true });
  return { patientId, alias: res.rows[0].patient_id, ...readiness };
}

/* ───────────────────────── recommendations ───────────────────────── */

async function executeActionEffects(action, user) {
  const deptName = action.department || null;
  const dept = deptName ? await flowRepo.getDepartmentByName(deptName) : null;
  const out = { notifications: 0, nudges: 0 };
  switch (action.type) {
    case 'cleaning': {
      const beds = await db.query(
        `SELECT id FROM beds WHERE status = 'cleaning' ${dept ? 'AND department_id = $1' : ''} ORDER BY updated_at`,
        dept ? [dept.id] : []
      );
      const rows = await flowRepo.notifyRole('admin', {
        type: 'general',
        title: `Housekeeping priority${deptName ? `: ${deptName}` : ''}`,
        message: `Clean first: ${beds.rows.map((b) => b.id).join(', ') || 'no dirty beds'}.`,
      });
      emitNotifications(rows);
      out.notifications += rows.length;
      break;
    }
    case 'discharge': {
      const r = await sendDischargeNudges({ departmentId: dept ? dept.id : undefined }, user);
      out.notifications += r.notificationsSent;
      out.nudges += r.nudged;
      break;
    }
    case 'defer_ot': {
      const rows = await flowRepo.notifyRole('ot_manager', {
        type: 'ot_changed',
        title: 'Defer elective cases',
        message: action.text,
      });
      emitNotifications(rows);
      out.notifications += rows.length;
      break;
    }
    default: {
      const rows = await flowRepo.notifyRole('admin', {
        type: 'general',
        title: `Flow action: ${action.type}`,
        message: action.text,
      });
      emitNotifications(rows);
      out.notifications += rows.length;
    }
  }
  return out;
}

/**
 * Store a batch of actions as recommendations; optionally approve + execute them immediately.
 * @param {{ actions: object[], source?: string, autoApprove?: boolean }} body
 */
async function createRecommendationBatch({ actions = [], source = 'bottleneck', autoApprove = false }, user) {
  if (!Array.isArray(actions) || actions.length === 0) throw new AppError('actions[] required', 400, 'VALIDATION_ERROR');
  const created = [];
  let notificationsSent = 0;
  let nudges = 0;
  for (const a of actions.slice(0, 25)) {
    const dept = a.department ? await flowRepo.getDepartmentByName(a.department) : null;
    const rec = await flowRepo.insertRecommendation({
      type: a.type || 'manual',
      title: a.text || a.title || 'Flow action',
      detail: a.detail || null,
      expectedImpact: a.impact || null,
      risk: a.risk || 'medium',
      status: autoApprove ? 'approved' : 'pending',
      source,
      departmentId: dept ? dept.id : null,
      relatedType: a.relatedType || null,
      relatedId: a.relatedId || null,
      payload: a,
      createdBy: user && user.id,
    });
    created.push(rec);
    emitter.emitRecommendationCreated(rec);
    if (autoApprove) {
      const fx = await executeActionEffects(a, user);
      notificationsSent += fx.notifications;
      nudges += fx.nudges;
    }
  }
  await stateEngine.logEvent('RECOMMENDATIONS_BATCH', { source, count: created.length, autoApprove }, user, { notificationsSent, nudges });
  return { created: created.length, recommendations: created, notificationsSent, nudges, status: autoApprove ? 'approved' : 'pending' };
}

async function decideRecommendation(id, decision, user) {
  if (!['approved', 'rejected', 'applied'].includes(decision)) {
    throw new AppError('status must be approved, rejected or applied', 400, 'VALIDATION_ERROR');
  }
  const rec = await flowRepo.updateRecommendationStatus(id, decision, user && user.id);
  if (!rec) throw new AppError('Recommendation not found', 404, 'NOT_FOUND');
  let effects = null;
  if (decision === 'approved' && rec.payload && rec.payload.type) effects = await executeActionEffects(rec.payload, user);
  await stateEngine.logEvent('RECOMMENDATION_DECIDED', { id, decision }, user, effects);
  return { ...rec, effects };
}

/** Apply the recommended (C) plan of a simulation run: create recommendations + notify staff. */
async function applySimulationPlan(simulationId, user) {
  const run = await simulator.getRun(simulationId);
  if (!run) throw new AppError('Simulation not found', 404, 'NOT_FOUND');
  const actions = (run.result.actions || []).map((a) => ({ ...a, risk: 'medium' }));
  const batch = await createRecommendationBatch({ actions, source: 'simulator', autoApprove: false }, user);

  // Staff are notified immediately (plan awaits approval, but people get the heads-up)
  let notificationsSent = 0;
  let nudges = 0;
  for (const a of actions) {
    if (a.type === 'cleaning' || a.type === 'discharge' || a.type === 'defer_ot') {
      const fx = await executeActionEffects(a, user);
      notificationsSent += fx.notifications;
      nudges += fx.nudges;
    }
  }
  const adminRows = await flowRepo.notifyRole('admin', {
    type: 'general',
    title: 'Surge plan submitted for approval',
    message: `Scenario C: ${run.result.expectedWaitReduction} (${run.result.waitReductionPct}% less wait). ${actions.length} actions pending.`,
    relatedId: simulationId,
  });
  emitNotifications(adminRows);
  notificationsSent += adminRows.length;
  await db.query('UPDATE simulation_runs SET applied = TRUE WHERE id = $1', [simulationId]);
  await stateEngine.logEvent('SIMULATION_PLAN_APPLIED', { simulationId }, user, { recommendations: batch.created, notificationsSent, nudges });
  return { simulationId, recommendationsCreated: batch.created, notificationsSent, nudges, status: 'pending_approval' };
}

async function preAssignBed(bedId, patientId, user) {
  const bed = await db.query('SELECT id, ward, department_id, expected_release_time FROM beds WHERE id = $1', [bedId]);
  if (!bed.rows[0]) throw new AppError('Bed not found', 404, 'NOT_FOUND');
  const patient = await flowRepo.getPatientById(patientId);
  if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');
  const rec = await flowRepo.insertRecommendation({
    type: 'pre_assignment',
    title: `Pre-assign ${patient.patient_id} to ${bedId}`,
    detail: `Bed ${bedId} (${bed.rows[0].ward}) expected free ${bed.rows[0].expected_release_time ? new Date(bed.rows[0].expected_release_time).toISOString() : 'soon'}.`,
    expectedImpact: 'Zero idle time between occupants',
    risk: 'low',
    status: 'approved',
    source: 'discharge_planner',
    departmentId: bed.rows[0].department_id,
    relatedType: 'patient',
    relatedId: patient.id,
    payload: { bedId, patientId: patient.id, alias: patient.patient_id },
    createdBy: user && user.id,
  });
  emitter.emitRecommendationCreated(rec);
  await stateEngine.logEvent('BED_PRE_ASSIGNED', { bedId, patientId }, user, { recommendationId: rec.id });
  return rec;
}

/* ───────────────────────── demo controls ───────────────────────── */

async function demoReset(user) {
  const { applyDemoState } = require('../../db/flowSeed');
  await db.withTransaction((client) => applyDemoState(client));
  bottleneck.invalidateCache();
  await stateEngine.logEvent('DEMO_RESET', {}, user, { ok: true });
  return { reset: true };
}

async function demoAmbulance(body, user) {
  return stateEngine.processEvent(
    'AMBULANCE_INCOMING',
    {
      eta: body.eta || 8,
      acuity: body.acuity || 1,
      injuryType: body.injuryType || 'Road traffic collision, chest trauma',
      vitals: body.vitals || { HR: 128, BP: '88/54', SpO2: '89%', GCS: 12 },
      requiresIcu: body.requiresIcu !== undefined ? body.requiresIcu : true,
    },
    user
  );
}

/** Inject a surge: fill free ED beds and add waiting high-acuity patients. */
async function demoSurge(user) {
  const created = await db.withTransaction(async (client) => {
    const ed = await flowRepo.getDepartmentByName('Emergency', client);
    const free = await client.query(`SELECT id FROM beds WHERE type = 'ed' AND status = 'available' ORDER BY id LIMIT 4`);
    const doc = await client.query(
      `SELECT d.id FROM doctors d JOIN departments dep ON dep.id = d.department_id WHERE dep.name = 'Emergency' LIMIT 1`
    );
    const doctorId = doc.rows[0] ? doc.rows[0].id : null;
    const stamp = Date.now().toString().slice(-6);
    const out = [];
    for (let i = 0; i < free.rows.length + 3; i++) {
      const bedId = free.rows[i] ? free.rows[i].id : null;
      const alias = `PS${stamp}${i}`;
      const acuity = [1, 2, 2, 3, 3, 2, 3][i % 7];
      const res = await client.query(
        `INSERT INTO patients (patient_id, full_name, date_of_birth, status, acuity, department_id, assigned_doctor_id, bed_id,
                               admission_date, waiting_since, requires_icu, diagnosis)
         VALUES ($1, $2, DATE '1970-01-01' + (random() * 15000)::int, $3, $4, $5, $6, $7, $8, NOW(), $9, 'Surge arrival')
         RETURNING id`,
        [alias, `Surge Patient ${alias}`, bedId ? 'admitted' : 'waiting', acuity, ed ? ed.id : null, doctorId, bedId, bedId ? new Date() : null, acuity === 1]
      );
      if (bedId) {
        await client.query(
          `UPDATE beds SET status = 'occupied', patient_id = $1, expected_release_time = NOW() + INTERVAL '8 hours', release_confidence = 0.6 WHERE id = $2`,
          [res.rows[0].id, bedId]
        );
      }
      out.push({ alias, bedId, acuity });
    }
    // Bump next hours of ED arrival history (+60%) so forecasts react
    if (ed) {
      await client.query(
        `UPDATE arrivals_history SET arrivals = ROUND(arrivals * 1.6)
         WHERE department_id = $1 AND hour_start >= NOW() - INTERVAL '7 days' AND hour_start < NOW() - INTERVAL '6 days' + INTERVAL '6 hours'`,
        [ed.id]
      );
    }
    return out;
  });
  bottleneck.invalidateCache();
  for (const p of created) if (p.bedId) emitter.emitBedUpdated({ bedId: p.bedId, status: 'occupied' });
  await stateEngine.logEvent('DEMO_SURGE', { patients: created.length }, user, { created });
  // Run an analysis cycle right away so every dashboard repaints
  const { runFlowAnalysis } = require('../jobs/flowAnalysis.job');
  await runFlowAnalysis();
  return { injected: created.length, patients: created };
}

module.exports = {
  sendDischargeNudges,
  markDischargeReady,
  createRecommendationBatch,
  decideRecommendation,
  applySimulationPlan,
  preAssignBed,
  demoReset,
  demoAmbulance,
  demoSurge,
};
