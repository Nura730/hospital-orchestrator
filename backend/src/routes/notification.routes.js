const { Router } = require('express');
const notificationController = require('../controllers/notification.controller');
const auth = require('../middleware/auth');

const router = Router();

router.use(auth);

router.get('/', notificationController.getNotifications);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
