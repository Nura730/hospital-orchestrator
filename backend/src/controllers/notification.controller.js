const notificationService = require('../services/notification.service');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const getNotifications = asyncHandler(async (req, res) => {
  const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : null;
  const notifications = await notificationService.getUserNotifications(req.user.id, isRead);
  return ok(res, notifications);
});

const markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markAsRead(req.user.id, req.params.id);
  return ok(res, notification);
});

const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllAsRead(req.user.id);
  return ok(res, result);
});

const deleteNotification = asyncHandler(async (req, res) => {
  const result = await notificationService.deleteNotification(req.user.id, req.params.id);
  return ok(res, result);
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
