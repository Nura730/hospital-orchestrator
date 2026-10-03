/**
 * @file Role-based access control matrix.
 * MediOrchestra has three logins, matching the backend user types: Admin, Doctor, OT Manager.
 */

/* ── Role Definitions ───────────────────────────────────────────── */
export const ROLES = {
  ADMIN:      'admin',
  DOCTOR:     'doctor',
  OT_MANAGER: 'ot_manager',
};

/* ── Predictive Flow Intelligence routes per role ───────────────── */
export const FLOW_ROUTES = {
  admin: [
    '/admin/dashboard',
    '/admin/flow/command-center',
    '/admin/flow/bottlenecks',
    '/admin/flow/simulator',
    '/admin/flow/discharge-planner',
    '/admin/beds-overview',
    '/admin/flow/staff',
    '/admin/flow/housekeeping',
    '/admin/flow/audit',
  ],
  doctor: ['/doctor/dashboard', '/doctor/flow/predictions'],
  ot_manager: ['/ot/dashboard', '/ot/flow/impact'],
};

/** Landing page after login for each role. */
export const ROLE_HOME = {
  admin: '/admin/dashboard',
  doctor: '/doctor/dashboard',
  ot_manager: '/ot/dashboard',
};

/* ── Route Access Matrix ────────────────────────────────────────── */
export const ROLE_ROUTES = {
  [ROLES.ADMIN]: ['/', ...FLOW_ROUTES.admin],
  [ROLES.DOCTOR]: ['/', ...FLOW_ROUTES.doctor],
  [ROLES.OT_MANAGER]: ['/', ...FLOW_ROUTES.ot_manager],
};

/* ── Action Permissions ─────────────────────────────────────────── */
export const ROLE_ACTIONS = {
  [ROLES.ADMIN]: ['approve', 'reject', 'acknowledge_alert', 'resolve_alert', 'edit_bed', 'run_simulation', 'view_audit', 'export_audit'],
  [ROLES.DOCTOR]: ['sign_discharge', 'request_ot', 'update_patient'],
  [ROLES.OT_MANAGER]: ['complete_case', 'defer_case', 'acknowledge_alert'],
};

/* ── Helpers ────────────────────────────────────────────────────── */

export function canAccessRoute(role, path) {
  if (!role || !ROLE_ROUTES[role]) return false;
  return ROLE_ROUTES[role].includes(path);
}

export function canPerformAction(role, action) {
  if (!role || !ROLE_ACTIONS[role]) return false;
  return ROLE_ACTIONS[role].includes(action);
}

export function getRoutesForRole(role) {
  return ROLE_ROUTES[role] || [];
}

export function isReadOnly(role) {
  return role !== ROLES.ADMIN;
}

/* ── Role Display Names ─────────────────────────────────────────── */
export const ROLE_LABELS = {
  [ROLES.ADMIN]:      'Hospital Admin',
  [ROLES.DOCTOR]:     'Doctor',
  [ROLES.OT_MANAGER]: 'OT Manager',
};

/* ── Default Users for Demo Authentication ──────────────────────── */
// backendEmail / demoPassword are the accounts created by `npm run db:seed`.
export const DEFAULT_USERS = {
  admin: {
    id: 'usr-admin',
    name: 'Dr. Sarah Jenkins',
    email: 'admin@hospital.com',
    role: ROLES.ADMIN,
    department: 'Operations Command',
    backendEmail: 'admin@hospital.com',
    demoPassword: 'Admin@1234',
  },
  doctor: {
    id: 'usr-doctor',
    name: 'Dr. Vikram Seth',
    email: 'vikram.seth@hospital.com',
    role: ROLES.DOCTOR,
    department: 'General Ward',
    backendEmail: 'vikram.seth@hospital.com',
    demoPassword: 'Doctor@1234',
  },
  ot_manager: {
    id: 'usr-ot-mgr',
    name: 'OT Manager',
    email: 'otmanager1@hospital.com',
    role: ROLES.OT_MANAGER,
    department: 'Operating Theatres',
    backendEmail: 'otmanager1@hospital.com',
    demoPassword: 'OTManager@1234',
  },
};

export const ROLE_CONFIG = {
  [ROLES.ADMIN]: { label: 'Hospital Admin', color: 'primary' },
  [ROLES.DOCTOR]: { label: 'Doctor / Surgeon', color: 'success' },
  [ROLES.OT_MANAGER]: { label: 'OT Manager', color: 'info' },
};

export function can(role, action) {
  return canPerformAction(role, action);
}

export function isRouteAllowed(role, path) {
  if (!role || !path) return false;
  if (path === '/' || path === '/404') return true;
  return canAccessRoute(role, path);
}

export function getAllowedRoutes(role) {
  return getRoutesForRole(role);
}
