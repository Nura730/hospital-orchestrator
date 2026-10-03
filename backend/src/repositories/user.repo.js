const BaseRepository = require('./base.repo');
const db = require('../config/db');

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  async findByEmail(email, client = null) {
    const executor = client || db;
    const res = await executor.query(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [
      email.toLowerCase().trim(),
    ]);
    return res.rows[0] || null;
  }

  async createUser({ email, passwordHash, userType, fullName, phone }, client = null) {
    const executor = client || db;
    const res = await executor.query(
      `INSERT INTO users (email, password_hash, user_type, full_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, user_type, full_name, phone, is_active, created_at`,
      [email.toLowerCase().trim(), passwordHash, userType, fullName, phone || null]
    );
    return res.rows[0];
  }

  async updateLastLogin(id, client = null) {
    const executor = client || db;
    await executor.query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [id]);
  }

  async updatePassword(id, passwordHash, client = null) {
    const executor = client || db;
    const res = await executor.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
      [passwordHash, id]
    );
    return res.rows[0] || null;
  }

  async findOtManagerProfile(userId, client = null) {
    const executor = client || db;
    const query = `
      SELECT
        u.id,
        u.email,
        u.full_name AS "fullName",
        u.phone,
        u.user_type AS "userType",
        u.is_active AS "isActive",
        otm.employee_id AS "employeeId",
        otm.assigned_ot_ids AS "assignedOtIds",
        otm.shift_start AS "shiftStart",
        otm.shift_end AS "shiftEnd"
      FROM users u
      JOIN ot_managers otm ON u.id = otm.id
      WHERE u.id = $1
    `;
    const res = await executor.query(query, [userId]);
    return res.rows[0] || null;
  }
}

module.exports = new UserRepository();
