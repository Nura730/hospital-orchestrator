const { Router } = require('express');
const alertController = require('../controllers/alert.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

router.use(auth);

// Summary & list accessible to staff
router.get('/summary', alertController.getSummary);
router.get('/', alertController.getAllAlerts);

// Creation restricted to admin
router.post('/', authorize('admin'), alertController.createAlert);

// Acknowledge allowed by admin, ot_manager, or doctor
router.patch('/:id/acknowledge', alertController.acknowledgeAlert);

// Resolve allowed by admin or ot_manager
router.patch('/:id/resolve', authorize('admin', 'ot_manager'), alertController.resolveAlert);

module.exports = router;
