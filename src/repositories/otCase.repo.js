const BaseRepository = require('./base.repo');
const db = require('../config/db');

class OtCaseRepository extends BaseRepository {
  constructor() {
    super('ot_cases');
  }

  async findCaseById(id, client = null) {
    const executor = client || db;
    const query = `
      SELECT
        c.id,
        c.case_number AS "caseNumber",
        c.procedure_name AS "procedureName",
        c.procedure_code AS "procedureCode",
        c.urgency,
        c.status,
        c.scheduled_start AS "scheduledStart",
        c.scheduled_end AS "scheduledEnd",
        c.predicted_duration_min AS "predictedDurationMin",
        c.actual_start AS "actualStart",
        c.actual_end AS "actualEnd",
        c.actual_duration_min AS "actualDurationMin",
        c.delay_reason AS "delayReason",
        c.notes,
        c.created_at AS "createdAt",
        json_build_object(
          'id', p.id,
          'patientId', p.patient_id,
          'name', p.full_name,
          'age', p.age,
          'gender', p.gender,
          'bloodGroup', p.blood_group,
          'diagnosis', p.diagnosis
        ) AS "patient",
        json_build_object(
          'id', r.id,
          'name', r.name,
          'specialization', r.specialization,
          'status', r.status
        ) AS "otRoom",
        json_build_object(
          'id', doc.id,
          'name', u.full_name,
          'specialization', doc.specialization
        ) AS "primarySurgeon",
        CASE WHEN anesth.id IS NOT NULL THEN
          json_build_object(
            'id', anesth.id,
            'name', anesth_u.full_name,
            'specialization', anesth.specialization
          )
        ELSE NULL END AS "anesthetist",
        c.assisting_doctors AS "assistingDoctorIds",
        CASE WHEN b.id IS NOT NULL THEN
          json_build_object(
            'id', b.id,
            'type', b.type,
            'status', b.status,
            'ward', b.ward
          )
        ELSE NULL END AS "postOpBed"
      FROM ot_cases c
      JOIN patients p ON c.patient_id = p.id
      JOIN ot_rooms r ON c.ot_room_id = r.id
      JOIN doctors doc ON c.primary_surgeon_id = doc.id
      JOIN users u ON doc.id = u.id
      LEFT JOIN doctors anesth ON c.anesthetist_id = anesth.id
      LEFT JOIN users anesth_u ON anesth.id = anesth_u.id
      LEFT JOIN beds b ON c.post_op_bed_id = b.id
      WHERE c.id::text = $1 OR c.case_number = $1
    `;
    const res = await executor.query(query, [id]);
    return res.rows[0] || null;
  }

  async findAllCases({ status, date, room, surgeon } = {}, client = null) {
    const executor = client || db;
    const conditions = ['1=1'];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`c.status = $${values.length}`);
    }
    if (date) {
      values.push(date);
      conditions.push(`c.scheduled_start::date = $${values.length}::date`);
    }
    if (room) {
      values.push(room);
      conditions.push(`c.ot_room_id::text = $${values.length}`);
    }
    if (surgeon) {
      values.push(surgeon);
      conditions.push(
        `(c.primary_surgeon_id::text = $${values.length} OR $${values.length} = ANY(c.assisting_doctors))`
      );
    }

    const query = `
      SELECT
        c.id,
        c.case_number AS "caseNumber",
        c.procedure_name AS "procedureName",
        c.urgency,
        c.status,
        c.scheduled_start AS "scheduledStart",
        c.scheduled_end AS "scheduledEnd",
        c.actual_start AS "actualStart",
        c.actual_end AS "actualEnd",
        c.predicted_duration_min AS "predictedDurationMin",
        c.actual_duration_min AS "actualDurationMin",
        p.id AS "patientId",
        p.full_name AS "patientName",
        r.id AS "roomId",
        r.name AS "roomName",
        u.full_name AS "surgeonName"
      FROM ot_cases c
      JOIN patients p ON c.patient_id = p.id
      JOIN ot_rooms r ON c.ot_room_id = r.id
      JOIN doctors doc ON c.primary_surgeon_id = doc.id
      JOIN users u ON doc.id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.scheduled_start ASC
    `;
    const res = await executor.query(query, values);
    return res.rows;
  }

  async findCasesByDoctor(doctorId, client = null) {
    const executor = client || db;
    const query = `
      SELECT
        c.id AS "caseId",
        c.case_number AS "caseNumber",
        p.full_name AS "patientName",
        c.procedure_name AS "procedure",
        r.name AS "otRoom",
        c.scheduled_start AS "scheduledStart",
        c.scheduled_end AS "scheduledEnd",
        c.actual_start AS "actualStart",
        c.actual_end AS "actualEnd",
        c.status,
        c.urgency
      FROM ot_cases c
      JOIN patients p ON c.patient_id = p.id
      JOIN ot_rooms r ON c.ot_room_id = r.id
      WHERE (c.primary_surgeon_id = $1 OR $1 = ANY(c.assisting_doctors) OR c.anesthetist_id = $1)
      ORDER BY c.scheduled_start DESC
    `;
    const res = await executor.query(query, [doctorId]);
    return res.rows;
  }

  async checkRoomOverlap(roomId, start, end, excludeCaseId = null, client = null) {
    const executor = client || db;
    const query = `
      SELECT id, case_number
      FROM ot_cases
      WHERE ot_room_id = $1
        AND status IN ('scheduled', 'in_progress')
        AND tstzrange(scheduled_start, scheduled_end) && tstzrange($2, $3)
        AND ($4::uuid IS NULL OR id != $4::uuid)
      LIMIT 1
    `;
    const res = await executor.query(query, [roomId, start, end, excludeCaseId]);
    return res.rows[0] || null;
  }

  async checkDoctorOverlap(doctorId, start, end, excludeCaseId = null, client = null) {
    const executor = client || db;
    const query = `
      SELECT id, case_number
      FROM ot_cases
      WHERE (primary_surgeon_id = $1 OR anesthetist_id = $1 OR $1 = ANY(assisting_doctors))
        AND status IN ('scheduled', 'in_progress')
        AND tstzrange(scheduled_start, scheduled_end) && tstzrange($2, $3)
        AND ($4::uuid IS NULL OR id != $4::uuid)
      LIMIT 1
    `;
    const res = await executor.query(query, [doctorId, start, end, excludeCaseId]);
    return res.rows[0] || null;
  }

  async createCase(data, client = null) {
    const executor = client || db;
    const query = `
      INSERT INTO ot_cases (
        case_number, patient_id, ot_room_id, primary_surgeon_id,
        assisting_doctors, anesthetist_id, procedure_name, procedure_code,
        urgency, status, scheduled_start, scheduled_end,
        predicted_duration_min, post_op_bed_required, post_op_bed_id,
        notes, created_by
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        COALESCE($9, 'elective'), 'scheduled', $10, $11,
        $12, COALESCE($13, TRUE), $14,
        $15, $16
      )
      RETURNING *
    `;
    const values = [
      data.caseNumber,
      data.patientId,
      data.otRoomId,
      data.primarySurgeonId,
      data.assistingDoctors || [],
      data.anesthetistId,
      data.procedureName,
      data.procedureCode,
      data.urgency,
      data.scheduledStart,
      data.scheduledEnd,
      data.predictedDurationMin,
      data.postOpBedRequired,
      data.postOpBedId,
      data.notes,
      data.createdBy,
    ];
    const res = await executor.query(query, values);
    return res.rows[0];
  }

  async findOverrunCases(client = null) {
    const executor = client || db;
    const query = `
      SELECT
        c.id,
        c.case_number AS "caseNumber",
        c.ot_room_id AS "roomId",
        r.name AS "roomName",
        c.procedure_name AS "procedureName",
        c.scheduled_end AS "scheduledEnd",
        ROUND(EXTRACT(EPOCH FROM (NOW() - c.scheduled_end)) / 60)::int AS "overrunMinutes"
      FROM ot_cases c
      JOIN ot_rooms r ON c.ot_room_id = r.id
      WHERE c.status = 'in_progress' AND c.scheduled_end < NOW()
    `;
    const res = await executor.query(query);
    return res.rows;
  }

  async getOtStats(client = null) {
    const executor = client || db;
    const query = `
      SELECT
        COUNT(*)::int AS "totalCasesToday",
        COUNT(*) FILTER (WHERE status = 'completed')::int AS "completedCasesToday",
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS "inProgressCases",
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS "cancelledCases",
        COUNT(*) FILTER (WHERE status = 'delayed')::int AS "delayedCases",
        COUNT(*) FILTER (WHERE actual_duration_min > predicted_duration_min)::int AS "overrunCases",
        ROUND(
          COALESCE(AVG(actual_duration_min) FILTER (WHERE status = 'completed'), 0), 1
        )::float AS "avgDurationMin",
        ROUND(
          CASE WHEN COUNT(*) FILTER (WHERE status = 'completed') > 0
               THEN (COUNT(*) FILTER (WHERE status = 'completed' AND (actual_end <= scheduled_end OR actual_duration_min <= predicted_duration_min))::numeric /
                     COUNT(*) FILTER (WHERE status = 'completed') * 100)
               ELSE 100
          END, 1
        )::float AS "onTimePct"
      FROM ot_cases
      WHERE scheduled_start::date = CURRENT_DATE
    `;
    const res = await executor.query(query);
    return res.rows[0];
  }

  // OT Requests
  async createRequest(data, client = null) {
    const executor = client || db;
    const query = `
      INSERT INTO ot_requests (
        doctor_id, patient_id, procedure_name, urgency,
        preferred_date, preferred_time, duration_min, notes, status
      )
      VALUES ($1, $2, $3, COALESCE($4, 'elective'), $5, $6, $7, $8, 'pending')
      RETURNING *
    `;
    const values = [
      data.doctorId,
      data.patientId,
      data.procedureName,
      data.urgency,
      data.preferredDate,
      data.preferredTime,
      data.durationMin,
      data.notes,
    ];
    const res = await executor.query(query, values);
    return res.rows[0];
  }

  async findAllRequests(doctorId = null, client = null) {
    const executor = client || db;
    const conditions = ['1=1'];
    const values = [];

    if (doctorId) {
      values.push(doctorId);
      conditions.push(`r.doctor_id = $${values.length}`);
    }

    const query = `
      SELECT
        r.id,
        r.doctor_id AS "doctorId",
        u.full_name AS "doctorName",
        doc.specialization,
        r.patient_id AS "patientId",
        p.full_name AS "patientName",
        p.patient_id AS "patientCode",
        r.procedure_name AS "procedureName",
        r.urgency,
        r.preferred_date AS "preferredDate",
        r.preferred_time AS "preferredTime",
        r.duration_min AS "durationMin",
        r.notes,
        r.status,
        r.reject_reason AS "rejectReason",
        r.ot_case_id AS "otCaseId",
        r.created_at AS "createdAt"
      FROM ot_requests r
      JOIN doctors doc ON r.doctor_id = doc.id
      JOIN users u ON doc.id = u.id
      JOIN patients p ON r.patient_id = p.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.created_at DESC
    `;
    const res = await executor.query(query, values);
    return res.rows;
  }
}

module.exports = new OtCaseRepository();
