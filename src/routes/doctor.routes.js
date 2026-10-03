const { Router } = require('express');
const doctorController = require('../controllers/doctor.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { updateDoctorStatusSchema } = require('../validators/doctor.validator');
const { updatePatientStatusSchema } = require('../validators/patient.validator');

const router = Router();

router.use(auth, authorize('doctor'));

// Patients assigned to this doctor
router.get('/my-patients', doctorController.getMyPatients);
router.get('/my-patients/:id', doctorController.getMyPatientById);
router.patch(
  '/my-patients/:id/status',
  validate(updatePatientStatusSchema),
  doctorController.updatePatientStatus
);
router.patch('/my-patients/:id/notes', doctorController.updatePatientNotes);

// Schedule and OT cases
router.get('/my-schedule', doctorController.getMySchedule);
router.get('/my-ot-cases', doctorController.getMyOtCases);
router.get('/my-stats', doctorController.getMyStats);

// OT requests
router.post('/ot-requests', doctorController.createOtRequest);
router.get('/ot-requests', doctorController.getMyOtRequests);

// Self availability status
router.get('/availability', doctorController.getAvailability);
router.patch('/status', validate(updateDoctorStatusSchema), doctorController.updateStatus);

// Personal notifications
router.get('/notifications', doctorController.getMyNotifications);
router.patch('/notifications/read-all', doctorController.markAllNotificationsRead);
router.patch('/notifications/:id/read', doctorController.markNotificationRead);

module.exports = router;
