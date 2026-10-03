const { Router } = require('express');
const doctorDashboardController = require('../controllers/doctorDashboard.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

router.use(auth, authorize('doctor'));

router.get('/dashboard', doctorDashboardController.getDashboard);

module.exports = router;
