const otAssignmentService = require('../services/otAssignment.service');
const otCaseRepo = require('../repositories/otCase.repo');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { auditLog } = require('../middleware/audit');
const AppError = require('../utils/AppError');

const getCases = asyncHandler(async (req, res) => {
  const cases = await otCaseRepo.findAllCases(req.query);
  return ok(res, cases);
});

const getCaseById = asyncHandler(async (req, res) => {
  const otCase = await otCaseRepo.findCaseById(req.params.id);
  if (!otCase) throw new AppError('OT Case not found', 404, 'CASE_NOT_FOUND');
  return ok(res, otCase);
});

const scheduleCase = asyncHandler(async (req, res) => {
  const createdCase = await otAssignmentService.scheduleCase(req.body, req.user.id);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'SCHEDULE_OT_CASE',
    target: 'ot_cases',
    targetId: createdCase.id,
    detail: { caseNumber: createdCase.caseNumber, procedure: createdCase.procedureName },
    ip: req.ip,
  });

  return ok(res, createdCase, {}, 201);
});

const startCase = asyncHandler(async (req, res) => {
  const started = await otAssignmentService.startCase(req.params.id);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'START_OT_CASE',
    target: 'ot_cases',
    targetId: req.params.id,
    ip: req.ip,
  });

  return ok(res, started);
});

const completeCase = asyncHandler(async (req, res) => {
  const completed = await otAssignmentService.completeCase(req.params.id);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'COMPLETE_OT_CASE',
    target: 'ot_cases',
    targetId: req.params.id,
    detail: { durationMin: completed.actualDurationMin },
    ip: req.ip,
  });

  return ok(res, completed);
});

const cancelCase = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const cancelled = await otAssignmentService.cancelCase(req.params.id, reason);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'CANCEL_OT_CASE',
    target: 'ot_cases',
    targetId: req.params.id,
    detail: { reason },
    ip: req.ip,
  });

  return ok(res, cancelled);
});

const delayCase = asyncHandler(async (req, res) => {
  const { delayMinutes, reason } = req.body;
  const delayed = await otAssignmentService.delayCase(req.params.id, delayMinutes, reason);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'DELAY_OT_CASE',
    target: 'ot_cases',
    targetId: req.params.id,
    detail: { delayMinutes, reason },
    ip: req.ip,
  });

  return ok(res, delayed);
});

const emergencyInsert = asyncHandler(async (req, res) => {
  const emergencyCase = await otAssignmentService.emergencyInsert(
    req.params.id,
    req.body,
    req.user.id
  );

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'EMERGENCY_INSERT_OT_CASE',
    target: 'ot_cases',
    targetId: emergencyCase.id,
    detail: { displacedCaseId: req.params.id, procedure: req.body.procedureName },
    ip: req.ip,
  });

  return ok(res, emergencyCase, {}, 201);
});

const assignDoctorToCase = asyncHandler(async (req, res) => {
  const { doctorId, role } = req.body;
  const updatedCase = await otAssignmentService.assignDoctorToCase(
    req.params.id,
    doctorId,
    role,
    req.user.id
  );

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'ASSIGN_DOCTOR_TO_CASE',
    target: 'ot_cases',
    targetId: req.params.id,
    detail: { doctorId, role },
    ip: req.ip,
  });

  return ok(res, updatedCase);
});

const getRequests = asyncHandler(async (req, res) => {
  const requests = await otCaseRepo.findAllRequests();
  return ok(res, requests);
});

const approveRequest = asyncHandler(async (req, res) => {
  const approvedCase = await otAssignmentService.approveRequest(req.params.id, req.user.id);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'APPROVE_OT_REQUEST',
    target: 'ot_requests',
    targetId: req.params.id,
    detail: { createdCaseId: approvedCase.id },
    ip: req.ip,
  });

  return ok(res, approvedCase);
});

const rejectRequest = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const rejected = await otAssignmentService.rejectRequest(req.params.id, reason, req.user.id);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'REJECT_OT_REQUEST',
    target: 'ot_requests',
    targetId: req.params.id,
    detail: { reason },
    ip: req.ip,
  });

  return ok(res, rejected);
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await otAssignmentService.getOtStats();
  return ok(res, stats);
});

module.exports = {
  getCases,
  getCaseById,
  scheduleCase,
  startCase,
  completeCase,
  cancelCase,
  delayCase,
  emergencyInsert,
  assignDoctorToCase,
  getRequests,
  approveRequest,
  rejectRequest,
  getStats,
};
