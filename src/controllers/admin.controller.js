const adminService = require('../services/admin.service');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { auditLog } = require('../middleware/audit');

const getAllDoctors = asyncHandler(async (req, res) => {
  const doctors = await adminService.getAllDoctors(req.query);
  return ok(res, doctors);
});

const getDoctorById = asyncHandler(async (req, res) => {
  const doctor = await adminService.getDoctorById(req.params.id);
  return ok(res, doctor);
});

const createDoctor = asyncHandler(async (req, res) => {
  const doctor = await adminService.createDoctor(req.body);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'CREATE_DOCTOR',
    target: 'doctors',
    targetId: doctor.id,
    detail: { employeeId: doctor.employeeId, specialization: doctor.specialization },
    ip: req.ip,
  });

  return ok(res, doctor, {}, 201);
});

const updateDoctor = asyncHandler(async (req, res) => {
  const doctor = await adminService.updateDoctor(req.params.id, req.body);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'UPDATE_DOCTOR',
    target: 'doctors',
    targetId: req.params.id,
    detail: req.body,
    ip: req.ip,
  });

  return ok(res, doctor);
});

const updateDoctorStatus = asyncHandler(async (req, res) => {
  const doctor = await adminService.updateDoctorStatus(req.params.id, req.body.status);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'UPDATE_DOCTOR_STATUS',
    target: 'doctors',
    targetId: req.params.id,
    detail: { newStatus: req.body.status },
    ip: req.ip,
  });

  return ok(res, doctor);
});

const deactivateDoctor = asyncHandler(async (req, res) => {
  const result = await adminService.deactivateDoctor(req.params.id);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'DEACTIVATE_DOCTOR',
    target: 'doctors',
    targetId: req.params.id,
    ip: req.ip,
  });

  return ok(res, result);
});

const getDoctorSchedule = asyncHandler(async (req, res) => {
  const schedule = await adminService.getDoctorSchedule(req.params.id);
  return ok(res, schedule);
});

const getDoctorStats = asyncHandler(async (req, res) => {
  const stats = await adminService.getDoctorStats(req.params.id);
  return ok(res, stats);
});

module.exports = {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  updateDoctorStatus,
  deactivateDoctor,
  getDoctorSchedule,
  getDoctorStats,
};
