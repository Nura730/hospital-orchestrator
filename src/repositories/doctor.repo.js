const BaseRepository = require('./base.repo');
const db = require('../config/db');

class DoctorRepository extends BaseRepository {
  constructor() {
    super('doctors');
  }

  async findDoctorByUserId(userId, client = null) {
    const executor = client || db;
    const query = `
      SELECT
        d.id,
        u.email,
        u.full_name AS "fullName",
        u.phone,
        u.user_type AS "userType",
        u.is_active AS "isActive",
        d.employee_id AS "employeeId",
        d.specialization,
        d.sub_specialization AS "subSpecialization",
        d.department_id AS "departmentId",
        dept.name AS department,
        d.qualification,
        d.experience_years AS "experienceYears",
        d.status,
        d.current_location AS "currentLocation",
        d.shift_start AS "shiftStart",
        d.shift_end AS "shiftEnd",
        d.max_surgeries_day AS "maxSurgeriesDay",
        d.surgeries_today AS "todaySurgeries",
        d.consultation_room AS "consultationRoom",
        d.is_on_call AS "isOnCall",
        (
          SELECT COUNT(*)::int
          FROM notifications n
          WHERE n.user_id = u.id AND n.is_read = FALSE
        ) AS "unreadNotifications"
      FROM doctors d
      JOIN users u ON d.id = u.id
      LEFT JOIN departments dept ON d.department_id = dept.id
      WHERE d.id = $1
    `;
    const res = await executor.query(query, [userId]);
    return res.rows[0] || null;
  }

  async findAllDoctors({ status, department, specialization } = {}, client = null) {
    const executor = client || db;
    const conditions = ['u.is_active = TRUE'];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`d.status = $${values.length}`);
    }
    if (department) {
      values.push(department);
      conditions.push(
        `(dept.name ILIKE $${values.length} OR d.department_id::text = $${values.length})`
      );
    }
    if (specialization) {
      values.push(specialization);
      conditions.push(`d.specialization ILIKE $${values.length}`);
    }

    const query = `
      SELECT
        d.id,
        d.employee_id AS "employeeId",
        u.full_name AS "fullName",
        u.email,
        u.phone,
        d.specialization,
        d.sub_specialization AS "subSpecialization",
        dept.name AS department,
        d.qualification,
        d.experience_years AS "experienceYears",
        d.status,
        d.current_location AS "currentLocation",
        d.shift_start AS "shiftStart",
        d.shift_end AS "shiftEnd",
        d.max_surgeries_day AS "maxSurgeriesDay",
        d.surgeries_today AS "surgeriesToday",
        d.consultation_room AS "consultationRoom",
        d.is_on_call AS "isOnCall"
      FROM doctors d
      JOIN users u ON d.id = u.id
      LEFT JOIN departments dept ON d.department_id = dept.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.full_name ASC
    `;
    const res = await executor.query(query, values);
    return res.rows;
  }

  async updateDoctor(doctorId, fields, client = null) {
    const executor = client || db;
    const allowed = [
      'specialization',
      'sub_specialization',
      'department_id',
      'qualification',
      'experience_years',
      'status',
      'current_location',
      'shift_start',
      'shift_end',
      'max_surgeries_day',
      'surgeries_today',
      'consultation_room',
      'is_on_call',
    ];

    const updates = [];
    const values = [doctorId];

    for (const [key, val] of Object.entries(fields)) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      if (allowed.includes(snakeKey)) {
        values.push(val);
        updates.push(`${snakeKey} = $${values.length}`);
      }
    }

    if (updates.length === 0) return this.findDoctorByUserId(doctorId, executor);

    const query = `
      UPDATE doctors
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `;
    await executor.query(query, values);
    return this.findDoctorByUserId(doctorId, executor);
  }

  async updateStatus(doctorId, status, client = null) {
    const executor = client || db;
    const res = await executor.query(`UPDATE doctors SET status = $1 WHERE id = $2 RETURNING *`, [
      status,
      doctorId,
    ]);
    return res.rows[0] || null;
  }

  async deactivateDoctor(doctorId, client = null) {
    const executor = client || db;
    const res = await executor.query(
      `UPDATE users SET is_active = FALSE WHERE id = $1 RETURNING id, is_active`,
      [doctorId]
    );
    return res.rows[0] || null;
  }

  async getDoctorSchedule(doctorId, client = null) {
    const executor = client || db;
    // Returns scheduled OT cases and patient appointments for today
    const query = `
      SELECT
        c.id AS "caseId",
        c.case_number AS "caseNumber",
        c.procedure_name AS "procedureName",
        c.scheduled_start AS "scheduledStart",
        c.scheduled_end AS "scheduledEnd",
        c.status,
        c.urgency,
        r.name AS "roomName",
        p.full_name AS "patientName",
        'surgery' AS "type"
      FROM ot_cases c
      JOIN ot_rooms r ON c.ot_room_id = r.id
      JOIN patients p ON c.patient_id = p.id
      WHERE (c.primary_surgeon_id = $1 OR $1 = ANY(c.assisting_doctors) OR c.anesthetist_id = $1)
        AND c.scheduled_start::date = CURRENT_DATE
      ORDER BY c.scheduled_start ASC
    `;
    const res = await executor.query(query, [doctorId]);
    return res.rows;
  }

  async getDoctorStats(doctorId, client = null) {
    const executor = client || db;
    const query = `
      SELECT
        COUNT(c.id) FILTER (WHERE c.scheduled_start >= CURRENT_DATE - INTERVAL '7 days' AND c.status = 'completed')::int AS "surgeriesThisWeek",
        COUNT(DISTINCT p.id)::int AS "patientsTreated",
        COALESCE(AVG(c.actual_duration_min) FILTER (WHERE c.status = 'completed'), 0)::numeric(5,1) AS "avgSurgeryDurationMin",
        d.surgeries_today AS "surgeriesToday",
        d.max_surgeries_day AS "maxSurgeriesDay"
      FROM doctors d
      LEFT JOIN ot_cases c ON d.id = c.primary_surgeon_id
      LEFT JOIN patients p ON d.id = p.assigned_doctor_id
      WHERE d.id = $1
      GROUP BY d.id, d.surgeries_today, d.max_surgeries_day
    `;
    const res = await executor.query(query, [doctorId]);
    return (
      res.rows[0] || {
        surgeriesThisWeek: 0,
        patientsTreated: 0,
        avgSurgeryDurationMin: 0,
        surgeriesToday: 0,
        maxSurgeriesDay: 4,
      }
    );
  }

  async getDoctorAvailabilityList(client = null) {
    const executor = client || db;
    const query = `
      SELECT
        d.id AS "doctorId",
        u.full_name AS "name",
        d.specialization,
        d.status,
        d.current_location AS "currentLocation",
        d.surgeries_today AS "todaySurgeries",
        d.max_surgeries_day AS "maxSurgeriesDay"
      FROM doctors d
      JOIN users u ON d.id = u.id
      WHERE u.is_active = TRUE
      ORDER BY d.status = 'available' DESC, d.surgeries_today ASC
    `;
    const res = await executor.query(query);
    return res.rows;
  }

  async getAvailableDoctorsForOt({ specialization, excludeCaseId } = {}, client = null) {
    const executor = client || db;
    const conditions = [
      'u.is_active = TRUE',
      "d.status IN ('available', 'in_consultation')",
      'd.surgeries_today < d.max_surgeries_day',
    ];
    const values = [];

    if (specialization) {
      values.push(specialization);
      conditions.push(`d.specialization ILIKE $${values.length}`);
    }

    if (excludeCaseId) {
      values.push(excludeCaseId);
      conditions.push(`d.id NOT IN (
        SELECT primary_surgeon_id FROM ot_cases WHERE id = $${values.length}
      )`);
    }

    const query = `
      SELECT
        d.id AS "doctorId",
        u.full_name AS "name",
        d.specialization,
        d.status,
        d.current_location AS "currentLocation",
        d.surgeries_today AS "todaySurgeries",
        d.max_surgeries_day AS "maxSurgeriesDay",
        d.is_on_call AS "isOnCall",
        d.qualification AS "qualifications",
        (
          SELECT MIN(c.scheduled_end)
          FROM ot_cases c
          WHERE (c.primary_surgeon_id = d.id OR c.anesthetist_id = d.id)
            AND c.status = 'in_progress'
        ) AS "nextAvailableAt"
      FROM doctors d
      JOIN users u ON d.id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY d.surgeries_today ASC, (d.status = 'available') DESC
    `;
    const res = await executor.query(query, values);
    return res.rows;
  }

  async getDoctorPeopleSummary(client = null) {
    const executor = client || db;
    const [countsRes, deptsRes, specsRes] = await Promise.all([
      executor.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'available')::int AS available,
          COUNT(*) FILTER (WHERE status = 'in_surgery')::int AS "inSurgery",
          COUNT(*) FILTER (WHERE status = 'in_consultation')::int AS "inConsultation",
          COUNT(*) FILTER (WHERE status = 'off_duty')::int AS "offDuty"
        FROM doctors d
        JOIN users u ON d.id = u.id
        WHERE u.is_active = TRUE
      `),
      executor.query(`
        SELECT dept.name, COUNT(d.id)::int AS count
        FROM departments dept
        JOIN doctors d ON dept.id = d.department_id
        JOIN users u ON d.id = u.id
        WHERE u.is_active = TRUE
        GROUP BY dept.name
        ORDER BY count DESC
      `),
      executor.query(`
        SELECT specialization AS spec, COUNT(d.id)::int AS count
        FROM doctors d
        JOIN users u ON d.id = u.id
        WHERE u.is_active = TRUE
        GROUP BY specialization
        ORDER BY count DESC
      `),
    ]);

    const counts = countsRes.rows[0];
    return {
      total: counts.total,
      available: counts.available,
      inSurgery: counts.inSurgery,
      inConsultation: counts.inConsultation,
      offDuty: counts.offDuty,
      byDepartment: deptsRes.rows,
      bySpecialization: specsRes.rows,
    };
  }
}

module.exports = new DoctorRepository();
