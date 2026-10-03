/**
 * @file equipment.js
 * Mock handlers for biomedical equipment tracking.
 */

import { hospitalState } from './seed.js';
import { EQUIPMENT_STATUS } from '../../utils/constants.js';

/**
 * Get equipment list with filters.
 */
export function mockGetEquipment(params = {}) {
  const { department, type, status, search } = params;
  let list = [...hospitalState.equipment];

  if (department && department !== 'all') {
    list = list.filter((e) => e.department.toLowerCase() === department.toLowerCase());
  }

  if (type && type !== 'all') {
    list = list.filter((e) => e.type.toLowerCase() === type.toLowerCase());
  }

  if (status && status !== 'all') {
    list = list.filter((e) => e.status === status);
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.assetTag.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.model.toLowerCase().includes(q)
    );
  }

  return list;
}

/**
 * Get equipment by ID with inspection and telemetry history.
 */
export function mockGetEquipmentById(id) {
  const eq = hospitalState.equipment.find((e) => e.id === id || e.assetTag === id);
  if (!eq) {
    throw new Error(`Equipment ${id} not found`);
  }

  // Generate synthetic telemetry history
  const history = [
    { timestamp: new Date(Date.now() - 3600000).toISOString(), battery: eq.batteryPercentage, state: eq.status },
    { timestamp: new Date(Date.now() - 7200000).toISOString(), battery: Math.min(100, eq.batteryPercentage + 3), state: eq.status },
    { timestamp: new Date(Date.now() - 10800000).toISOString(), battery: Math.min(100, eq.batteryPercentage + 6), state: eq.status },
  ];

  return {
    ...eq,
    telemetryHistory: history,
  };
}

/**
 * Update equipment status.
 */
export function mockUpdateEquipmentStatus(id, newStatus) {
  const eq = hospitalState.equipment.find((e) => e.id === id || e.assetTag === id);
  if (!eq) {
    throw new Error(`Equipment ${id} not found`);
  }

  eq.status = newStatus;
  eq.isWarning = eq.batteryPercentage <= 20 || newStatus === EQUIPMENT_STATUS.MAINTENANCE;

  hospitalState.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userName: 'Biomedical Tech',
    userRole: 'admin',
    action: 'EQUIPMENT_STATUS_CHANGED',
    details: `Updated equipment ${eq.assetTag} (${eq.name}) to ${newStatus}`,
    ip: '127.0.0.1',
  });

  return eq;
}

/**
 * Get status mix for Equipment doughnut chart.
 */
export function mockGetEquipmentStatusMix() {
  const counts = {
    [EQUIPMENT_STATUS.AVAILABLE]: 0,
    [EQUIPMENT_STATUS.IN_USE]: 0,
    [EQUIPMENT_STATUS.MAINTENANCE]: 0,
    [EQUIPMENT_STATUS.OFFLINE]: 0,
  };

  hospitalState.equipment.forEach((e) => {
    if (counts[e.status] !== undefined) {
      counts[e.status]++;
    }
  });

  return {
    labels: ['Available', 'In Use', 'Maintenance', 'Offline'],
    counts: [
      counts[EQUIPMENT_STATUS.AVAILABLE],
      counts[EQUIPMENT_STATUS.IN_USE],
      counts[EQUIPMENT_STATUS.MAINTENANCE],
      counts[EQUIPMENT_STATUS.OFFLINE],
    ],
    total: hospitalState.equipment.length,
  };
}
