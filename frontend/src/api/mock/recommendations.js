/**
 * @file recommendations.js
 * Mock handlers for AI operational recommendations, autonomy mode switches, and approvals.
 */

import { hospitalState } from './seed.js';
import { RECOMMENDATION_STATUS, AUTONOMY_MODES } from '../../utils/constants.js';

/**
 * Get recommendations filtered by status or type.
 */
export function mockGetRecommendations(params = {}) {
  const { status, type } = params;
  let list = [...hospitalState.recommendations];

  if (status && status !== 'all') {
    list = list.filter((r) => r.status.toLowerCase() === status.toLowerCase());
  }

  if (type && type !== 'all') {
    list = list.filter((r) => r.type.toLowerCase() === type.toLowerCase());
  }

  return list;
}

/**
 * Approve a recommendation and optimistically trigger its action.
 */
export function mockApproveRecommendation(id) {
  const rec = hospitalState.recommendations.find((r) => r.id === id);
  if (!rec) throw new Error(`Recommendation ${id} not found`);

  rec.status = RECOMMENDATION_STATUS.APPROVED;
  rec.executedAt = new Date().toISOString();

  // Record audit
  hospitalState.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userName: 'Clinical Operations Director',
    userRole: 'admin',
    action: 'RECOMMENDATION_APPROVED',
    details: `Approved recommendation ${rec.id}: ${rec.title}`,
    ip: '127.0.0.1',
  });

  return rec;
}

/**
 * Reject a recommendation with required reason.
 */
export function mockRejectRecommendation(id, reason = 'Clinical discretion') {
  const rec = hospitalState.recommendations.find((r) => r.id === id);
  if (!rec) throw new Error(`Recommendation ${id} not found`);

  rec.status = RECOMMENDATION_STATUS.REJECTED;
  rec.rejectedAt = new Date().toISOString();
  rec.rejectionReason = reason;

  hospitalState.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userName: 'Attending Physician',
    userRole: 'doctor',
    action: 'RECOMMENDATION_REJECTED',
    details: `Rejected recommendation ${rec.id} (${rec.title}). Reason: ${reason}`,
    ip: '127.0.0.1',
  });

  return rec;
}

/**
 * Get current autonomy mode.
 */
export function mockGetAutonomyMode() {
  return {
    mode: hospitalState.autonomyMode || AUTONOMY_MODES.APPROVAL,
    allowedRoles: ['admin', 'bed_manager'],
    lastChangedAt: new Date(Date.now() - 3600000).toISOString(),
  };
}

/**
 * Set autonomy mode (Advisory | Approval | Auto).
 */
export function mockSetAutonomyMode(newMode) {
  if (!Object.values(AUTONOMY_MODES).includes(newMode)) {
    throw new Error(`Invalid autonomy mode ${newMode}`);
  }

  hospitalState.autonomyMode = newMode;

  hospitalState.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userName: 'Hospital Administrator',
    userRole: 'admin',
    action: 'AUTONOMY_MODE_CHANGED',
    details: `Switched system AI autonomy mode to ${newMode.toUpperCase()}`,
    ip: '127.0.0.1',
  });

  return { mode: newMode };
}
