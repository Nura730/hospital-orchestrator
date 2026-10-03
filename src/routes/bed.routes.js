const { Router } = require('express');
const bedController = require('../controllers/bed.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { updateBedStatusSchema } = require('../validators/bed.validator');

const router = Router();

// Bed viewing allowed for admin, ot_manager, and doctor (read-only)
router.use(auth);

router.get('/available', bedController.getAvailableBeds);
router.get('/heatmap', bedController.getBedHeatmap);
router.get('/', bedController.getAllBeds);
router.get('/:id', bedController.getBedById);

// Status updates restricted to admin
router.patch(
  '/:id/status',
  authorize('admin'),
  validate(updateBedStatusSchema),
  bedController.updateBedStatus
);

module.exports = router;
