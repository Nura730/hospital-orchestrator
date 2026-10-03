const BaseRepository = require('./base.repo');
const db = require('../config/db');

class OtRepository extends BaseRepository {
  constructor() {
    super('ot_rooms');
  }

  async findAllRooms(client = null) {
    const executor = client || db;
    const query = `
      SELECT
        r.id,
        r.name,
        r.specialization,
        r.status,
        r.floor,
        r.equipment_ids AS "equipmentIds",
        r.current_case_id AS "currentCaseId",
        r.next_available AS "nextAvailable",
        r.last_cleaned_at AS "lastCleanedAt",
        c.case_number AS "currentCaseNumber",
        c.procedure_name AS "currentProcedure",
        p.full_name AS "currentPatientName",
        u.full_name AS "currentSurgeonName",
        c.scheduled_end AS "currentScheduledEnd"
      FROM ot_rooms r
      LEFT JOIN ot_cases c ON r.current_case_id = c.id
      LEFT JOIN patients p ON c.patient_id = p.id
      LEFT JOIN doctors doc ON c.primary_surgeon_id = doc.id
      LEFT JOIN users u ON doc.id = u.id
      ORDER BY r.id ASC
    `;
    const res = await executor.query(query);
    return res.rows;
  }

  async findRoomById(id, client = null) {
    const executor = client || db;
    const query = `
      SELECT
        r.id,
        r.name,
        r.specialization,
        r.status,
        r.floor,
        r.current_case_id AS "currentCaseId",
        r.next_available AS "nextAvailable",
        r.last_cleaned_at AS "lastCleanedAt"
      FROM ot_rooms r
      WHERE r.id = $1
    `;
    const res = await executor.query(query, [id]);
    if (!res.rows[0]) return null;

    const room = res.rows[0];

    // Fetch equipment assigned to room
    const eqRes = await executor.query(
      `SELECT id, name, type, model, serial_number AS "serialNumber", status, battery_pct AS "batteryPct"
       FROM equipment
       WHERE ot_room_id = $1
       ORDER BY name ASC`,
      [id]
    );
    room.equipment = eqRes.rows;

    return room;
  }

  async findAvailableNow(client = null) {
    const executor = client || db;
    const query = `
      SELECT r.id, r.name, r.specialization, r.status, r.floor, r.next_available AS "nextAvailable"
      FROM ot_rooms r
      WHERE r.status = 'available'
      ORDER BY r.id ASC
    `;
    const res = await executor.query(query);
    return res.rows;
  }

  async updateRoomStatus(roomId, status, client = null) {
    const executor = client || db;
    const query = `
      UPDATE ot_rooms
      SET status = $1,
          last_cleaned_at = CASE WHEN $1 = 'available' THEN NOW() ELSE last_cleaned_at END,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const res = await executor.query(query, [status, roomId]);
    return res.rows[0] || null;
  }

  async markCleaningDone(roomId, client = null) {
    const executor = client || db;
    const query = `
      UPDATE ot_rooms
      SET status = 'available',
          last_cleaned_at = NOW(),
          current_case_id = NULL,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await executor.query(query, [roomId]);
    return res.rows[0] || null;
  }

  async getTodayTimeline(client = null) {
    const executor = client || db;
    const roomsQuery = `
      SELECT id, name, specialization, status, floor
      FROM ot_rooms
      ORDER BY id ASC
    `;
    const roomsRes = await executor.query(roomsQuery);
    const rooms = roomsRes.rows;

    const casesQuery = `
      SELECT
        c.id,
        c.case_number AS "caseNumber",
        c.ot_room_id AS "roomId",
        p.full_name AS "patientName",
        p.patient_id AS "patientId",
        u.full_name AS "surgeon",
        doc.specialization AS "surgeonSpecialization",
        c.procedure_name AS "procedure",
        c.scheduled_start AS "start",
        c.scheduled_end AS "end",
        c.actual_start AS "actualStart",
        c.actual_end AS "actualEnd",
        c.status,
        c.urgency
      FROM ot_cases c
      JOIN patients p ON c.patient_id = p.id
      JOIN doctors doc ON c.primary_surgeon_id = doc.id
      JOIN users u ON doc.id = u.id
      WHERE c.scheduled_start::date = CURRENT_DATE
      ORDER BY c.scheduled_start ASC
    `;
    const casesRes = await executor.query(casesQuery);
    const cases = casesRes.rows;

    return rooms.map((room) => ({
      id: room.id,
      name: room.name,
      specialization: room.specialization,
      status: room.status,
      cases: cases.filter((c) => c.roomId === room.id),
    }));
  }
}

module.exports = new OtRepository();
