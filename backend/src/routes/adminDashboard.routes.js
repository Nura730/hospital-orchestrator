const { Router } = require('express');
const adminDashboardController = require('../controllers/adminDashboard.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

router.use(auth, authorize('admin'));

router.get('/dashboard', adminDashboardController.getDashboard);
router.get('/dashboard/live-kpis', adminDashboardController.getLiveKpis);

module.exports = router;
