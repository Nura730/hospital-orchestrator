const notificationRepo = require('../repositories/notification.repo');
const AppError = require('../utils/AppError');

class NotificationService {
  async getUserNotifications(userId, isRead = null) {
    return notificationRepo.findUserNotifications(userId, isRead);
  }

  async markAsRead(userId, notificationId) {
    const res = await notificationRepo.markAsRead(notificationId, userId);
    if (!res) throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    return res;
  }

  async markAllAsRead(userId) {
    const count = await notificationRepo.markAllAsRead(userId);
    return { success: true, count };
  }

  async deleteNotification(userId, notificationId) {
    const res = await notificationRepo.deleteNotification(notificationId, userId);
    if (!res) throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    return { success: true, message: 'Notification removed' };
  }
}

module.exports = new NotificationService();
