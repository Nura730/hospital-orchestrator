const { Router } = require('express');
const adminController = require('../controllers/admin.controller');
const patientController = require('../controllers/patient.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  createDoctorSchema,
  updateDoctorSchema,
  updateDoctorStatusSchema,
} = require('../validators/doctor.validator');
const {
  createPatientSchema,
  updatePatientSchema,
  updatePatientStatusSchema,
  assignDoctorSchema,
  assignBedSchema,
} = require('../validators/patient.validator');

const router = Router();

router.use(auth, authorize('admin'));

// --- DOCTOR MANAGEMENT ---
router.get('/doctors', adminController.getAllDoctors);
router.get('/doctors/:id', adminController.getDoctorById);
router.post('/doctors', validate(createDoctorSchema), adminController.createDoctor);
router.patch('/doctors/:id', validate(updateDoctorSchema), adminController.updateDoctor);
router.patch(
  '/doctors/:id/status',
  validate(updateDoctorStatusSchema),
  adminController.updateDoctorStatus
);
router.delete('/doctors/:id', adminController.deactivateDoctor);
router.get('/doctors/:id/schedule', adminController.getDoctorSchedule);
router.get('/doctors/:id/stats', adminController.getDoctorStats);

// --- PATIENT MANAGEMENT ---
router.get('/patients', patientController.getAllPatients);
router.get('/patients/:id', patientController.getPatientById);
router.post('/patients', validate(createPatientSchema), patientController.registerPatient);
router.patch('/patients/:id', validate(updatePatientSchema), patientController.updatePatient);
router.patch(
  '/patients/:id/status',
  validate(updatePatientStatusSchema),
  patientController.updatePatientStatus
);
router.patch(
  '/patients/:id/assign-doctor',
  validate(assignDoctorSchema),
  patientController.assignDoctor
);
router.patch('/patients/:id/assign-bed', validate(assignBedSchema), patientController.assignBed);
router.post('/patients/:id/discharge', patientController.dischargePatient);

module.exports = router;
