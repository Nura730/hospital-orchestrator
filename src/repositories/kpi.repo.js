const BaseRepository = require('./base.repo');
const db = require('../config/db');

class KpiRepository extends BaseRepository {
  constructor() {
    super('kpi_snapshots');
  }

  async insertSnapshot(data, client = null) {
    const executor = client || db;
    const query = `
      INSERT INTO kpi_snapshots (
        total_patients, waiting_patients, admitted_patients, critical_patients,
        discharged_today, total_beds, occupied_beds, available_beds,
        icu_occupied, icu_total, ot_in_progress, ot_available,
        doctors_available, doctors_in_surgery, avg_wait_minutes,
        bed_occupancy_pct, icu_occupancy_pct, ot_utilization_pct
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;
    const values = [
      data.totalPatients,
      data.waitingPatients,
      data.admittedPatients,
      data.criticalPatients,
      data.dischargedToday,
      data.totalBeds,
      data.occupiedBeds,
      data.availableBeds,
      data.icuOccupied,
      data.icuTotal,
      data.otInProgress,
      data.otAvailable,
      data.doctorsAvailable,
      data.doctorsInSurgery,
      data.avgWaitMinutes,
      data.bedOccupancyPct,
      data.icuOccupancyPct,
      data.otUtilizationPct,
    ];
    const res = await executor.query(query, values);
    return res.rows[0];
  }

  async getLatest(client = null) {
    const executor = client || db;
    const res = await executor.query(`SELECT * FROM kpi_snapshots ORDER BY ts DESC LIMIT 1`);
    return res.rows[0] || null;
  }

  async getHistory(days = 7, client = null) {
    const executor = client || db;
    const query = `
      SELECT
        ts,
        total_patients AS "totalPatients",
        waiting_patients AS "waitingPatients",
        admitted_patients AS "admittedPatients",
        critical_patients AS "criticalPatients",
        discharged_today AS "dischargedToday",
        total_beds AS "totalBeds",
        occupied_beds AS "occupiedBeds",
        available_beds AS "availableBeds",
        icu_occupied AS "icuOccupied",
        icu_total AS "icuTotal",
        ot_in_progress AS "otInProgress",
        ot_available AS "otAvailable",
        doctors_available AS "doctorsAvailable",
        doctors_in_surgery AS "doctorsInSurgery",
        avg_wait_minutes AS "avgWaitMinutes",
        bed_occupancy_pct AS "bedOccupancyPct",
        icu_occupancy_pct AS "icuOccupancyPct",
        ot_utilization_pct AS "otUtilizationPct"
      FROM kpi_snapshots
      WHERE ts >= NOW() - ($1 || ' days')::interval
      ORDER BY ts ASC
    `;
    const res = await executor.query(query, [days]);
    return res.rows;
  }

  async computeCurrentLiveMetrics(client = null) {
    const executor = client || db;
    const query = `
      SELECT
        (SELECT COUNT(*)::int FROM patients) AS total_patients,
        (SELECT COUNT(*)::int FROM patients WHERE status = 'waiting') AS waiting_patients,
        (SELECT COUNT(*)::int FROM patients WHERE status = 'admitted') AS admitted_patients,
        (SELECT COUNT(*)::int FROM patients WHERE status = 'critical' OR acuity = 1) AS critical_patients,
        (SELECT COUNT(*)::int FROM patients WHERE status = 'discharged' AND discharge_date >= CURRENT_DATE) AS discharged_today,
        (SELECT COUNT(*)::int FROM beds) AS total_beds,
        (SELECT COUNT(*)::int FROM beds WHERE status = 'occupied') AS occupied_beds,
        (SELECT COUNT(*)::int FROM beds WHERE status = 'available') AS available_beds,
        (SELECT COUNT(*)::int FROM beds WHERE type = 'icu' AND status = 'occupied') AS icu_occupied,
        (SELECT COUNT(*)::int FROM beds WHERE type = 'icu') AS icu_total,
        (SELECT COUNT(*)::int FROM ot_rooms WHERE status = 'in_surgery') AS ot_in_progress,
        (SELECT COUNT(*)::int FROM ot_rooms WHERE status = 'available') AS ot_available,
        (SELECT COUNT(*)::int FROM doctors WHERE status = 'available') AS doctors_available,
        (SELECT COUNT(*)::int FROM doctors WHERE status = 'in_surgery') AS doctors_in_surgery,
        COALESCE(
          (SELECT AVG(EXTRACT(EPOCH FROM (NOW() - waiting_since)) / 60) FROM patients WHERE status = 'waiting'),
          0
        )::numeric(8,2) AS avg_wait_minutes,
        (
          SELECT COUNT(*)::int FROM alerts WHERE status IN ('open', 'escalated') AND severity = 'critical'
        ) AS critical_alerts
    `;
    const res = await executor.query(query);
    const row = res.rows[0];

    const bedOccupancyPct =
      row.total_beds > 0 ? Number(((row.occupied_beds / row.total_beds) * 100).toFixed(2)) : 0;
    const icuOccupancyPct =
      row.icu_total > 0 ? Number(((row.icu_occupied / row.icu_total) * 100).toFixed(2)) : 0;
    const totalOt = row.ot_in_progress + row.ot_available || 1;
    const otUtilizationPct = Number(((row.ot_in_progress / totalOt) * 100).toFixed(2));

    return {
      totalPatients: row.total_patients,
      waitingPatients: row.waiting_patients,
      admittedPatients: row.admitted_patients,
      criticalPatients: row.critical_patients,
      dischargedToday: row.discharged_today,
      totalBeds: row.total_beds,
      occupiedBeds: row.occupied_beds,
      availableBeds: row.available_beds,
      icuOccupied: row.icu_occupied,
      icuTotal: row.icu_total,
      otInProgress: row.ot_in_progress,
      otAvailable: row.ot_available,
      doctorsAvailable: row.doctors_available,
      doctorsInSurgery: row.doctors_in_surgery,
      avgWaitMinutes: Number(row.avg_wait_minutes),
      bedOccupancyPct,
      icuOccupancyPct,
      otUtilizationPct,
      criticalAlerts: row.critical_alerts,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = new KpiRepository();
