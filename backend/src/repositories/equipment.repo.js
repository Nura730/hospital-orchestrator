const BaseRepository = require('./base.repo');
const db = require('../config/db');

class EquipmentRepository extends BaseRepository {
  constructor() {
    super('equipment');
  }

  async findAll({ status, type, departmentId, otRoomId } = {}, client = null) {
    const executor = client || db;
    const conditions = ['1=1'];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`e.status = $${values.length}`);
    }
    if (type) {
      values.push(type);
      conditions.push(`e.type ILIKE $${values.length}`);
    }
    if (departmentId) {
      values.push(departmentId);
      conditions.push(`e.department_id = $${values.length}`);
    }
    if (otRoomId) {
      values.push(otRoomId);
      conditions.push(`e.ot_room_id = $${values.length}`);
    }

    const query = `
      SELECT
        e.id,
        e.name,
        e.type,
        e.model,
        e.serial_number AS "serialNumber",
        e.department_id AS "departmentId",
        dept.name AS "departmentName",
        e.ot_room_id AS "otRoomId",
        r.name AS "otRoomName",
        e.status,
        e.battery_pct AS "batteryPct",
        e.last_maintained AS "lastMaintained",
        e.next_maintenance AS "nextMaintenance",
        e.failure_risk AS "failureRisk",
        e.location,
        e.assigned_to_case AS "assignedToCase"
      FROM equipment e
      LEFT JOIN departments dept ON e.department_id = dept.id
      LEFT JOIN ot_rooms r ON e.ot_room_id = r.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.name ASC
    `;
    const res = await executor.query(query, values);
    return res.rows;
  }

  async updateStatus(id, status, client = null) {
    const executor = client || db;
    const res = await executor.query(
      `UPDATE equipment SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return res.rows[0] || null;
  }
}

module.exports = new EquipmentRepository();
