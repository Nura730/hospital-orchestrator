const { Router } = require('express');
const equipmentController = require('../controllers/equipment.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

router.use(auth);

// Viewable by all authenticated staff
router.get('/', equipmentController.getAllEquipment);
router.get('/:id', equipmentController.getEquipmentById);

// Status updates restricted to admin and ot_manager
router.patch('/:id/status', authorize('admin', 'ot_manager'), equipmentController.updateStatus);

module.exports = router;
