const BaseRepository = require('./base.repo');
const db = require('../config/db');

class NotificationRepository extends BaseRepository {
  constructor() {
    super('notifications');
  }

  async findUserNotifications(userId, isRead = null, limit = 20, offset = 0, client = null) {
    const executor = client || db;
    const conditions = ['user_id = $1'];
    const values = [userId];

    if (isRead !== null) {
      values.push(isRead);
      conditions.push(`is_read = $${values.length}`);
    }

    values.push(limit);
    const limitIdx = values.length;
    values.push(offset);
    const offsetIdx = values.length;

    const query = `
      SELECT
        id,
        user_id AS "userId",
        type,
        title,
        message,
        related_id AS "relatedId",
        is_read AS "isRead",
        created_at AS "createdAt"
      FROM notifications
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;
    const res = await executor.query(query, values);
    return res.rows;
  }

  async countUnread(userId, client = null) {
    const executor = client || db;
    const res = await executor.query(
      `SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return res.rows[0]?.unread || 0;
  }

  async createNotification(data, client = null) {
    const executor = client || db;
    const query = `
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const res = await executor.query(query, [
      data.userId,
      data.type,
      data.title,
      data.message,
      data.relatedId || null,
    ]);
    return res.rows[0];
  }

  async markAsRead(notificationId, userId, client = null) {
    const executor = client || db;
    const res = await executor.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *`,
      [notificationId, userId]
    );
    return res.rows[0] || null;
  }

  async markAllAsRead(userId, client = null) {
    const executor = client || db;
    const res = await executor.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return res.rowCount;
  }

  async deleteNotification(notificationId, userId, client = null) {
    const executor = client || db;
    const res = await executor.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
      [notificationId, userId]
    );
    return res.rows[0] || null;
  }
}

module.exports = new NotificationRepository();
