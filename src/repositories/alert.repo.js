const BaseRepository = require('./base.repo');
const db = require('../config/db');

class AlertRepository extends BaseRepository {
  constructor() {
    super('alerts');
  }

  async findAll({ severity, status, department } = {}, client = null) {
    const executor = client || db;
    const conditions = ['1=1'];
    const values = [];

    if (severity) {
      values.push(severity);
      conditions.push(`a.severity = $${values.length}`);
    }
    if (status) {
      values.push(status);
      conditions.push(`a.status = $${values.length}`);
    }
    if (department) {
      values.push(department);
      conditions.push(
        `(a.department_name ILIKE $${values.length} OR a.department_id::text = $${values.length})`
      );
    }

    const query = `
      SELECT
        a.id,
        a.severity,
        a.title,
        a.message,
        a.department_id AS "departmentId",
        a.department_name AS "departmentName",
        a.related_type AS "relatedType",
        a.related_id AS "relatedId",
        a.status,
        a.escalation_level AS "escalationLevel",
        a.created_at AS "createdAt",
        a.acknowledged_at AS "acknowledgedAt",
        u_ack.full_name AS "acknowledgedBy",
        a.resolved_at AS "resolvedAt",
        u_res.full_name AS "resolvedBy"
      FROM alerts a
      LEFT JOIN users u_ack ON a.acknowledged_by = u_ack.id
      LEFT JOIN users u_res ON a.resolved_by = u_res.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE a.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        a.created_at DESC
    `;
    const res = await executor.query(query, values);
    return res.rows;
  }

  async findRecentAlerts(limit = 5, client = null) {
    const executor = client || db;
    const query = `
      SELECT
        a.id,
        a.severity,
        a.title,
        a.message,
        a.department_name AS "departmentName",
        a.status,
        a.escalation_level AS "escalationLevel",
        a.created_at AS "createdAt"
      FROM alerts a
      ORDER BY a.created_at DESC
      LIMIT $1
    `;
    const res = await executor.query(query, [limit]);
    return res.rows;
  }

  async createAlert(data, client = null) {
    const executor = client || db;
    const query = `
      INSERT INTO alerts (
        severity, title, message, department_id, department_name,
        related_type, related_id, status, escalation_level, dedupe_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', 1, $8)
      ON CONFLICT (dedupe_key) DO UPDATE SET
        severity = EXCLUDED.severity,
        message = EXCLUDED.message,
        status = 'open'
      RETURNING *
    `;
    const values = [
      data.severity,
      data.title,
      data.message,
      data.departmentId || null,
      data.departmentName || null,
      data.relatedType || null,
      data.relatedId || null,
      data.dedupeKey || null,
    ];
    const res = await executor.query(query, values);
    return res.rows[0];
  }

  async acknowledgeAlert(id, userId, client = null) {
    const executor = client || db;
    const query = `
      UPDATE alerts
      SET status = 'acknowledged',
          acknowledged_by = $1,
          acknowledged_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const res = await executor.query(query, [userId, id]);
    return res.rows[0] || null;
  }

  async resolveAlert(id, userId, client = null) {
    const executor = client || db;
    const query = `
      UPDATE alerts
      SET status = 'resolved',
          resolved_by = $1,
          resolved_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const res = await executor.query(query, [userId, id]);
    return res.rows[0] || null;
  }

  async escalateAlert(id, newLevel, client = null) {
    const executor = client || db;
    const query = `
      UPDATE alerts
      SET escalation_level = $1,
          status = 'escalated'
      WHERE id = $2
      RETURNING *
    `;
    const res = await executor.query(query, [newLevel, id]);
    return res.rows[0] || null;
  }

  async findAlertsForEscalation(client = null) {
    const executor = client || db;
    const query = `
      SELECT id, severity, title, escalation_level AS "escalationLevel", created_at AS "createdAt"
      FROM alerts
      WHERE status = 'open' AND escalation_level < 3
    `;
    const res = await executor.query(query);
    return res.rows;
  }

  async getSummary(client = null) {
    const executor = client || db;
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status IN ('open', 'escalated'))::int AS open,
        COUNT(*) FILTER (WHERE status = 'acknowledged')::int AS acknowledged,
        COUNT(*) FILTER (WHERE severity = 'critical' AND status IN ('open', 'escalated'))::int AS critical,
        COUNT(*) FILTER (WHERE severity = 'high' AND status IN ('open', 'escalated'))::int AS high,
        COUNT(*) FILTER (WHERE severity = 'medium' AND status IN ('open', 'escalated'))::int AS medium,
        COUNT(*) FILTER (WHERE severity = 'low' AND status IN ('open', 'escalated'))::int AS low
      FROM alerts
    `;
    const res = await executor.query(query);
    return res.rows[0];
  }
}

module.exports = new AlertRepository();
