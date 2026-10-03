const patientService = require('../services/patient.service');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { auditLog } = require('../middleware/audit');

const getAllPatients = asyncHandler(async (req, res) => {
  const result = await patientService.getAllPatients(req.query);
  return ok(res, result.patients, {
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  });
});

const getPatientById = asyncHandler(async (req, res) => {
  const patient = await patientService.getPatientById(req.params.id);
  return ok(res, patient);
});

const registerPatient = asyncHandler(async (req, res) => {
  const patient = await patientService.registerPatient(req.body);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'REGISTER_PATIENT',
    target: 'patients',
    targetId: patient.id,
    detail: { patientId: patient.patientId, acuity: patient.acuity },
    ip: req.ip,
  });

  return ok(res, patient, {}, 201);
});

const updatePatient = asyncHandler(async (req, res) => {
  const patient = await patientService.updatePatient(req.params.id, req.body);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'UPDATE_PATIENT',
    target: 'patients',
    targetId: req.params.id,
    detail: req.body,
    ip: req.ip,
  });

  return ok(res, patient);
});

const updatePatientStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const patient = await patientService.updatePatientStatus(
    req.params.id,
    status,
    note,
    req.user.id
  );

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'UPDATE_PATIENT_STATUS',
    target: 'patients',
    targetId: req.params.id,
    detail: { newStatus: status, note },
    ip: req.ip,
  });

  return ok(res, patient);
});

const assignDoctor = asyncHandler(async (req, res) => {
  const { doctorId } = req.body;
  const patient = await patientService.assignDoctor(req.params.id, doctorId);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'ASSIGN_DOCTOR_TO_PATIENT',
    target: 'patients',
    targetId: req.params.id,
    detail: { doctorId },
    ip: req.ip,
  });

  return ok(res, patient);
});

const assignBed = asyncHandler(async (req, res) => {
  const { bedId } = req.body;
  const patient = await patientService.assignBed(req.params.id, bedId);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'ASSIGN_BED_TO_PATIENT',
    target: 'patients',
    targetId: req.params.id,
    detail: { bedId },
    ip: req.ip,
  });

  return ok(res, patient);
});

const dischargePatient = asyncHandler(async (req, res) => {
  const result = await patientService.dischargePatient(req.params.id);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'DISCHARGE_PATIENT',
    target: 'patients',
    targetId: req.params.id,
    ip: req.ip,
  });

  return ok(res, result);
});

module.exports = {
  getAllPatients,
  getPatientById,
  registerPatient,
  updatePatient,
  updatePatientStatus,
  assignDoctor,
  assignBed,
  dischargePatient,
};
