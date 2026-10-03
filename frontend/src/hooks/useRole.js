/**
 * @file useRole.js
 * Hook providing role-based permission checks and accessible route filtering.
 */

import { useAuthStore } from '../store/authStore.js';
import { can, getAllowedRoutes, isRouteAllowed, ROLE_CONFIG } from '../utils/roles.js';

export function useRole() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);

  return {
    user,
    role,
    roleConfig: ROLE_CONFIG[role] || ROLE_CONFIG.admin,
    isAdmin: role === 'admin',
    isDoctor: role === 'doctor',
    isBedManager: role === 'bed_manager',
    isNurseManager: role === 'nurse_manager',
    can: (action) => can(role, action),
    isRouteAllowed: (path) => isRouteAllowed(role, path),
    allowedRoutes: getAllowedRoutes(role),
  };
}

export default useRole;
