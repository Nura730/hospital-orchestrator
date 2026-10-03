/**
 * @file App.jsx
 * Root application component: code-split routes for the three roles (Admin, Doctor, OT Manager),
 * AppShell layout, role-guarded routes and global toast notifications.
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AppShell from './components/layout/AppShell';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { useAuthStore } from './store/authStore.js';
import { ROLE_HOME } from './utils/roles.js';

/* ── Code-split lazy-loaded pages ────────────────────────────────────────── */
const LoginPage             = lazy(() => import('./pages/LoginPage'));
const NotFoundPage          = lazy(() => import('./pages/NotFoundPage'));
const AdminDashboard        = lazy(() => import('./pages/AdminDashboard'));
const DoctorDashboard       = lazy(() => import('./pages/DoctorDashboard'));
const OtDashboard           = lazy(() => import('./pages/OtDashboard'));
const FlowCommandCenterPage = lazy(() => import('./pages/flow/FlowCommandCenterPage'));
const WhatIfSimulatorPage   = lazy(() => import('./pages/flow/WhatIfSimulatorPage'));
const BottleneckMapPage     = lazy(() => import('./pages/flow/BottleneckMapPage'));
const DischargePlannerPage  = lazy(() => import('./pages/flow/DischargePlannerPage'));
const LiveBedMapPage        = lazy(() => import('./pages/flow/LiveBedMapPage'));
const StaffDoctorsPage      = lazy(() => import('./pages/flow/StaffDoctorsPage'));
const HousekeepingBoardPage = lazy(() => import('./pages/flow/HousekeepingBoardPage'));
const FlowAuditLogPage      = lazy(() => import('./pages/flow/FlowAuditLogPage'));
const DoctorPredictionsPage = lazy(() => import('./pages/flow/DoctorPredictionsPage'));
const OtFlowImpactPage      = lazy(() => import('./pages/flow/OtFlowImpactPage'));

/** Page-level loading fallback */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] w-full bg-cream-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-royal-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-ink-500 text-xs font-semibold tracking-wider uppercase">Loading…</p>
      </div>
    </div>
  );
}

/** "/" sends each role to its own dashboard. */
function RoleHome() {
  const role = useAuthStore((s) => s.role);
  return <Navigate to={ROLE_HOME[role] || '/login'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#FFFFFF',
            color: '#0F1B2D',
            border: '1px solid #EFE7E2',
            borderRadius: '0.75rem',
            fontSize: '0.8125rem',
            boxShadow: '0 10px 15px -3px rgb(1 42 99 / 0.15)',
          },
          success: { iconTheme: { primary: '#1FA971', secondary: '#FFFFFF' } },
          error: { iconTheme: { primary: '#D64545', secondary: '#FFFFFF' } },
        }}
      />

      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleHome />} />

            {/* Admin */}
            <Route path="admin/dashboard" element={<AdminDashboard />} />
            <Route path="admin/flow/command-center" element={<FlowCommandCenterPage />} />
            <Route path="admin/flow/simulator" element={<WhatIfSimulatorPage />} />
            <Route path="admin/flow/bottlenecks" element={<BottleneckMapPage />} />
            <Route path="admin/flow/discharge-planner" element={<DischargePlannerPage />} />
            <Route path="admin/beds-overview" element={<LiveBedMapPage />} />
            <Route path="admin/flow/staff" element={<StaffDoctorsPage />} />
            <Route path="admin/flow/housekeeping" element={<HousekeepingBoardPage />} />
            <Route path="admin/flow/audit" element={<FlowAuditLogPage />} />

            {/* Doctor */}
            <Route path="doctor/dashboard" element={<DoctorDashboard />} />
            <Route path="doctor/flow/predictions" element={<DoctorPredictionsPage />} />

            {/* OT Manager */}
            <Route path="ot/dashboard" element={<OtDashboard />} />
            <Route path="ot/flow/impact" element={<OtFlowImpactPage />} />
          </Route>

          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
