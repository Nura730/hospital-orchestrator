/**
 * @file alerts.js
 * Mock handlers for hospital operational alerts and acknowledge/resolve workflows.
 */

import { hospitalState } from './seed.js';
import { ALERT_STATUS, ALERT_SEVERITY } from '../../utils/constants.js';

/**
 * Get alerts with optional filters.
 */
export function mockGetAlerts(params = {}) {
  const { severity, status, department } = params;
  let list = [...hospitalState.alerts];

  if (severity && severity !== 'all') {
    list = list.filter((a) => a.severity.toLowerCase() === severity.toLowerCase());
  }

  if (status && status !== 'all') {
    list = list.filter((a) => a.status.toLowerCase() === status.toLowerCase());
  }

  if (department && department !== 'all') {
    list = list.filter((a) => a.department.toLowerCase() === department.toLowerCase());
  }

  // Sort: Critical first, then newest
  const severityRank = {
    [ALERT_SEVERITY.CRITICAL]: 4,
    [ALERT_SEVERITY.HIGH]: 3,
    [ALERT_SEVERITY.MEDIUM]: 2,
    [ALERT_SEVERITY.LOW]: 1,
  };

  return list.sort((a, b) => {
    const sDiff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
    if (sDiff !== 0) return sDiff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

/**
 * Acknowledge an alert.
 */
export function mockAcknowledgeAlert(id) {
  const alert = hospitalState.alerts.find((a) => a.id === id);
  if (!alert) throw new Error(`Alert ${id} not found`);

  alert.status = ALERT_STATUS.ACKNOWLEDGED;
  alert.updatedAt = new Date().toISOString();

  hospitalState.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userName: 'Duty Administrator',
    userRole: 'admin',
    action: 'ALERT_ACKNOWLEDGED',
    details: `Acknowledged alert ${alert.id}: ${alert.title}`,
    ip: '127.0.0.1',
  });

  return alert;
}

/**
 * Resolve an alert.
 */
export function mockResolveAlert(id) {
  const alert = hospitalState.alerts.find((a) => a.id === id);
  if (!alert) throw new Error(`Alert ${id} not found`);

  alert.status = ALERT_STATUS.RESOLVED;
  alert.updatedAt = new Date().toISOString();

  hospitalState.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userName: 'Duty Administrator',
    userRole: 'admin',
    action: 'ALERT_RESOLVED',
    details: `Resolved alert ${alert.id}: ${alert.title}`,
    ip: '127.0.0.1',
  });

  return alert;
}

/**
 * Get daily alert statistics for the Alerts by Severity per Day chart.
 */
export function mockGetAlertStats() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
  return {
    labels: days,
    datasets: [
      {
        label: 'Critical',
        data: [2, 1, 3, 2, 4, 1, hospitalState.alerts.filter((a) => a.severity === ALERT_SEVERITY.CRITICAL).length],
        color: 'danger',
      },
      {
        label: 'High',
        data: [5, 4, 6, 7, 5, 3, hospitalState.alerts.filter((a) => a.severity === ALERT_SEVERITY.HIGH).length],
        color: 'warning',
      },
      {
        label: 'Medium',
        data: [8, 10, 7, 9, 8, 6, hospitalState.alerts.filter((a) => a.severity === ALERT_SEVERITY.MEDIUM).length],
        color: 'info',
      },
      {
        label: 'Low',
        data: [4, 6, 5, 4, 3, 2, hospitalState.alerts.filter((a) => a.severity === ALERT_SEVERITY.LOW).length],
        color: 'success',
      },
    ],
  };
}
