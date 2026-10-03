const BaseRepository = require('./base.repo');
const db = require('../config/db');

class AdminRepository extends BaseRepository {
  constructor() {
    super('admin_profiles');
  }

  async findProfileByUserId(userId, client = null) {
    const executor = client || db;
    const query = `
      SELECT u.id, u.email, u.full_name, u.phone, u.user_type, u.is_active, u.last_login,
             ap.employee_id, ap.designation, ap.permissions, ap.department_id,
             d.name AS department_name
      FROM users u
      JOIN admin_profiles ap ON u.id = ap.id
      LEFT JOIN departments d ON ap.department_id = d.id
      WHERE u.id = $1
    `;
    const res = await executor.query(query, [userId]);
    return res.rows[0] || null;
  }

  async getOverviewMetrics(client = null) {
    const executor = client || db;

    // Run parallel aggregation queries for hospital admin overview
    const [patientsRes, bedsRes, doctorsRes, otRoomsRes, otCasesRes, equipmentRes, alertsRes] =
      await Promise.all([
        executor.query(`
        SELECT
          COUNT(*)::int AS total_patients,
          COUNT(*) FILTER (WHERE status = 'waiting')::int AS waiting_patients,
          COUNT(*) FILTER (WHERE status = 'admitted')::int AS admitted_patients,
          COUNT(*) FILTER (WHERE status = 'critical' OR acuity = 1)::int AS critical_patients,
          COUNT(*) FILTER (WHERE status = 'in_surgery')::int AS in_surgery_patients,
          COUNT(*) FILTER (WHERE status = 'discharged' AND discharge_date >= CURRENT_DATE)::int AS discharged_today,
          COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - waiting_since)) / 60) FILTER (WHERE status = 'waiting'), 0)::numeric(8,2) AS avg_wait_min
        FROM patients
      `),
        executor.query(`
        SELECT
          COUNT(*)::int AS total_beds,
          COUNT(*) FILTER (WHERE status = 'occupied')::int AS occupied_beds,
          COUNT(*) FILTER (WHERE status = 'available')::int AS available_beds,
          COUNT(*) FILTER (WHERE status = 'cleaning')::int AS cleaning_beds,
          COUNT(*) FILTER (WHERE type = 'icu')::int AS icu_total,
          COUNT(*) FILTER (WHERE type = 'icu' AND status = 'occupied')::int AS icu_occupied,
          COUNT(*) FILTER (WHERE type = 'icu' AND status = 'available')::int AS icu_available,
          COUNT(*) FILTER (WHERE type = 'hdu')::int AS hdu_total,
          COUNT(*) FILTER (WHERE type = 'hdu' AND status = 'occupied')::int AS hdu_occupied
        FROM beds
      `),
        executor.query(`
        SELECT
          COUNT(*)::int AS total_doctors,
          COUNT(*) FILTER (WHERE status = 'available')::int AS doctors_available,
          COUNT(*) FILTER (WHERE status = 'in_surgery')::int AS doctors_in_surgery,
          COUNT(*) FILTER (WHERE status = 'in_consultation')::int AS doctors_in_consultation,
          COUNT(*) FILTER (WHERE status = 'off_duty')::int AS doctors_off_duty
        FROM doctors d
        JOIN users u ON d.id = u.id
        WHERE u.is_active = TRUE
      `),
        executor.query(`
        SELECT
          COUNT(*)::int AS ot_rooms_total,
          COUNT(*) FILTER (WHERE status = 'in_surgery')::int AS ot_in_progress,
          COUNT(*) FILTER (WHERE status = 'available')::int AS ot_available,
          COUNT(*) FILTER (WHERE status = 'cleaning')::int AS ot_cleaning
        FROM ot_rooms
      `),
        executor.query(`
        SELECT
          COUNT(*) FILTER (WHERE scheduled_start::date = CURRENT_DATE)::int AS today_ot_cases,
          COUNT(*) FILTER (WHERE scheduled_start::date = CURRENT_DATE AND status = 'completed')::int AS completed_ot_cases
        FROM ot_cases
      `),
        executor.query(`
        SELECT
          COUNT(*)::int AS total_equipment,
          COUNT(*) FILTER (WHERE status = 'available')::int AS equipment_available,
          COUNT(*) FILTER (WHERE status = 'fault')::int AS equipment_fault
        FROM equipment
      `),
        executor.query(`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('open', 'escalated'))::int AS open_alerts,
          COUNT(*) FILTER (WHERE status IN ('open', 'escalated') AND severity = 'critical')::int AS critical_alerts
        FROM alerts
      `),
      ]);

    const p = patientsRes.rows[0];
    const b = bedsRes.rows[0];
    const doc = doctorsRes.rows[0];
    const otR = otRoomsRes.rows[0];
    const otC = otCasesRes.rows[0];
    const eq = equipmentRes.rows[0];
    const al = alertsRes.rows[0];

    const bedOccupancyPct =
      b.total_beds > 0 ? Number(((b.occupied_beds / b.total_beds) * 100).toFixed(2)) : 0;
    const icuOccupancyPct =
      b.icu_total > 0 ? Number(((b.icu_occupied / b.icu_total) * 100).toFixed(2)) : 0;
    const hduOccupancyPct =
      b.hdu_total > 0 ? Number(((b.hdu_occupied / b.hdu_total) * 100).toFixed(2)) : 0;
    const otUtilizationPct =
      otR.ot_rooms_total > 0
        ? Number(((otR.ot_in_progress / otR.ot_rooms_total) * 100).toFixed(2))
        : 0;

    return {
      totalPatients: p.total_patients,
      waitingPatients: p.waiting_patients,
      admittedPatients: p.admitted_patients,
      criticalPatients: p.critical_patients,
      inSurgeryPatients: p.in_surgery_patients,
      dischargedToday: p.discharged_today,
      totalBeds: b.total_beds,
      occupiedBeds: b.occupied_beds,
      availableBeds: b.available_beds,
      cleaningBeds: b.cleaning_beds,
      bedOccupancyPct,
      icuTotal: b.icu_total,
      icuOccupied: b.icu_occupied,
      icuAvailable: b.icu_available,
      icuOccupancyPct,
      hduTotal: b.hdu_total,
      hduOccupied: b.hdu_occupied,
      hduOccupancyPct,
      totalDoctors: doc.total_doctors,
      doctorsAvailable: doc.doctors_available,
      doctorsInSurgery: doc.doctors_in_surgery,
      doctorsInConsultation: doc.doctors_in_consultation,
      doctorsOffDuty: doc.doctors_off_duty,
      otRoomsTotal: otR.ot_rooms_total,
      otInProgress: otR.ot_in_progress,
      otAvailable: otR.ot_available,
      otCleaning: otR.ot_cleaning,
      otUtilizationPct,
      todayOtCases: otC.today_ot_cases,
      completedOtCases: otC.completed_ot_cases,
      totalEquipment: eq.total_equipment,
      equipmentAvailable: eq.equipment_available,
      equipmentFault: eq.equipment_fault,
      openAlerts: al.open_alerts,
      criticalAlerts: al.critical_alerts,
      avgWaitMin: Number(p.avg_wait_min),
    };
  }

  async getDepartmentBreakdown(client = null) {
    const executor = client || db;
    const query = `
      SELECT
        d.id,
        d.name,
        d.floor,
        COUNT(b.id)::int AS total_beds,
        COUNT(b.id) FILTER (WHERE b.status = 'occupied')::int AS occupied_beds,
        ROUND(
          CASE WHEN COUNT(b.id) > 0
               THEN (COUNT(b.id) FILTER (WHERE b.status = 'occupied')::numeric / COUNT(b.id) * 100)
               ELSE 0
          END, 2
        )::float AS occupancy_pct,
        (
          SELECT COUNT(*)::int
          FROM doctors doc
          JOIN users u ON doc.id = u.id
          WHERE doc.department_id = d.id AND u.is_active = TRUE AND doc.status != 'off_duty'
        ) AS doctors_present,
        (
          SELECT COUNT(*)::int
          FROM patients pat
          WHERE pat.department_id = d.id AND pat.status = 'waiting'
        ) AS waiting_patients
      FROM departments d
      LEFT JOIN beds b ON d.id = b.department_id
      GROUP BY d.id, d.name, d.floor
      ORDER BY d.name ASC
    `;
    const res = await executor.query(query);
    return res.rows;
  }

  async getBedHeatmap(client = null) {
    const executor = client || db;
    const query = `
      SELECT
        d.name AS department,
        COALESCE(
          json_agg(
            json_build_object(
              'id', b.id,
              'type', b.type,
              'status', b.status,
              'roomNumber', b.room_number,
              'patientAlias', CASE WHEN p.id IS NOT NULL THEN p.patient_id ELSE NULL END
            ) ORDER BY b.id
          ) FILTER (WHERE b.id IS NOT NULL), '[]'::json
        ) AS beds
      FROM departments d
      LEFT JOIN beds b ON d.id = b.department_id
      LEFT JOIN patients p ON b.patient_id = p.id
      GROUP BY d.id, d.name
      ORDER BY d.name
    `;
    const res = await executor.query(query);
    return res.rows;
  }

  async getStaffSummary(client = null) {
    const executor = client || db;
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE user_type = 'ot_manager' AND is_active = TRUE)::int AS ot_managers,
        COUNT(*) FILTER (WHERE user_type = 'admin' AND is_active = TRUE)::int AS admins,
        COUNT(*) FILTER (WHERE is_active = TRUE)::int AS total_users
      FROM users
    `;
    const res = await executor.query(query);
    return res.rows[0];
  }
}

module.exports = new AdminRepository();
