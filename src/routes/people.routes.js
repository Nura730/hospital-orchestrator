const { Router } = require('express');
const peopleController = require('../controllers/people.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

router.use(auth, authorize('admin'));

router.get('/summary', peopleController.getPeopleSummary);
router.get('/patients', peopleController.getPeoplePatients);
router.get('/patients/:id', peopleController.getPeoplePatientById);
router.get('/doctors', peopleController.getPeopleDoctors);
router.get('/doctors/:id', peopleController.getPeopleDoctorById);

module.exports = router;
