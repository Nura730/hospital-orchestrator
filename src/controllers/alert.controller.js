const alertService = require('../services/alert.service');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { auditLog } = require('../middleware/audit');

const getAllAlerts = asyncHandler(async (req, res) => {
  const alerts = await alertService.getAllAlerts(req.query);
  return ok(res, alerts);
});

const createAlert = asyncHandler(async (req, res) => {
  const alert = await alertService.createAlert(req.body);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'CREATE_ALERT',
    target: 'alerts',
    targetId: alert.id,
    detail: { title: alert.title, severity: alert.severity },
    ip: req.ip,
  });

  return ok(res, alert, {}, 201);
});

const acknowledgeAlert = asyncHandler(async (req, res) => {
  const alert = await alertService.acknowledgeAlert(req.params.id, req.user.id);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'ACKNOWLEDGE_ALERT',
    target: 'alerts',
    targetId: req.params.id,
    ip: req.ip,
  });

  return ok(res, alert);
});

const resolveAlert = asyncHandler(async (req, res) => {
  const alert = await alertService.resolveAlert(req.params.id, req.user.id);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'RESOLVE_ALERT',
    target: 'alerts',
    targetId: req.params.id,
    ip: req.ip,
  });

  return ok(res, alert);
});

const getSummary = asyncHandler(async (req, res) => {
  const summary = await alertService.getSummary();
  return ok(res, summary);
});

module.exports = {
  getAllAlerts,
  createAlert,
  acknowledgeAlert,
  resolveAlert,
  getSummary,
};
