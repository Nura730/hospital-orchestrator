/**
 * State engine: every action is an event, events drive state, state drives the UI.
 *
 * processEvent(eventType, payload, user)
 *   - logs the event to flow_events
 *   - applies ALL database changes in ONE transaction
 *   - emits socket events only after the transaction commits
 */
const db = require('../config/db');
const flowRepo = require('../repositories/flow.repo');
const flowConfig = require('../config/flowConfig');
const emitter = require('../sockets/emitter');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const prediction = require('./predictionEngine.service');
const bottleneck = require('./bottleneckEngine.service');
const { FLOW_EVENT_TYPES, FLOW_SEVERITY } = require('../config/constants');

/* ───────────────────────── helpers ───────────────────────── */

function emitNotifications(rows) {
  for (const n of rows || []) emitter.emitNotification(n.userId, n);
}

function alertPayload(alert, extra = {}) {
  if (!alert) return null;
  return {
    alertId: alert.id,
    id: alert.id,
    severity: alert.severity,
    title: alert.title,
    description: alert.message,
    department: alert.department_name,
    createdAt: alert.created_at,
    ...extra,
  };
}

async function freeBedForCleaning(client, bedId, effects) {
  if (!bedId) return null;
  const res = await client.query(
    `UPDATE beds SET status = 'cleaning', patient_id = NULL, expected_release_time = NULL, release_confidence = NULL
     WHERE id = $1 RETURNING id, ward, department_id, type`,
    [bedId]
  );
  const bed = res.rows[0];
  if (bed) {
    effects.push(() => emitter.emitBedUpdated({ bedId: bed.id, status: 'cleaning', patientId: null, ward: bed.ward, departmentId: bed.department_id }));
  }
  return bed || null;
}

/* ───────────────────────── handlers ───────────────────────── */

async function handleDischargeSigned(client, payload, user, effects) {
  if (!payload.patientId) throw new AppError('patientId is required', 400, 'VALIDATION_ERROR');
  const patient = await flowRepo.getPatientById(payload.patientId, client, { forUpdate: true });
  if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');
  if (patient.status === 'discharged') throw new AppError('Patient already discharged', 409, 'CONFLICT');

  const bedId = patient.bed_id;
  await client.query(
    `UPDATE patients SET status = 'discharged', discharge_date = NOW(), bed_id = NULL, pending_tasks = '{}' WHERE id = $1`,
    [patient.id]
  );
  const bed = await freeBedForCleaning(client, bedId, effects);
  await flowRepo.insertTimeline(patient.id, 'discharged', payload.note || 'Discharge signed', user && user.id, client);

  let notifications = [];
  if (bed) {
    notifications = await flowRepo.notifyRole(
      'admin',
      {
        type: 'general',
        title: `Housekeeping: clean ${bed.id}`,
        message: `Bed ${bed.id} (${bed.ward}) released after discharge of ${patient.patient_id}. Clean and mark ready.`,
        relatedId: bed.id,
      },
      client
    );
  }

  effects.push(() => {
    emitter.emitPatientUpdated({ patientId: patient.id, alias: patient.patient_id, status: 'discharged', acuity: patient.acuity });
    emitNotifications(notifications);
  });

  return { patientId: patient.id, alias: patient.patient_id, bedId, bedStatus: bed ? 'cleaning' : null, housekeepingNotified: notifications.length };
}

async function handleCleaningDone(client, payload, user, effects) {
  if (!payload.bedId) throw new AppError('bedId is required', 400, 'VALIDATION_ERROR');
  const bedRes = await client.query('SELECT * FROM beds WHERE id = $1 FOR UPDATE', [payload.bedId]);
  const bed = bedRes.rows[0];
  if (!bed) throw new AppError('Bed not found', 404, 'NOT_FOUND');
  if (bed.status === 'occupied') throw new AppError('Bed is occupied; cannot mark cleaning done', 409, 'CONFLICT');

  await client.query(
    `UPDATE beds SET status = 'available', last_cleaned_at = NOW(), patient_id = NULL, expected_release_time = NULL, release_confidence = NULL WHERE id = $1`,
    [bed.id]
  );

  // Allocator: best waiting patient whose needs match this bed
  let match = '';
  if (bed.type === 'icu') match = 'AND p.requires_icu = TRUE';
  else if (bed.type === 'isolation') match = 'AND p.requires_isolation = TRUE';
  else match = 'AND COALESCE(p.requires_icu, FALSE) = FALSE AND COALESCE(p.requires_isolation, FALSE) = FALSE';

  const waitRes = await client.query(
    `SELECT p.id, p.patient_id AS alias, p.acuity,
            ROUND(EXTRACT(EPOCH FROM (NOW() - p.waiting_since)) / 60)::int AS waiting_minutes
     FROM patients p
     WHERE p.status = 'waiting' ${match}
       AND NOT EXISTS (
         SELECT 1 FROM flow_recommendations r
         WHERE r.type = 'bed_assignment' AND r.status = 'pending' AND r.related_id = p.id::text
       )
     ORDER BY p.acuity ASC NULLS LAST, p.waiting_since ASC
     LIMIT 1`
  );
  const best = waitRes.rows[0];

  let recommendation = null;
  if (best) {
    recommendation = await flowRepo.insertRecommendation(
      {
        type: 'bed_assignment',
        title: `Assign ${best.alias} to ${bed.id}`,
        detail: `Acuity ${best.acuity}, waiting ${best.waiting_minutes} min. Bed ${bed.id} (${bed.ward}) has just been cleaned.`,
        expectedImpact: `Ends a ${best.waiting_minutes} min wait for ${best.alias}`,
        risk: 'low',
        source: 'state_engine',
        departmentId: bed.department_id,
        relatedType: 'patient',
        relatedId: best.id,
        payload: { bedId: bed.id, patientId: best.id, alias: best.alias },
        createdBy: user && user.id,
      },
      client
    );
  }

  effects.push(() => {
    emitter.emitBedUpdated({ bedId: bed.id, status: 'available', patientId: null, ward: bed.ward, departmentId: bed.department_id, lastCleanedAt: new Date().toISOString() });
    if (recommendation) emitter.emitRecommendationCreated(recommendation);
  });

  return { bedId: bed.id, bedStatus: 'available', recommendation };
}

async function handleOtComplete(client, payload, user, effects) {
  if (!payload.caseId) throw new AppError('caseId is required', 400, 'VALIDATION_ERROR');
  const caseRes = await client.query(
    `SELECT * FROM ot_cases WHERE id::text = $1 OR case_number = $1 FOR UPDATE`,
    [String(payload.caseId)]
  );
  const c = caseRes.rows[0];
  if (!c) throw new AppError('OT case not found', 404, 'NOT_FOUND');
  if (c.status === 'completed') throw new AppError('OT case already completed', 409, 'CONFLICT');

  const upd = await client.query(
    `UPDATE ot_cases SET status = 'completed', actual_end = NOW(),
       actual_duration_min = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(actual_start, scheduled_start))) / 60))::int
     WHERE id = $1 RETURNING actual_duration_min`,
    [c.id]
  );
  const duration = upd.rows[0].actual_duration_min;

  if (c.ot_room_id) {
    await client.query(
      `UPDATE ot_rooms SET status = 'cleaning', current_case_id = NULL, next_available = NOW() + INTERVAL '30 minutes' WHERE id = $1`,
      [c.ot_room_id]
    );
  }

  const doctorIds = [c.primary_surgeon_id, c.anesthetist_id].filter(Boolean);
  let doctors = [];
  if (doctorIds.length) {
    const dRes = await client.query(
      `UPDATE doctors d SET status = 'available', current_location = NULL
       FROM users u WHERE d.id = u.id AND d.id = ANY($1::uuid[])
       RETURNING d.id, u.full_name`,
      [doctorIds]
    );
    doctors = dRes.rows;
  }

  // Post-op bed
  let postOpBedId = null;
  let oldBedFreed = null;
  if (c.post_op_bed_required) {
    let bedId = c.post_op_bed_id;
    if (!bedId) {
      const free = await client.query(
        `SELECT id FROM beds WHERE type = 'post_op' AND status IN ('available', 'reserved')
         ORDER BY (status = 'reserved') DESC, id LIMIT 1 FOR UPDATE SKIP LOCKED`
      );
      bedId = free.rows[0] ? free.rows[0].id : null;
    }
    if (bedId) {
      const patient = await flowRepo.getPatientById(c.patient_id, client, { forUpdate: true });
      if (patient && patient.bed_id && patient.bed_id !== bedId) {
        oldBedFreed = await freeBedForCleaning(client, patient.bed_id, effects);
      }
      await client.query(
        `UPDATE beds SET status = 'occupied', patient_id = $1, expected_release_time = NOW() + INTERVAL '6 hours', release_confidence = 0.70 WHERE id = $2`,
        [c.patient_id, bedId]
      );
      await client.query('UPDATE ot_cases SET post_op_bed_id = $1 WHERE id = $2', [bedId, c.id]);
      postOpBedId = bedId;
    } else {
      const alert = await flowRepo.insertAlert(
        {
          severity: 'high',
          title: `No post-op bed for case ${c.case_number}`,
          message: `Case ${c.case_number} finished but no post-op/PACU bed is free.`,
          departmentName: 'OT',
          relatedType: 'ot_case',
          relatedId: c.id,
          dedupeKey: `no-postop-${c.id}`,
        },
        client
      );
      if (alert) effects.push(() => emitter.emitAlertCreated(alertPayload(alert)));
    }
  }

  await client.query(
    `UPDATE patients SET status = 'in_recovery', bed_id = COALESCE($2, bed_id) WHERE id = $1`,
    [c.patient_id, postOpBedId]
  );
  await flowRepo.insertTimeline(c.patient_id, 'in_recovery', `Surgery ${c.case_number} completed`, user && user.id, client);

  effects.push(() => {
    emitter.emitOtCaseCompleted({ caseId: c.id, caseNumber: c.case_number, roomId: c.ot_room_id, duration, nextStatus: 'cleaning', postOpBedId });
    for (const d of doctors) {
      emitter.emitDoctorStatusChanged({ doctorId: d.id, staffId: d.id, name: d.full_name, newStatus: 'available' });
    }
    if (postOpBedId) emitter.emitBedUpdated({ bedId: postOpBedId, status: 'occupied', patientId: c.patient_id });
    emitter.emitPatientUpdated({ patientId: c.patient_id, status: 'in_recovery' });
  });

  return {
    caseId: c.id,
    caseNumber: c.case_number,
    roomId: c.ot_room_id,
    roomStatus: 'cleaning',
    durationMin: duration,
    doctorsReleased: doctors.map((d) => d.id),
    postOpBedId,
    previousBedFreed: oldBedFreed ? oldBedFreed.id : null,
  };
}

async function findIcuBed(client) {
  const avail = await client.query(
    `SELECT id, status, expected_release_time FROM beds WHERE type = 'icu' AND status = 'available' ORDER BY id LIMIT 1`
  );
  if (avail.rows[0]) return { ...avail.rows[0], mode: 'available' };
  const soon = await client.query(
    `SELECT id, status, expected_release_time FROM beds
     WHERE type = 'icu' AND status = 'occupied' AND expected_release_time IS NOT NULL
     ORDER BY expected_release_time ASC LIMIT 1`
  );
  return soon.rows[0] ? { ...soon.rows[0], mode: 'releasing' } : null;
}

async function handlePatientDeteriorated(client, payload, user, effects) {
  if (!payload.patientId) throw new AppError('patientId is required', 400, 'VALIDATION_ERROR');
  const patient = await flowRepo.getPatientById(payload.patientId, client, { forUpdate: true });
  if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');

  const newAcuity = Math.max(1, Math.min(5, Number(payload.newAcuity) || Math.max(1, (patient.acuity || 3) - 1)));
  const requiresIcu = payload.requiresIcu !== undefined ? Boolean(payload.requiresIcu) : newAcuity === 1 || patient.requires_icu;
  const newStatus = newAcuity <= 2 ? 'critical' : patient.status;

  await client.query(`UPDATE patients SET acuity = $2, status = $3, requires_icu = $4 WHERE id = $1`, [
    patient.id,
    newAcuity,
    newStatus,
    requiresIcu,
  ]);
  await flowRepo.insertTimeline(
    patient.id,
    newStatus,
    payload.note || `Deteriorated: acuity ${patient.acuity} → ${newAcuity}`,
    user && user.id,
    client
  );

  const minuteKey = new Date().toISOString().slice(0, 16);
  const alert = await flowRepo.insertAlert(
    {
      severity: 'critical',
      title: `${patient.patient_id} deteriorated to acuity ${newAcuity}`,
      message: `Bed ${patient.bed_id || 'n/a'}. ${requiresIcu ? 'ICU care required.' : 'Review urgently.'}`,
      relatedType: 'patient',
      relatedId: patient.id,
      dedupeKey: `deteriorated-${patient.id}-${newAcuity}-${minuteKey}`,
    },
    client
  );

  let recommendation = null;
  let currentBedType = null;
  if (patient.bed_id) {
    const b = await client.query('SELECT type FROM beds WHERE id = $1', [patient.bed_id]);
    currentBedType = b.rows[0] ? b.rows[0].type : null;
  }
  if (requiresIcu && currentBedType !== 'icu') {
    const icu = await findIcuBed(client);
    const target = icu ? icu.id : 'next free ICU bed';
    recommendation = await flowRepo.insertRecommendation(
      {
        type: 'icu_transfer',
        title: `Transfer ${patient.patient_id} to ICU (${target})`,
        detail: icu && icu.mode === 'releasing'
          ? `${icu.id} expected free at ${new Date(icu.expected_release_time).toISOString()}. Prepare step-down for current occupant.`
          : `Patient acuity now ${newAcuity}.`,
        expectedImpact: 'Escalates care level within 30 min',
        risk: 'high',
        source: 'state_engine',
        relatedType: 'patient',
        relatedId: patient.id,
        payload: { patientId: patient.id, targetBedId: icu ? icu.id : null, mode: icu ? icu.mode : 'none' },
        createdBy: user && user.id,
      },
      client
    );
  }

  const notifications = patient.assigned_doctor_id
    ? await flowRepo.notifyUsers(
        [patient.assigned_doctor_id],
        {
          type: 'patient_critical',
          title: `${patient.patient_id} deteriorated`,
          message: `Acuity ${patient.acuity} → ${newAcuity}${requiresIcu ? ', ICU required' : ''}.`,
          relatedId: patient.id,
        },
        client
      )
    : [];

  effects.push(() => {
    emitter.emitPatientUpdated({ patientId: patient.id, alias: patient.patient_id, status: newStatus, acuity: newAcuity });
    if (alert) emitter.emitAlertCreated(alertPayload(alert, { severity: 'critical' }));
    if (recommendation) emitter.emitRecommendationCreated(recommendation);
    emitNotifications(notifications);
  });

  // Re-run bottleneck detection once the transaction has committed
  effects.push(async () => {
    bottleneck.invalidateCache();
    const analysis = await bottleneck.detectBottlenecks({ force: true });
    if (analysis.departments.some((d) => d.severity === FLOW_SEVERITY.HIGH)) {
      emitter.emitFlowBottleneckDetected({
        bottlenecks: bottleneck.toBottleneckList(analysis),
        rootCause: analysis.rootCause,
        cascade: analysis.cascade,
        detectedAt: analysis.analyzedAt,
        trigger: 'PATIENT_DETERIORATED',
      });
    }
  });

  return { patientId: patient.id, alias: patient.patient_id, acuity: newAcuity, status: newStatus, requiresIcu, recommendation };
}

async function handleAmbulanceIncoming(client, payload, user, effects, ctx) {
  const eta = Math.max(1, Number(payload.eta) || 10);
  const acuity = Math.max(1, Math.min(5, Number(payload.acuity) || 2));
  const requiresIcu = Boolean(payload.requiresIcu) || acuity === 1;
  const arrivalTime = new Date(Date.now() + eta * 60000);
  const { probability, factors } = prediction.estimateAdmissionProbability({ acuity, requires_icu: requiresIcu, arrivalTime });

  let bed = null;
  let bedMode = null;
  if (probability > 0.7) {
    const preferType = acuity <= 2 || requiresIcu ? 'icu' : 'ed';
    for (const type of [preferType, 'ed']) {
      const avail = await client.query(
        `SELECT id, ward, department_id FROM beds WHERE type = $1 AND status = 'available' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [type]
      );
      if (avail.rows[0]) {
        bed = avail.rows[0];
        bedMode = 'reserved';
        await client.query(`UPDATE beds SET status = 'reserved' WHERE id = $1`, [bed.id]);
        break;
      }
      const soon = await client.query(
        `SELECT id, ward, department_id, expected_release_time FROM beds
         WHERE type = $1 AND status = 'occupied'
           AND expected_release_time <= NOW() + ($2 || ' minutes')::interval
         ORDER BY expected_release_time ASC LIMIT 1`,
        [type, String(flowConfig.AMBULANCE_RESERVATION_HORIZON)]
      );
      if (soon.rows[0]) {
        bed = soon.rows[0];
        bedMode = 'releasing';
        break;
      }
    }
  }

  const injury = payload.injuryType || 'Unspecified injury';
  const vitals = payload.vitals || {};
  const vitalsText = Object.entries(vitals).map(([k, v]) => `${k} ${v}`).join(', ');

  const recommendation = await flowRepo.insertRecommendation(
    {
      type: 'trauma_team',
      title: `Prepare trauma team: ambulance ETA ${eta} min (acuity ${acuity})`,
      detail: `${injury}${vitalsText ? `. Vitals: ${vitalsText}` : ''}. ${bed ? `Bed ${bed.id} ${bedMode === 'reserved' ? 'reserved' : 'releasing soon'}.` : 'No bed reserved.'}`,
      expectedImpact: 'Door-to-treatment under 10 min',
      risk: probability > 0.7 ? 'high' : 'medium',
      source: 'state_engine',
      departmentId: ctx.edDeptId,
      relatedType: 'flow_event',
      relatedId: ctx.eventId,
      payload: { eta, acuity, injuryType: injury, vitals, bedId: bed ? bed.id : null, bedMode, probability },
      createdBy: user && user.id,
    },
    client
  );

  const alert = await flowRepo.insertAlert(
    {
      severity: probability > 0.7 ? 'critical' : 'medium',
      title: `Ambulance incoming: ETA ${eta} min | Acuity ${acuity}`,
      message: `${injury}. ${bed ? `Bed ${bed.id} ${bedMode === 'reserved' ? 'reserved' : 'releasing soon'}.` : 'Admission unlikely; no bed reserved.'}`,
      departmentId: ctx.edDeptId,
      departmentName: 'Emergency',
      relatedType: 'flow_event',
      relatedId: ctx.eventId,
      dedupeKey: `ambulance-${ctx.eventId}`,
    },
    client
  );

  const edDoctors = await client.query(
    `SELECT d.id FROM doctors d JOIN departments dep ON dep.id = d.department_id
     WHERE dep.name = 'Emergency' AND d.status <> 'off_duty'`
  );
  const notice = {
    type: 'alert',
    title: `Ambulance ETA ${eta} min: acuity ${acuity}`,
    message: `${injury}. ${bed ? `Bed ${bed.id} ${bedMode === 'reserved' ? 'reserved' : 'releasing soon'}.` : ''} Prepare trauma team.`,
    relatedId: ctx.eventId,
  };
  const notifications = [
    ...(await flowRepo.notifyRole('admin', notice, client)),
    ...(await flowRepo.notifyUsers(edDoctors.rows.map((r) => r.id), notice, client)),
  ];

  const banner = {
    eventId: ctx.eventId,
    eta,
    acuity,
    injuryType: injury,
    vitals,
    probability,
    factors,
    bedId: bed ? bed.id : null,
    bedMode,
    arrivesAt: arrivalTime.toISOString(),
    edProjection: ctx.edProjection,
    receivedAt: new Date().toISOString(),
  };

  effects.push(() => {
    emitter.emitFlowAmbulanceIncoming(banner);
    if (alert) emitter.emitAlertCreated(alertPayload(alert));
    if (bed && bedMode === 'reserved') emitter.emitBedUpdated({ bedId: bed.id, status: 'reserved', patientId: null, ward: bed.ward, departmentId: bed.department_id });
    emitter.emitRecommendationCreated(recommendation);
    emitNotifications(notifications);
  });

  return { ...banner, recommendation, teamNotified: notifications.length };
}

const HANDLERS = {
  [FLOW_EVENT_TYPES.DISCHARGE_SIGNED]: handleDischargeSigned,
  [FLOW_EVENT_TYPES.CLEANING_DONE]: handleCleaningDone,
  [FLOW_EVENT_TYPES.OT_COMPLETE]: handleOtComplete,
  [FLOW_EVENT_TYPES.PATIENT_DETERIORATED]: handlePatientDeteriorated,
  [FLOW_EVENT_TYPES.AMBULANCE_INCOMING]: handleAmbulanceIncoming,
};

/**
 * Process one flow event end-to-end.
 * @param {string} eventType one of FLOW_EVENT_TYPES
 * @param {object} payload
 * @param {{ id: string }} user
 */
async function processEvent(eventType, payload = {}, user = null) {
  const handler = HANDLERS[eventType];
  if (!handler) {
    throw new AppError(`Unknown event type '${eventType}'. Allowed: ${Object.keys(HANDLERS).join(', ')}`, 400, 'VALIDATION_ERROR');
  }
  const started = Date.now();

  // Read-only pre-computation outside the transaction
  const ctx = {};
  if (eventType === FLOW_EVENT_TYPES.AMBULANCE_INCOMING) {
    const ed = await flowRepo.getDepartmentByName('Emergency');
    ctx.edDeptId = ed ? ed.id : null;
    if (ed) {
      try {
        const p = await prediction.projectBedDemand(ed.id, 1);
        ctx.edProjection = { demand: p.demand, capacity: p.capacity, gap: p.gap, shortage: p.shortage };
      } catch {
        ctx.edProjection = null;
      }
    }
  }

  const effects = [];
  let eventRow;
  let result;
  try {
    ({ eventRow, result } = await db.withTransaction(async (client) => {
      const row = await flowRepo.insertFlowEvent({ eventType, payload, createdBy: user && user.id }, client);
      ctx.eventId = row.id;
      const r = await handler(client, payload, user, effects, ctx);
      await flowRepo.markFlowEventProcessed(row.id, r, client);
      return { eventRow: row, result: r };
    }));
  } catch (err) {
    // Keep an audit trail of failed events too (outside the rolled-back transaction)
    try {
      await flowRepo.insertFlowEvent({
        eventType,
        payload,
        processed: false,
        result: { error: err.message },
        createdBy: user && user.id,
      });
    } catch (logErr) {
      logger.error({ err: logErr.message }, 'Failed to log failed flow event');
    }
    throw err;
  }

  bottleneck.invalidateCache();
  for (const fx of effects) {
    try {
      await fx();
    } catch (err) {
      logger.error({ err: err.message, eventType }, 'Flow side-effect failed');
    }
  }

  const tookMs = Date.now() - started;
  logger.info({ eventType, eventId: eventRow.id, tookMs }, 'Flow event processed');
  return { eventId: eventRow.id, eventType, processedAt: new Date().toISOString(), tookMs, result };
}

/**
 * Log a non-state-changing workflow action (nudges, mark ready, plan applied) to flow_events.
 */
async function logEvent(eventType, payload, user, result = null) {
  return flowRepo.insertFlowEvent({ eventType, payload, processed: true, result, createdBy: user && user.id });
}

module.exports = {
  processEvent,
  logEvent,
  EVENT_TYPES: Object.keys(HANDLERS),
};
