/**
 * @file staff.js
 * Mock handlers for hospital staff, workload, and duty rosters.
 */

import { hospitalState } from './seed.js';
import { STAFF_STATUS, DEPARTMENTS } from '../../utils/constants.js';

/**
 * Get staff list with filters.
 */
export function mockGetStaff(params = {}) {
  const { department, role, status, search } = params;
  let list = [...hospitalState.staff];

  if (department && department !== 'all') {
    list = list.filter((s) => s.department.toLowerCase() === department.toLowerCase());
  }

  if (role && role !== 'all') {
    list = list.filter((s) => s.role.toLowerCase() === role.toLowerCase());
  }

  if (status && status !== 'all') {
    list = list.filter((s) => s.status === status);
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.employeeId.toLowerCase().includes(q)
    );
  }

  return list;
}

/**
 * Get staff member by ID.
 */
export function mockGetStaffById(id) {
  const staffMember = hospitalState.staff.find((s) => s.id === id || s.employeeId === id);
  if (!staffMember) {
    throw new Error(`Staff member ${id} not found`);
  }
  return staffMember;
}

/**
 * Update staff duty status.
 */
export function mockUpdateStaffStatus(id, newStatus) {
  const staffMember = hospitalState.staff.find((s) => s.id === id || s.employeeId === id);
  if (!staffMember) {
    throw new Error(`Staff member ${id} not found`);
  }

  staffMember.status = newStatus;
  if (newStatus === STAFF_STATUS.OFF_DUTY) {
    staffMember.workload = 0;
  }

  return staffMember;
}

/**
 * Get workload metrics for staff chart components:
 * - Workload % per staff member (top 15 highest loaded)
 * - Staff status distribution grouped by department
 */
export function mockGetStaffMetrics() {
  // Top workload for horizontal bar
  const onDutyStaff = hospitalState.staff
    .filter((s) => s.status === STAFF_STATUS.ON_DUTY || s.status === STAFF_STATUS.IN_SURGERY)
    .sort((a, b) => b.workload - a.workload)
    .slice(0, 12);

  const topWorkload = {
    names: onDutyStaff.map((s) => `${s.name.split(',')[0]} (${s.department})`),
    workloads: onDutyStaff.map((s) => s.workload),
    fatigues: onDutyStaff.map((s) => s.fatigue),
  };

  // Stacked by department
  const deptBreakdown = DEPARTMENTS.map((dept) => {
    const inDept = hospitalState.staff.filter((s) => s.department === dept);
    return {
      department: dept,
      onDuty: inDept.filter((s) => s.status === STAFF_STATUS.ON_DUTY || s.status === STAFF_STATUS.IN_SURGERY).length,
      available: inDept.filter((s) => s.status === STAFF_STATUS.AVAILABLE).length,
      onBreak: inDept.filter((s) => s.status === STAFF_STATUS.ON_BREAK).length,
      offDuty: inDept.filter((s) => s.status === STAFF_STATUS.OFF_DUTY).length,
    };
  });

  return {
    topWorkload,
    deptBreakdown,
  };
}
