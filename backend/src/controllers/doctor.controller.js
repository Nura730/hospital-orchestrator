const doctorService = require('../services/doctor.service');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { auditLog } = require('../middleware/audit');

const getMyPatients = asyncHandler(async (req, res) => {
  const result = await doctorService.getMyPatients(req.user.id, req.query);
  return ok(res, result.patients, {
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  });
});

const getMyPatientById = asyncHandler(async (req, res) => {
  const patient = await doctorService.getMyPatientById(req.user.id, req.params.id);
  return ok(res, patient);
});

const updatePatientStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const result = await doctorService.updatePatientStatus(req.user.id, req.params.id, status, note);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'DOCTOR_UPDATE_PATIENT_STATUS',
    target: 'patients',
    targetId: req.params.id,
    detail: { status, note },
    ip: req.ip,
  });

  return ok(res, result);
});

const updatePatientNotes = asyncHandler(async (req, res) => {
  const { diagnosis, notes } = req.body;
  const result = await doctorService.updatePatientNotes(req.user.id, req.params.id, {
    diagnosis,
    notes,
  });

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'DOCTOR_UPDATE_PATIENT_NOTES',
    target: 'patients',
    targetId: req.params.id,
    detail: { diagnosis, notes },
    ip: req.ip,
  });

  return ok(res, result);
});

const getMySchedule = asyncHandler(async (req, res) => {
  const schedule = await doctorService.getMySchedule(req.user.id);
  return ok(res, schedule);
});

const getMyOtCases = asyncHandler(async (req, res) => {
  const cases = await doctorService.getMyOtCases(req.user.id);
  return ok(res, cases);
});

const getMyStats = asyncHandler(async (req, res) => {
  const stats = await doctorService.getMyStats(req.user.id);
  return ok(res, stats);
});

const createOtRequest = asyncHandler(async (req, res) => {
  const request = await doctorService.createOtRequest(req.user.id, req.body);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'REQUEST_OT_SLOT',
    target: 'ot_requests',
    targetId: request.id,
    detail: { procedureName: req.body.procedureName, urgency: req.body.urgency },
    ip: req.ip,
  });

  return ok(res, request, {}, 201);
});

const getMyOtRequests = asyncHandler(async (req, res) => {
  const requests = await doctorService.getMyOtRequests(req.user.id);
  return ok(res, requests);
});

const getAvailability = asyncHandler(async (req, res) => {
  const avail = await doctorService.getAvailability(req.user.id);
  return ok(res, avail);
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const result = await doctorService.updateStatus(req.user.id, status);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'DOCTOR_STATUS_UPDATE',
    target: 'doctors',
    targetId: req.user.id,
    detail: { newStatus: status },
    ip: req.ip,
  });

  return ok(res, result);
});

const getMyNotifications = asyncHandler(async (req, res) => {
  const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : null;
  const notifications = await doctorService.getMyNotifications(req.user.id, isRead);
  return ok(res, notifications);
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notif = await doctorService.markNotificationRead(req.user.id, req.params.id);
  return ok(res, notif);
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await doctorService.markAllNotificationsRead(req.user.id);
  return ok(res, result);
});

module.exports = {
  getMyPatients,
  getMyPatientById,
  updatePatientStatus,
  updatePatientNotes,
  getMySchedule,
  getMyOtCases,
  getMyStats,
  createOtRequest,
  getMyOtRequests,
  getAvailability,
  updateStatus,
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
