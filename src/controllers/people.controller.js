const adminService = require('../services/admin.service');
const patientService = require('../services/patient.service');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const getPeopleSummary = asyncHandler(async (req, res) => {
  const summary = await adminService.getPeopleSummary();
  return ok(res, summary);
});

const getPeoplePatients = asyncHandler(async (req, res) => {
  const result = await patientService.getAllPatients(req.query);
  return ok(res, result.patients, {
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  });
});

const getPeoplePatientById = asyncHandler(async (req, res) => {
  const patient = await patientService.getPatientById(req.params.id);
  return ok(res, patient);
});

const getPeopleDoctors = asyncHandler(async (req, res) => {
  const doctors = await adminService.getAllDoctors(req.query);
  return ok(res, doctors);
});

const getPeopleDoctorById = asyncHandler(async (req, res) => {
  const doctor = await adminService.getDoctorById(req.params.id);
  const stats = await adminService.getDoctorStats(req.params.id);
  return ok(res, { ...doctor, stats });
});

module.exports = {
  getPeopleSummary,
  getPeoplePatients,
  getPeoplePatientById,
  getPeopleDoctors,
  getPeopleDoctorById,
};
