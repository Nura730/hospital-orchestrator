const alertRepo = require('../repositories/alert.repo');
const emitter = require('../sockets/emitter');
const AppError = require('../utils/AppError');

class AlertService {
  async getAllAlerts(query) {
    return alertRepo.findAll(query);
  }

  async createAlert(data) {
    const alert = await alertRepo.createAlert(data);

    emitter.emitAlertCreated({
      alertId: alert.id,
      severity: alert.severity,
      title: alert.title,
      department: alert.department_name,
    });

    return alert;
  }

  async acknowledgeAlert(id, userId) {
    const alert = await alertRepo.acknowledgeAlert(id, userId);
    if (!alert) throw new AppError('Alert not found', 404, 'ALERT_NOT_FOUND');
    return alert;
  }

  async resolveAlert(id, userId) {
    const alert = await alertRepo.resolveAlert(id, userId);
    if (!alert) throw new AppError('Alert not found', 404, 'ALERT_NOT_FOUND');
    return alert;
  }

  async getSummary() {
    return alertRepo.getSummary();
  }
}

module.exports = new AlertService();
