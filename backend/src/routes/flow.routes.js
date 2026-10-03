/**
 * Predictive Flow Intelligence routes — mounted at /api/v1/flow
 */
const { Router } = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const flow = require('../controllers/flow.controller');

const router = Router();

router.use(auth);

// Phase 1 — event intake (any authenticated user)
router.post('/event', flow.postEvent);

// Phase 2 — predictions
router.get('/forecast', flow.getForecast);
router.get('/bed-demand', flow.getBedDemand);
router.get('/discharge-candidates', authorize('admin', 'nurse_manager', 'doctor'), flow.getDischargeCandidates);
router.get('/admission-probability/:patientId', authorize('doctor', 'admin'), flow.getAdmissionProbability);
router.get('/los/:patientId', authorize('doctor', 'admin'), flow.getLos);

// Phase 3 — bottlenecks, live state, bed map, numbers-first dashboards
router.get('/bottlenecks', flow.getBottlenecks);
router.get('/state-summary', flow.getStateSummary);
router.get('/bed-map', flow.getBedMap);
router.get('/dashboard-numbers', flow.getDashboardNumbers);
router.get('/config', flow.getConfig);

// Phase 4 — what-if simulator
router.post('/simulate', authorize('admin'), flow.postSimulate);
router.get('/simulations/history', authorize('admin'), flow.getSimulationHistory);
router.post('/simulations/:id/apply', authorize('admin'), flow.applySimulation);

// Workflow actions
router.get('/recommendations', flow.listRecommendations);
router.post('/recommendations/batch', authorize('admin', 'ot_manager'), flow.postRecommendationBatch);
router.patch('/recommendations/:id', authorize('admin'), flow.patchRecommendation);
router.post('/discharge/nudge', authorize('admin'), flow.postDischargeNudge);
router.post('/discharge/:patientId/mark-ready', authorize('admin', 'doctor'), flow.postMarkReady);
router.get('/beds/about-to-free', flow.getBedsAboutToFree);
router.post('/beds/:bedId/pre-assign', authorize('admin'), flow.postPreAssign);
router.get('/waiting-patients', flow.getWaitingPatients);
router.get('/ot-impact', authorize('admin', 'ot_manager'), flow.getOtImpact);
router.get('/doctor/patients', authorize('doctor', 'admin'), flow.getDoctorPatients);
router.get('/staff-roster', flow.getStaffRoster);
router.get('/housekeeping', flow.getHousekeeping);
router.get('/audit', authorize('admin'), flow.getAudit);

// Phase 9 — AI report + demo controls
router.post('/ai-report', authorize('admin', 'doctor', 'ot_manager'), flow.postAiReport);
router.post('/demo/reset', authorize('admin'), flow.postDemoReset);
router.post('/demo/ambulance', authorize('admin'), flow.postDemoAmbulance);
router.post('/demo/surge', authorize('admin'), flow.postDemoSurge);

module.exports = router;
