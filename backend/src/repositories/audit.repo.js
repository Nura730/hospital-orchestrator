const BaseRepository = require('./base.repo');
const db = require('../config/db');

class AuditRepository extends BaseRepository {
  constructor() {
    super('audit_log');
  }

  async insertAudit(
    { userId, username, userType, action, target, targetId, detail, ip },
    client = null
  ) {
    const executor = client || db;
    const query = `
      INSERT INTO audit_log (user_id, username, user_type, action, target, target_id, detail, ip)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const res = await executor.query(query, [
      userId || null,
      username || null,
      userType || null,
      action,
      target || null,
      targetId ? String(targetId) : null,
      detail ? JSON.stringify(detail) : null,
      ip || null,
    ]);
    return res.rows[0];
  }

  async findRecentAudits(limit = 50, offset = 0, client = null) {
    const executor = client || db;
    const query = `
      SELECT
        id,
        time,
        user_id AS "userId",
        username,
        user_type AS "userType",
        action,
        target,
        target_id AS "targetId",
        detail,
        ip
      FROM audit_log
      ORDER BY time DESC
      LIMIT $1 OFFSET $2
    `;
    const res = await executor.query(query, [limit, offset]);
    return res.rows;
  }
}

module.exports = new AuditRepository();
