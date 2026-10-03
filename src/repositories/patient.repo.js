const BaseRepository = require('./base.repo');
const db = require('../config/db');

class PatientRepository extends BaseRepository {
  constructor() {
    super('patients');
  }

  async findPatientById(id, client = null) {
    const executor = client || db;
    const query = `
      SELECT
        p.id,
        p.patient_id AS "patientId",
        p.full_name AS "fullName",
        p.date_of_birth AS "dateOfBirth",
        p.age,
        p.gender,
        p.blood_group AS "bloodGroup",
        p.phone,
        p.emergency_contact AS "emergencyContact",
        p.address,
        p.status,
        p.acuity,
        p.department_id AS "departmentId",
        dept.name AS "departmentName",
        p.assigned_doctor_id AS "assignedDoctorId",
        u.full_name AS "doctorName",
        doc.specialization AS "doctorSpecialization",
        p.bed_id AS "bedId",
        b.type AS "bedType",
        b.ward AS "wardName",
        p.admission_date AS "admissionDate",
        p.expected_discharge AS "expectedDischarge",
        p.discharge_date AS "dischargeDate",
        p.diagnosis,
        p.notes,
        p.requires_icu AS "requiresIcu",
        p.requires_isolation AS "requiresIsolation",
        p.requires_ventilator AS "requiresVentilator",
        p.requires_ot AS "requiresOt",
        p.insurance_id AS "insuranceId",
        p.waiting_since AS "waitingSince",
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt"
      FROM patients p
      LEFT JOIN departments dept ON p.department_id = dept.id
      LEFT JOIN doctors doc ON p.assigned_doctor_id = doc.id
      LEFT JOIN users u ON doc.id = u.id
      LEFT JOIN beds b ON p.bed_id = b.id
      WHERE p.id::text = $1 OR p.patient_id = $1
    `;
    const res = await executor.query(query, [id]);
    if (!res.rows[0]) return null;

    const patient = res.rows[0];

    // Fetch timeline and OT cases
    const [timelineRes, otCasesRes] = await Promise.all([
      executor.query(
        `SELECT pt.id, pt.status, pt.note, pt.changed_at AS "changedAt", u.full_name AS "changedBy"
         FROM patient_timeline pt
         LEFT JOIN users u ON pt.changed_by = u.id
         WHERE pt.patient_id = $1
         ORDER BY pt.changed_at DESC`,
        [patient.id]
      ),
      executor.query(
        `SELECT c.id, c.case_number AS "caseNumber", c.procedure_name AS "procedureName",
                c.status, c.urgency, c.scheduled_start AS "scheduledStart",
                c.scheduled_end AS "scheduledEnd", r.name AS "roomName"
         FROM ot_cases c
         LEFT JOIN ot_rooms r ON c.ot_room_id = r.id
         WHERE c.patient_id = $1
         ORDER BY c.scheduled_start DESC`,
        [patient.id]
      ),
    ]);

    patient.timeline = timelineRes.rows;
    patient.otCases = otCasesRes.rows;
    return patient;
  }

  async findAllPatients(
    { status, acuity, department, doctor, limit = 50, offset = 0 } = {},
    client = null
  ) {
    const executor = client || db;
    const conditions = ['1=1'];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`p.status = $${values.length}`);
    }
    if (acuity) {
      values.push(Number(acuity));
      conditions.push(`p.acuity = $${values.length}`);
    }
    if (department) {
      values.push(department);
      conditions.push(
        `(dept.name ILIKE $${values.length} OR p.department_id::text = $${values.length})`
      );
    }
    if (doctor) {
      values.push(doctor);
      conditions.push(`p.assigned_doctor_id::text = $${values.length}`);
    }

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM patients p
      LEFT JOIN departments dept ON p.department_id = dept.id
      WHERE ${conditions.join(' AND ')}
    `;
    const countRes = await executor.query(countQuery, values);

    values.push(limit);
    const limitIdx = values.length;
    values.push(offset);
    const offsetIdx = values.length;

    const dataQuery = `
      SELECT
        p.id,
        p.patient_id AS "patientId",
        p.full_name AS "fullName",
        p.date_of_birth AS "dateOfBirth",
        p.age,
        p.gender,
        p.blood_group AS "bloodGroup",
        p.status,
        p.acuity,
        dept.name AS "departmentName",
        p.assigned_doctor_id AS "assignedDoctorId",
        u.full_name AS "doctorName",
        p.bed_id AS "bedId",
        p.admission_date AS "admissionDate",
        p.diagnosis,
        p.requires_ot AS "requiresOt",
        p.waiting_since AS "waitingSince"
      FROM patients p
      LEFT JOIN departments dept ON p.department_id = dept.id
      LEFT JOIN doctors doc ON p.assigned_doctor_id = doc.id
      LEFT JOIN users u ON doc.id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.acuity ASC, p.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const dataRes = await executor.query(dataQuery, values);
    return {
      patients: dataRes.rows,
      total: countRes.rows[0].total,
      limit,
      offset,
    };
  }

  async findPatientsByDoctor(doctorId, { status, limit = 50, offset = 0 } = {}, client = null) {
    const executor = client || db;
    const conditions = ['p.assigned_doctor_id = $1'];
    const values = [doctorId];

    if (status) {
      values.push(status);
      conditions.push(`p.status = $${values.length}`);
    }

    const countRes = await executor.query(
      `SELECT COUNT(*)::int AS total FROM patients p WHERE ${conditions.join(' AND ')}`,
      values
    );

    values.push(limit);
    const limitIdx = values.length;
    values.push(offset);
    const offsetIdx = values.length;

    const query = `
      SELECT
        p.id,
        p.patient_id AS "patientId",
        p.full_name AS "fullName",
        p.date_of_birth AS "dateOfBirth",
        p.age,
        p.gender,
        p.blood_group AS "bloodGroup",
        p.status,
        p.acuity,
        p.bed_id AS "bedId",
        p.admission_date AS "admissionDate",
        p.diagnosis,
        p.notes,
        p.requires_ot AS "requiresOt",
        p.waiting_since AS "waitingSince"
      FROM patients p
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.acuity ASC, p.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;
    const res = await executor.query(query, values);
    return {
      patients: res.rows,
      total: countRes.rows[0].total,
      limit,
      offset,
    };
  }

  async createPatient(data, client = null) {
    const executor = client || db;
    const query = `
      INSERT INTO patients (
        patient_id, full_name, date_of_birth, gender, blood_group,
        phone, emergency_contact, address, status, acuity,
        department_id, assigned_doctor_id, bed_id, admission_date,
        diagnosis, notes, requires_icu, requires_isolation,
        requires_ventilator, requires_ot, insurance_id
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, COALESCE($9, 'waiting'), COALESCE($10, 3),
        $11, $12, $13,
        CASE WHEN $9 = 'admitted' THEN NOW() ELSE $14 END,
        $15, $16, COALESCE($17, FALSE), COALESCE($18, FALSE),
        COALESCE($19, FALSE), COALESCE($20, FALSE), $21
      )
      RETURNING *
    `;
    const values = [
      data.patientId,
      data.fullName,
      data.dateOfBirth,
      data.gender,
      data.bloodGroup,
      data.phone,
      data.emergencyContact,
      data.address,
      data.status,
      data.acuity,
      data.departmentId,
      data.assignedDoctorId,
      data.bedId,
      data.admissionDate,
      data.diagnosis,
      data.notes,
      data.requiresIcu,
      data.requiresIsolation,
      data.requiresVentilator,
      data.requiresOt,
      data.insuranceId,
    ];
    const res = await executor.query(query, values);
    return res.rows[0];
  }

  async updatePatient(id, fields, client = null) {
    const executor = client || db;
    const allowed = [
      'full_name',
      'gender',
      'blood_group',
      'phone',
      'emergency_contact',
      'address',
      'acuity',
      'department_id',
      'assigned_doctor_id',
      'bed_id',
      'diagnosis',
      'notes',
      'requires_icu',
      'requires_isolation',
      'requires_ventilator',
      'requires_ot',
      'insurance_id',
    ];

    const updates = [];
    const values = [id];

    for (const [key, val] of Object.entries(fields)) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      if (allowed.includes(snakeKey)) {
        values.push(val);
        updates.push(`${snakeKey} = $${values.length}`);
      }
    }

    if (updates.length === 0) return this.findPatientById(id, executor);

    const query = `
      UPDATE patients
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `;
    await executor.query(query, values);
    return this.findPatientById(id, executor);
  }

  async updateStatus(patientId, status, note, changedByUserId, client = null) {
    const executor = client || db;
    const res = await executor.query(
      `UPDATE patients
       SET status = $1,
           discharge_date = CASE WHEN $1 = 'discharged' THEN NOW() ELSE discharge_date END
       WHERE id = $2 RETURNING *`,
      [status, patientId]
    );

    // Record timeline entry
    await executor.query(
      `INSERT INTO patient_timeline (patient_id, status, note, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [patientId, status, note || `Status updated to ${status}`, changedByUserId]
    );

    return res.rows[0];
  }

  async assignDoctor(patientId, doctorId, client = null) {
    const executor = client || db;
    const res = await executor.query(
      `UPDATE patients SET assigned_doctor_id = $1 WHERE id = $2 RETURNING *`,
      [doctorId, patientId]
    );
    return res.rows[0];
  }

  async assignBed(patientId, bedId, client = null) {
    const executor = client || db;
    const res = await executor.query(
      `UPDATE patients SET bed_id = $1, status = 'admitted' WHERE id = $2 RETURNING *`,
      [bedId, patientId]
    );
    return res.rows[0];
  }

  async dischargePatient(patientId, client = null) {
    const executor = client || db;
    const patientRes = await executor.query(`SELECT bed_id FROM patients WHERE id = $1`, [
      patientId,
    ]);
    const bedId = patientRes.rows[0]?.bed_id;

    const res = await executor.query(
      `UPDATE patients
       SET status = 'discharged',
           discharge_date = NOW(),
           bed_id = NULL
       WHERE id = $1 RETURNING *`,
      [patientId]
    );

    // Free bed and set cleaning
    if (bedId) {
      await executor.query(
        `UPDATE beds
         SET status = 'cleaning', patient_id = NULL, expected_release_time = NULL
         WHERE id = $1`,
        [bedId]
      );
    }

    return res.rows[0];
  }

  async getCriticalPatients(client = null) {
    const executor = client || db;
    const query = `
      SELECT
        p.id,
        p.patient_id AS "patientId",
        p.full_name AS "fullName",
        p.age,
        p.gender,
        p.blood_group AS "bloodGroup",
        p.status,
        p.acuity,
        p.bed_id AS "bedId",
        dept.name AS "departmentName",
        u.full_name AS "doctorName",
        p.diagnosis
      FROM patients p
      LEFT JOIN departments dept ON p.department_id = dept.id
      LEFT JOIN doctors doc ON p.assigned_doctor_id = doc.id
      LEFT JOIN users u ON doc.id = u.id
      WHERE p.status = 'critical' OR p.acuity = 1
      ORDER BY p.acuity ASC, p.admission_date DESC
    `;
    const res = await executor.query(query);
    return res.rows;
  }

  async getRecentAdmissions(limit = 5, client = null) {
    const executor = client || db;
    const query = `
      SELECT
        p.id,
        p.patient_id AS "patientId",
        p.full_name AS "fullName",
        p.age,
        p.status,
        p.acuity,
        p.admission_date AS "admissionDate",
        p.bed_id AS "bedId",
        dept.name AS "departmentName",
        u.full_name AS "doctorName"
      FROM patients p
      LEFT JOIN departments dept ON p.department_id = dept.id
      LEFT JOIN doctors doc ON p.assigned_doctor_id = doc.id
      LEFT JOIN users u ON doc.id = u.id
      WHERE p.admission_date IS NOT NULL
      ORDER BY p.admission_date DESC
      LIMIT $1
    `;
    const res = await executor.query(query, [limit]);
    return res.rows;
  }

  async getPatientPeopleSummary(client = null) {
    const executor = client || db;
    const [countsRes, deptsRes, acuityRes] = await Promise.all([
      executor.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'waiting')::int AS waiting,
          COUNT(*) FILTER (WHERE status = 'admitted')::int AS admitted,
          COUNT(*) FILTER (WHERE status = 'critical')::int AS critical,
          COUNT(*) FILTER (WHERE status = 'in_surgery')::int AS "inSurgery",
          COUNT(*) FILTER (WHERE status = 'discharged')::int AS discharged
        FROM patients
      `),
      executor.query(`
        SELECT dept.name, COUNT(p.id)::int AS count
        FROM departments dept
        JOIN patients p ON dept.id = p.department_id
        GROUP BY dept.name
        ORDER BY count DESC
      `),
      executor.query(`
        SELECT acuity AS level, COUNT(*)::int AS count
        FROM patients
        WHERE acuity IS NOT NULL
        GROUP BY acuity
        ORDER BY acuity ASC
      `),
    ]);

    const counts = countsRes.rows[0];
    return {
      total: counts.total,
      waiting: counts.waiting,
      admitted: counts.admitted,
      critical: counts.critical,
      inSurgery: counts.inSurgery,
      discharged: counts.discharged,
      byDepartment: deptsRes.rows,
      byAcuity: acuityRes.rows,
    };
  }
}

module.exports = new PatientRepository();
