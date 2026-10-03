const { Router } = require('express');
const otAvailabilityController = require('../controllers/otAvailability.controller');
const otController = require('../controllers/ot.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  scheduleCaseSchema,
  delayCaseSchema,
  cancelCaseSchema,
  emergencyInsertSchema,
  assignDoctorToCaseSchema,
  rejectRequestSchema,
} = require('../validators/ot.validator');

const router = Router();

// Base authentication required for all /ot routes
router.use(auth);

// --- READ-ONLY SUBSET ACCESSIBLE BY DOCTORS, OT MANAGERS, AND ADMINS ---
router.get(
  '/available-now',
  authorize('admin', 'ot_manager', 'doctor'),
  otAvailabilityController.getAvailableNow
);
router.get('/rooms', authorize('admin', 'ot_manager', 'doctor'), otAvailabilityController.getRooms);
router.get(
  '/rooms/:id',
  authorize('admin', 'ot_manager', 'doctor'),
  otAvailabilityController.getRoomById
);
router.get(
  '/timeline',
  authorize('admin', 'ot_manager', 'doctor'),
  otAvailabilityController.getTimeline
);

// --- OT MANAGEMENT AND ASSIGNMENT (ADMIN & OT MANAGER ONLY) ---
router.use(authorize('admin', 'ot_manager'));

// Available surgeons query
router.get('/available-doctors', otAvailabilityController.getAvailableDoctors);

// Cleaning status
router.get('/rooms/:id/cleaning-done', otAvailabilityController.markCleaningDone);

// OT Stats
router.get('/stats', otController.getStats);

// Cases CRUD & State transitions
router.get('/cases', otController.getCases);
router.get('/cases/:id', otController.getCaseById);
router.post('/cases', validate(scheduleCaseSchema), otController.scheduleCase);
router.patch('/cases/:id/start', otController.startCase);
router.patch('/cases/:id/complete', otController.completeCase);
router.patch('/cases/:id/cancel', validate(cancelCaseSchema), otController.cancelCase);
router.patch('/cases/:id/delay', validate(delayCaseSchema), otController.delayCase);
router.post(
  '/cases/:id/emergency-insert',
  validate(emergencyInsertSchema),
  otController.emergencyInsert
);
router.patch(
  '/cases/:id/assign-doctor',
  validate(assignDoctorToCaseSchema),
  otController.assignDoctorToCase
);

// OT Requests management
router.get('/requests', otController.getRequests);
router.patch('/requests/:id/approve', otController.approveRequest);
router.patch('/requests/:id/reject', validate(rejectRequestSchema), otController.rejectRequest);

module.exports = router;
