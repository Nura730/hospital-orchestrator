/**
 * @file ProtectedRoute.jsx
 * Route guard checking authentication and role-based route access permissions.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';
import { useRole } from '../../hooks/useRole.js';

export function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  const { isRouteAllowed } = useRole();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verify role permission for current path
  const currentPath = location.pathname;
  if (!isRouteAllowed(currentPath)) {
    // Redirect to Command Center default if user lacks permission for this route
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
