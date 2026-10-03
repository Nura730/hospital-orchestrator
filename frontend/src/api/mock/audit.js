/**
 * @file audit.js
 * Mock handlers for hospital compliance and audit logs (admin only).
 */

import { hospitalState } from './seed.js';

/**
 * Get audit logs with filters and pagination.
 */
export function mockGetAuditLogs(params = {}) {
  const { userRole, action, search, page = 1, limit = 20 } = params;
  let list = [...hospitalState.auditLogs];

  if (userRole && userRole !== 'all') {
    list = list.filter((a) => a.userRole.toLowerCase() === userRole.toLowerCase());
  }

  if (action && action !== 'all') {
    list = list.filter((a) => a.action.toLowerCase() === action.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (a) =>
        a.userName.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q) ||
        a.details.toLowerCase().includes(q)
    );
  }

  const total = list.length;
  const start = (Number(page) - 1) * Number(limit);
  const paginated = list.slice(start, start + Number(limit));

  return {
    data: paginated,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)) || 1,
    },
  };
}
