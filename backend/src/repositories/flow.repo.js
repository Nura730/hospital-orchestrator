/**
 * Shared data access for the Predictive Flow Intelligence module.
 * Every function accepts an optional executor (pg client inside a transaction, or the pool).
 */
const db = require('../config/db');

const ACTIVE_PATIENT_STATUSES = ['admitted', 'in_consultation', 'in_surgery', 'in_recovery', 'critical'];

function ex(client) {
  return client || db;
}

/** Zone for a bed row, used by the schematic map. */
const ZONE_SQL = `
  CASE
    WHEN b.type = 'ed' THEN 'ED'
    WHEN b.type = 'icu' THEN 'ICU'
    WHEN b.type = 'hdu' THEN 'HDU'
    WHEN b.type = 'post_op' THEN 'PACU'
    WHEN d.name = 'Radiology' THEN 'Radiology'
    ELSE 'General Ward'
  END
`;

async function getDepartments(client) {
  const res = await ex(client).query('SELECT id, name, floor, capacity FROM departments ORDER BY id');
  return res.rows;
}

async function getDepartmentByName(name, client) {
  const res = await ex(client).query('SELECT id, name, floor FROM departments WHERE name = $1', [name]);
  return res.rows[0] || null;
}

/**
 * Bed counts per department. capacity excludes beds under maintenance.
 */
async function getDepartmentBedStats(client) {
  const res = await ex(client).query(`
    SELECT
      d.id, d.name, d.floor,
      COUNT(b.id)::int AS total,
      COUNT(b.id) FILTER (WHERE b.status <> 'maintenance')::int AS capacity,
      COUNT(b.id) FILTER (WHERE b.status = 'occupied')::int AS occupied,
      COUNT(b.id) FILTER (WHERE b.status = 'cleaning')::int AS cleaning,
      COUNT(b.id) FILTER (WHERE b.status = 'reserved')::int AS reserved,
      COUNT(b.id) FILTER (WHERE b.status = 'available')::int AS available,
      COUNT(b.id) FILTER (WHERE b.status = 'maintenance')::int AS maintenance
    FROM departments d
    LEFT JOIN beds b ON b.department_id = d.id
    GROUP BY d.id
    ORDER BY d.id
  `);
  return res.rows;
}

async function getOtRoomStats(client) {
  const res = await ex(client).query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status <> 'maintenance')::int AS capacity,
      COUNT(*) FILTER (WHERE status IN ('in_surgery', 'emergency'))::int AS in_surgery,
      COUNT(*) FILTER (WHERE status = 'cleaning')::int AS cleaning,
      COUNT(*) FILTER (WHERE status = 'reserved')::int AS reserved,
      COUNT(*) FILTER (WHERE status = 'available')::int AS available,
      COUNT(*) FILTER (WHERE status = 'maintenance')::int AS maintenance
    FROM ot_rooms
  `);
  return res.rows[0];
}

async function getHospitalBedTotals(client) {
  const res = await ex(client).query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status <> 'maintenance')::int AS capacity,
      COUNT(*) FILTER (WHERE status = 'occupied')::int AS occupied,
      COUNT(*) FILTER (WHERE status = 'cleaning')::int AS cleaning,
      COUNT(*) FILTER (WHERE status = 'reserved')::int AS reserved,
      COUNT(*) FILTER (WHERE status = 'available')::int AS available,
      COUNT(*) FILTER (WHERE status = 'maintenance')::int AS maintenance,
      COUNT(*) FILTER (WHERE type = 'icu')::int AS icu_total,
      COUNT(*) FILTER (WHERE type = 'icu' AND status = 'occupied')::int AS icu_occupied,
      COUNT(*) FILTER (WHERE type = 'icu' AND status = 'maintenance')::int AS icu_maintenance
    FROM beds
  `);
  return res.rows[0];
}

/**
 * Active (in-bed or in-care) patients with bed + doctor context. Names are never selected.
 * @param {{ doctorId?: string, departmentId?: number, patientId?: string }} filter
 */
async function getActivePatients(filter = {}, client) {
  const values = [ACTIVE_PATIENT_STATUSES];
  const where = ['p.status = ANY($1::patient_status[])'];
  if (filter.doctorId) {
    values.push(filter.doctorId);
    where.push(`p.assigned_doctor_id = $${values.length}`);
  }
  if (filter.departmentId) {
    values.push(filter.departmentId);
    where.push(`COALESCE(b.department_id, p.department_id) = $${values.length}`);
  }
  if (filter.patientId) {
    values.push(filter.patientId);
    where.push(`p.id = $${values.length}`);
  }
  const res = await ex(client).query(
    `
    SELECT
      p.id, p.patient_id AS alias, p.status, p.acuity,
      COALESCE(b.department_id, p.department_id) AS department_id,
      d.name AS department_name,
      p.assigned_doctor_id, u.full_name AS doctor_name,
      p.bed_id, b.ward, b.type AS bed_type,
      p.admission_date, p.expected_discharge, p.discharge_date,
      p.requires_icu, p.requires_isolation, p.requires_imaging, p.requires_ot,
      COALESCE(p.pending_tasks, '{}') AS pending_tasks,
      p.waiting_since, p.created_at,
      b.expected_release_time, b.release_confidence
    FROM patients p
    LEFT JOIN beds b ON b.id = p.bed_id
    LEFT JOIN departments d ON d.id = COALESCE(b.department_id, p.department_id)
    LEFT JOIN users u ON u.id = p.assigned_doctor_id
    WHERE ${where.join(' AND ')}
    ORDER BY p.acuity ASC NULLS LAST, p.admission_date ASC NULLS LAST
    `,
    values
  );
  return res.rows;
}

async function getPatientById(patientId, client, { forUpdate = false } = {}) {
  const res = await ex(client).query(
    `SELECT * FROM patients WHERE id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`,
    [patientId]
  );
  return res.rows[0] || null;
}

async function getWaitingPatients(client) {
  const res = await ex(client).query(`
    SELECT p.id, p.patient_id AS alias, p.acuity, p.requires_icu, p.requires_isolation,
           p.waiting_since, p.department_id, d.name AS department_name,
           ROUND(EXTRACT(EPOCH FROM (NOW() - p.waiting_since)) / 60)::int AS waiting_minutes
    FROM patients p
    LEFT JOIN departments d ON d.id = p.department_id
    WHERE p.status = 'waiting'
    ORDER BY p.acuity ASC NULLS LAST, p.waiting_since ASC
  `);
  return res.rows;
}

/** Nurses and floats on shift per department. */
async function getNurseStaffing(client) {
  const res = await ex(client).query(`
    SELECT
      d.id AS department_id, d.name AS department_name,
      COUNT(s.id) FILTER (WHERE s.role = 'nurse' AND s.on_shift)::int AS nurses_on_shift,
      COUNT(s.id) FILTER (WHERE s.role = 'nurse')::int AS nurses_total,
      COUNT(s.id) FILTER (WHERE s.role = 'float_nurse' AND s.on_shift)::int AS float_on_shift,
      COUNT(s.id) FILTER (WHERE s.role = 'housekeeping' AND s.on_shift)::int AS housekeeping_on_shift
    FROM departments d
    LEFT JOIN flow_staff s ON s.department_id = d.id
    GROUP BY d.id
    ORDER BY d.id
  `);
  return res.rows;
}

async function getFloatPool(client) {
  const res = await ex(client).query(`
    SELECT s.id, s.full_name, s.department_id, d.name AS department_name, s.on_shift
    FROM flow_staff s LEFT JOIN departments d ON d.id = s.department_id
    WHERE s.role = 'float_nurse'
    ORDER BY s.id
  `);
  return res.rows;
}

async function insertFlowEvent({ eventType, payload, processed = false, result = null, createdBy = null }, client) {
  const res = await ex(client).query(
    `INSERT INTO flow_events (event_type, payload, processed, result, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, event_type, created_at`,
    [eventType, JSON.stringify(payload || {}), processed, result ? JSON.stringify(result) : null, createdBy]
  );
  return res.rows[0];
}

async function markFlowEventProcessed(id, result, client) {
  await ex(client).query('UPDATE flow_events SET processed = TRUE, result = $2 WHERE id = $1', [
    id,
    JSON.stringify(result || {}),
  ]);
}

function mapRecommendation(r) {
  if (!r) return null;
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    detail: r.detail,
    expectedImpact: r.expected_impact,
    risk: r.risk,
    status: r.status,
    source: r.source,
    departmentId: r.department_id,
    relatedType: r.related_type,
    relatedId: r.related_id,
    payload: r.payload,
    createdAt: r.created_at,
  };
}

async function insertRecommendation(rec, client) {
  const res = await ex(client).query(
    `INSERT INTO flow_recommendations
       (type, title, detail, expected_impact, risk, status, source, department_id, related_type, related_id, payload, created_by)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'pending'), $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      rec.type,
      rec.title,
      rec.detail || null,
      rec.expectedImpact || null,
      rec.risk || 'low',
      rec.status || null,
      rec.source || 'state_engine',
      rec.departmentId || null,
      rec.relatedType || null,
      rec.relatedId ? String(rec.relatedId) : null,
      JSON.stringify(rec.payload || {}),
      rec.createdBy || null,
    ]
  );
  return mapRecommendation(res.rows[0]);
}

async function listRecommendations({ status, limit = 50 } = {}, client) {
  const values = [];
  let where = '';
  if (status) {
    values.push(status);
    where = `WHERE status = $1`;
  }
  values.push(limit);
  const res = await ex(client).query(
    `SELECT * FROM flow_recommendations ${where} ORDER BY created_at DESC LIMIT $${values.length}`,
    values
  );
  return res.rows.map(mapRecommendation);
}

async function updateRecommendationStatus(id, status, userId, client) {
  const res = await ex(client).query(
    `UPDATE flow_recommendations SET status = $2, decided_by = $3, decided_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, status, userId || null]
  );
  return mapRecommendation(res.rows[0]);
}

/**
 * Insert one notification per user of a role. Returns inserted rows for socket emission.
 * @param {'admin'|'doctor'|'ot_manager'} role
 */
async function notifyRole(role, { type = 'general', title, message, relatedId = null }, client) {
  const res = await ex(client).query(
    `INSERT INTO notifications (user_id, type, title, message, related_id)
     SELECT id, $2::notification_type, $3, $4, $5 FROM users WHERE user_type = $1 AND is_active = TRUE
     RETURNING id, user_id AS "userId", type, title, message, related_id AS "relatedId", is_read AS "isRead", created_at AS "createdAt"`,
    [role, type, title, message, relatedId]
  );
  return res.rows;
}

async function notifyUsers(userIds, { type = 'general', title, message, relatedId = null }, client) {
  const ids = (userIds || []).filter(Boolean);
  if (ids.length === 0) return [];
  const res = await ex(client).query(
    `INSERT INTO notifications (user_id, type, title, message, related_id)
     SELECT id, $2::notification_type, $3, $4, $5 FROM users WHERE id = ANY($1::uuid[]) AND is_active = TRUE
     RETURNING id, user_id AS "userId", type, title, message, related_id AS "relatedId", is_read AS "isRead", created_at AS "createdAt"`,
    [ids, type, title, message, relatedId]
  );
  return res.rows;
}

/**
 * Insert an alert; duplicate dedupe keys are ignored. Returns the row or null when deduped.
 */
async function insertAlert(
  { severity, title, message, departmentId = null, departmentName = null, relatedType = null, relatedId = null, dedupeKey = null },
  client
) {
  const res = await ex(client).query(
    `INSERT INTO alerts (severity, title, message, department_id, department_name, related_type, related_id, dedupe_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id, severity, title, message, department_name, created_at`,
    [severity, title, message, departmentId, departmentName, relatedType, relatedId ? String(relatedId) : null, dedupeKey]
  );
  return res.rows[0] || null;
}

async function insertTimeline(patientId, status, note, userId, client) {
  await ex(client).query(
    `INSERT INTO patient_timeline (patient_id, status, note, changed_by) VALUES ($1, $2, $3, $4)`,
    [patientId, status, note, userId || null]
  );
}

async function getLatestKpiSnapshot(client) {
  const res = await ex(client).query('SELECT * FROM kpi_snapshots ORDER BY ts DESC LIMIT 1');
  return res.rows[0] || null;
}

module.exports = {
  ACTIVE_PATIENT_STATUSES,
  ZONE_SQL,
  getDepartments,
  getDepartmentByName,
  getDepartmentBedStats,
  getOtRoomStats,
  getHospitalBedTotals,
  getActivePatients,
  getPatientById,
  getWaitingPatients,
  getNurseStaffing,
  getFloatPool,
  insertFlowEvent,
  markFlowEventProcessed,
  insertRecommendation,
  listRecommendations,
  updateRecommendationStatus,
  mapRecommendation,
  notifyRole,
  notifyUsers,
  insertAlert,
  insertTimeline,
  getLatestKpiSnapshot,
};
