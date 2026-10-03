/**
 * @file Role-based access control matrix.
 * Defines which routes and actions each role can access.
 */

/* ── Role Definitions ───────────────────────────────────────────── */
export const ROLES = {
  ADMIN:         'admin',
  BED_MANAGER:   'bed_manager',
  NURSE_MANAGER: 'nurse_manager',
  DOCTOR:        'doctor',
};

/* ── Route Access Matrix ────────────────────────────────────────── */
/**
 * Maps roles to the routes they can access.
 * Routes not listed here are hidden from that role's navigation.
 */
export const ROLE_ROUTES = {
  [ROLES.ADMIN]: [
    '/',
    '/digital-twin',
    '/beds',
    '/staff',
    '/equipment',
    '/recommendations',
    '/simulator',
    '/alerts',
    '/analytics',
    '/audit',
    '/m',
  ],
  [ROLES.BED_MANAGER]: [
    '/',
    '/digital-twin',
    '/beds',
    '/staff',
    '/equipment',
    '/recommendations',
    '/simulator',
    '/alerts',
    '/analytics',
    '/m',
    // NO /audit
  ],
  [ROLES.NURSE_MANAGER]: [
    '/',
    '/staff',
    '/alerts',
    '/digital-twin',
    '/beds',
    '/equipment',
    '/recommendations',
    '/analytics',
    '/m',
  ],
  [ROLES.DOCTOR]: [
    '/',
    '/beds',
    '/recommendations',
    '/m',
  ],
};

/* ── Action Permissions ─────────────────────────────────────────── */
/**
 * Maps roles to the actions they can perform.
 */
export const ROLE_ACTIONS = {
  [ROLES.ADMIN]: [
    'approve',
    'reject',
    'acknowledge_alert',
    'resolve_alert',
    'edit_bed',
    'transfer_patient',
    'manage_staff',
    'manage_equipment',
    'run_simulation',
    'change_autonomy',
    'export_audit',
    'view_audit',
  ],
  [ROLES.BED_MANAGER]: [
    'approve',
    'reject',
    'acknowledge_alert',
    'resolve_alert',
    'edit_bed',
    'transfer_patient',
    'manage_equipment',
    'run_simulation',
    'change_autonomy',
  ],
  [ROLES.NURSE_MANAGER]: [
    'acknowledge_alert',
    'resolve_alert',
    'manage_staff',
    // read-only for beds, equipment, recommendations
  ],
  [ROLES.DOCTOR]: [
    // read-only access
  ],
};

/* ── Helpers ────────────────────────────────────────────────────── */

/**
 * Check if a role can access a given route path.
 * @param {string} role - One of ROLES values
 * @param {string} path - Route path like '/beds'
 * @returns {boolean}
 */
export function canAccessRoute(role, path) {
  if (!role || !ROLE_ROUTES[role]) return false;
  return ROLE_ROUTES[role].includes(path);
}

/**
 * Check if a role can perform a given action.
 * @param {string} role - One of ROLES values
 * @param {string} action - Action key like 'approve'
 * @returns {boolean}
 */
export function canPerformAction(role, action) {
  if (!role || !ROLE_ACTIONS[role]) return false;
  return ROLE_ACTIONS[role].includes(action);
}

/**
 * Get allowed routes for a role (used for nav filtering).
 * @param {string} role
 * @returns {string[]}
 */
export function getRoutesForRole(role) {
  return ROLE_ROUTES[role] || [];
}

/**
 * Check if a route is read-only for a role.
 * Nurse managers and doctors have read-only on most pages.
 * @param {string} role
 * @param {string} path
 * @returns {boolean}
 */
export function isReadOnly(role, path) {
  if (role === ROLES.ADMIN || role === ROLES.BED_MANAGER) return false;
  if (role === ROLES.NURSE_MANAGER) {
    // Staff and Alerts are writable; everything else is read-only
    return !['/staff', '/alerts'].includes(path);
  }
  if (role === ROLES.DOCTOR) {
    return true; // everything read-only
  }
  return true;
}

/**
 * Get navigation items filtered by role.
 * Returns the nav config with hidden items removed.
 * @param {string} role
 * @returns {Array<{path: string, label: string, icon: string}>}
 */
export function getNavItemsForRole(role) {
  const allNav = [
    { path: '/',               label: 'Command Center', icon: 'LayoutDashboard' },
    { path: '/digital-twin',   label: 'Digital Twin',   icon: 'Building2' },
    { path: '/beds',           label: 'Beds & Patients',icon: 'BedDouble' },
    { path: '/staff',          label: 'Staff & OT',     icon: 'Users' },
    { path: '/equipment',      label: 'Equipment',      icon: 'Stethoscope' },
    { path: '/recommendations',label: 'Recommendations',icon: 'Lightbulb' },
    { path: '/simulator',      label: 'Simulator',      icon: 'FlaskConical' },
    { path: '/alerts',         label: 'Alerts',         icon: 'AlertTriangle' },
    { path: '/analytics',      label: 'Analytics',      icon: 'BarChart3' },
    { path: '/audit',          label: 'Audit Log',      icon: 'ScrollText' },
  ];

  const allowed = getRoutesForRole(role);
  return allNav.filter(item => allowed.includes(item.path));
}

/* ── Role Display Names ─────────────────────────────────────────── */
export const ROLE_LABELS = {
  [ROLES.ADMIN]:         'Hospital Admin',
  [ROLES.BED_MANAGER]:   'Bed Manager',
  [ROLES.NURSE_MANAGER]: 'Nurse Manager',
  [ROLES.DOCTOR]:        'Doctor',
};
