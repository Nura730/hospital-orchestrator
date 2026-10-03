const db = require('../config/db');
const logger = require('../utils/logger');

/**
 * Persist an audit event into audit_log
 * @param {object} params
 * @param {string} [params.userId]
 * @param {string} [params.username]
 * @param {string} [params.userType]
 * @param {string} params.action
 * @param {string} [params.target]
 * @param {string} [params.targetId]
 * @param {object} [params.detail]
 * @param {string} [params.ip]
 */
async function auditLog({
  userId = null,
  username = null,
  userType = null,
  action,
  target = null,
  targetId = null,
  detail = {},
  ip = null,
}) {
  try {
    await db.query(
      `INSERT INTO audit_log (user_id, username, user_type, action, target, target_id, detail, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        username,
        userType,
        action,
        target,
        targetId ? String(targetId) : null,
        detail ? JSON.stringify(detail) : null,
        ip,
      ]
    );
  } catch (err) {
    // Non-blocking: never crash core operation if audit logging fails, but log error
    logger.error({ err, action, target, targetId }, 'Failed to record audit log entry');
  }
}

/**
 * Express middleware helper to automatically audit an endpoint call upon completion
 * @param {string} action
 * @param {string} [target]
 * @param {Function} [detailGetter]
 */
function auditMiddleware(action, target = null, detailGetter = null) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        const detail = typeof detailGetter === 'function' ? detailGetter(req, res) : req.body;
        const targetId = req.params?.id || null;
        auditLog({
          userId: req.user?.id || null,
          username: req.user?.fullName || req.user?.email || null,
          userType: req.user?.userType || null,
          action,
          target,
          targetId,
          detail,
          ip: req.ip,
        });
      }
    });
    next();
  };
}

module.exports = {
  auditLog,
  auditMiddleware,
};
