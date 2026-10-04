/**
 * @file Role-based access control matrix.
 * Five logins: Admin, Doctor, OT Manager, Nurse and Patient.
 */

/* ── Role Definitions ───────────────────────────────────────────── */
export const ROLES = {
  ADMIN:      'admin',
  DOCTOR:     'doctor',
  OT_MANAGER: 'ot_manager',
  NURSE:      'nurse',
  PATIENT:    'patient',
};

/* ── Routes per role ────────────────────────────────────────────── */
// A trailing "/*" allows any sub-path (used for /patient-journey/:patientId).
export const FLOW_ROUTES = {
  admin: [
    '/admin/dashboard',
    '/admin/flow/command-center',
    '/admin/flow/bottlenecks',
    '/admin/flow/simulator',
    '/admin/flow/discharge-planner',
    '/admin/beds-overview',
    '/admin/patients',
    '/admin/nurses',
    '/admin/flow/staff',
    '/admin/flow/housekeeping',
    '/admin/flow/audit',
    '/admin/patient-journey',
    '/admin/patient-journey/*',
    '/patient-journey/*',
  ],
  doctor: ['/doctor/dashboard', '/doctor/schedule', '/doctor/patients', '/doctor/requests', '/doctor/ot-cases', '/doctor/calendar', '/doctor/notifications', '/doctor/flow/predictions', '/patient-journey/*'],
  ot_manager: ['/ot/dashboard', '/ot/requests', '/ot/surgeons', '/ot/flow/impact', '/patient-journey/*'],
  nurse: ['/nurse/dashboard', '/nurse/patients', '/nurse/tasks', '/nurse/beds', '/nurse/notifications'],
  patient: ['/patient/dashboard', '/patient/treatment', '/patient/reports', '/patient/requests', '/patient/help'],
};

/** Landing page after login for each role. */
export const ROLE_HOME = {
  admin: '/admin/dashboard',
  doctor: '/doctor/dashboard',
  ot_manager: '/ot/dashboard',
  nurse: '/nurse/dashboard',
  patient: '/patient/dashboard',
};

/* ── Route Access Matrix ────────────────────────────────────────── */
export const ROLE_ROUTES = {
  [ROLES.ADMIN]: ['/', ...FLOW_ROUTES.admin],
  [ROLES.DOCTOR]: ['/', ...FLOW_ROUTES.doctor],
  [ROLES.OT_MANAGER]: ['/', ...FLOW_ROUTES.ot_manager],
  [ROLES.NURSE]: ['/', ...FLOW_ROUTES.nurse],
  [ROLES.PATIENT]: ['/', ...FLOW_ROUTES.patient],
};

/* ── Action Permissions ─────────────────────────────────────────── */
export const ROLE_ACTIONS = {
  [ROLES.ADMIN]: ['approve', 'reject', 'acknowledge_alert', 'resolve_alert', 'edit_bed', 'run_simulation', 'view_audit', 'export_audit', 'generate_report', 'send_request'],
  [ROLES.DOCTOR]: ['sign_discharge', 'request_ot', 'update_patient', 'generate_report', 'send_request'],
  [ROLES.OT_MANAGER]: ['complete_case', 'defer_case', 'acknowledge_alert'],
  [ROLES.NURSE]: ['complete_task', 'add_note', 'alert_doctor'],
  [ROLES.PATIENT]: ['submit_request'],
};

/* ── Helpers ────────────────────────────────────────────────────── */

function matches(pattern, path) {
  if (pattern.endsWith('/*')) {
    const base = pattern.slice(0, -2);
    return path.startsWith(`${base}/`) && path.length > base.length + 1;
  }
  return pattern === path;
}

export function canAccessRoute(role, path) {
  if (!role || !ROLE_ROUTES[role]) return false;
  return ROLE_ROUTES[role].some((p) => matches(p, path));
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
  [ROLES.NURSE]:      'Nurse',
  [ROLES.PATIENT]:    'Patient',
};

/* ── Default Users for Demo Authentication ──────────────────────── */
// backendEmail / demoPassword are the accounts created by `npm run db:seed`.
// Nurse and Patient are frontend demo accounts (localOnly): the backend has no such user types yet.
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
  nurse: {
    id: 'usr-nurse',
    name: 'Nurse Priya Sharma',
    email: 'nurse@hospital.com',
    role: ROLES.NURSE,
    department: 'General Ward',
    backendEmail: 'nurse@hospital.com',
    demoPassword: 'Nurse@1234',
    localOnly: true,
  },
  patient: {
    id: 'usr-patient',
    name: 'Rahul Verma',
    email: 'patient@hospital.com',
    role: ROLES.PATIENT,
    department: 'General Ward',
    backendEmail: 'patient@hospital.com',
    demoPassword: 'Patient@1234',
    localOnly: true,
  },
};

export const ROLE_CONFIG = {
  [ROLES.ADMIN]: { label: 'Hospital Admin', color: 'primary' },
  [ROLES.DOCTOR]: { label: 'Doctor / Surgeon', color: 'success' },
  [ROLES.OT_MANAGER]: { label: 'OT Manager', color: 'info' },
  [ROLES.NURSE]: { label: 'Nurse', color: 'primary' },
  [ROLES.PATIENT]: { label: 'Patient', color: 'success' },
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

/** Accent color per role (login tabs, sidebar badge). */
export const ROLE_ACCENT = {
  [ROLES.ADMIN]: '#0F766E',
  [ROLES.DOCTOR]: '#014BAA',
  [ROLES.OT_MANAGER]: '#6D28D9',
  [ROLES.NURSE]: '#BE185D',
  [ROLES.PATIENT]: '#047857',
};
