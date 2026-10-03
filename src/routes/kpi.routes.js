const { Router } = require('express');
const kpiController = require('../controllers/kpi.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

router.use(auth, authorize('admin', 'ot_manager'));

router.get('/current', kpiController.getCurrentKpis);
router.get('/history', kpiController.getKpiHistory);
router.get('/ot-analytics', kpiController.getOtAnalytics);

module.exports = router;
