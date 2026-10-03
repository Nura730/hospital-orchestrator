const BaseRepository = require('./base.repo');
const db = require('../config/db');

class BedRepository extends BaseRepository {
  constructor() {
    super('beds');
  }

  async findBedById(id, client = null) {
    const executor = client || db;
    const query = `
      SELECT
        b.id,
        b.department_id AS "departmentId",
        dept.name AS "departmentName",
        b.ward,
        b.type,
        b.status,
        b.has_isolation AS "hasIsolation",
        b.has_ventilator AS "hasVentilator",
        b.has_monitor AS "hasMonitor",
        b.has_oxygen AS "hasOxygen",
        b.floor,
        b.room_number AS "roomNumber",
        b.expected_release_time AS "expectedReleaseTime",
        b.release_confidence AS "releaseConfidence",
        b.last_cleaned_at AS "lastCleanedAt",
        p.id AS "patientUuid",
        p.patient_id AS "patientId",
        p.full_name AS "patientName",
        p.age AS "patientAge",
        p.gender AS "patientGender",
        p.diagnosis AS "patientDiagnosis",
        p.acuity AS "patientAcuity"
      FROM beds b
      LEFT JOIN departments dept ON b.department_id = dept.id
      LEFT JOIN patients p ON b.patient_id = p.id
      WHERE b.id = $1
    `;
    const res = await executor.query(query, [id]);
    return res.rows[0] || null;
  }

  async findAllBeds({ status, type, department } = {}, client = null) {
    const executor = client || db;
    const conditions = ['1=1'];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`b.status = $${values.length}`);
    }
    if (type) {
      values.push(type);
      conditions.push(`b.type = $${values.length}`);
    }
    if (department) {
      values.push(department);
      conditions.push(
        `(dept.name ILIKE $${values.length} OR b.department_id::text = $${values.length})`
      );
    }

    const query = `
      SELECT
        b.id,
        b.department_id AS "departmentId",
        dept.name AS "departmentName",
        b.ward,
        b.type,
        b.status,
        b.has_isolation AS "hasIsolation",
        b.has_ventilator AS "hasVentilator",
        b.has_monitor AS "hasMonitor",
        b.has_oxygen AS "hasOxygen",
        b.floor,
        b.room_number AS "roomNumber",
        b.expected_release_time AS "expectedReleaseTime",
        p.patient_id AS "patientAlias",
        p.full_name AS "patientName"
      FROM beds b
      LEFT JOIN departments dept ON b.department_id = dept.id
      LEFT JOIN patients p ON b.patient_id = p.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY b.id ASC
    `;
    const res = await executor.query(query, values);
    return res.rows;
  }

  async findAvailableBeds({ type, department } = {}, client = null) {
    return this.findAllBeds({ status: 'available', type, department }, client);
  }

  async updateStatus(bedId, status, client = null) {
    const executor = client || db;
    const query = `
      UPDATE beds
      SET status = $1,
          last_cleaned_at = CASE WHEN $1 = 'available' THEN NOW() ELSE last_cleaned_at END,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const res = await executor.query(query, [status, bedId]);
    return res.rows[0] || null;
  }

  async reservePostOpBed(client = null) {
    const executor = client || db;
    // Find first available post_op bed, or fallback to general bed
    const query = `
      SELECT id, type, status, ward
      FROM beds
      WHERE status = 'available' AND (type = 'post_op' OR type = 'general')
      ORDER BY (type = 'post_op') DESC, id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    const res = await executor.query(query);
    return res.rows[0] || null;
  }
}

module.exports = new BedRepository();
