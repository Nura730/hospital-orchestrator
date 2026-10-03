/**
 * @file App.jsx
 * Root application component with code-split routing, AppShell layout wrapping,
 * role-guarded routes, and global toast notifications.
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AppShell from './components/layout/AppShell';
import ProtectedRoute from './components/layout/ProtectedRoute';

/* ── Code-split lazy-loaded pages ────────────────────────────────────────── */
const LoginPage           = lazy(() => import('./pages/LoginPage'));
const CommandCenterPage   = lazy(() => import('./pages/CommandCenterPage'));
const DigitalTwinPage     = lazy(() => import('./pages/DigitalTwinPage'));
const BedsPatientsPage    = lazy(() => import('./pages/BedsPatientsPage'));
const StaffOtPage         = lazy(() => import('./pages/StaffOtPage'));
const EquipmentPage       = lazy(() => import('./pages/EquipmentPage'));
const RecommendationsPage = lazy(() => import('./pages/RecommendationsPage'));
const SimulatorPage       = lazy(() => import('./pages/SimulatorPage'));
const AlertsPage          = lazy(() => import('./pages/AlertsPage'));
const AnalyticsPage       = lazy(() => import('./pages/AnalyticsPage'));
const AuditLogPage        = lazy(() => import('./pages/AuditLogPage'));
const MobileAlertsPage    = lazy(() => import('./pages/MobileAlertsPage'));
const UiKitShowroomPage   = lazy(() => import('./pages/UiKitShowroomPage'));
const NotFoundPage        = lazy(() => import('./pages/NotFoundPage'));

/**
 * Page-level loading fallback shimmer
 */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] w-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-surface-muted text-xs font-mono tracking-wider uppercase">
          Loading Sector Telemetry...
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Toast notifications container */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: 'var(--color-surface-elevated, #1e293b)',
            color: 'var(--color-surface-foreground, #f8fafc)',
            border: '1px solid var(--color-surface-border, #334155)',
            borderRadius: '0.75rem',
            fontSize: '0.8125rem',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.15)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#f0fdf4' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fef2f2' },
          },
        }}
      />

      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public authentication */}
          <Route path="/login" element={<LoginPage />} />

          {/* Standalone mobile quick alert feed */}
          <Route
            path="/m"
            element={
              <ProtectedRoute>
                <MobileAlertsPage />
              </ProtectedRoute>
            }
          />

          {/* Protected routes wrapped in master AppShell layout */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<CommandCenterPage />} />
            <Route path="digital-twin" element={<DigitalTwinPage />} />
            <Route path="beds-patients" element={<BedsPatientsPage />} />
            <Route path="beds" element={<Navigate to="/beds-patients" replace />} />
            <Route path="staff-ot" element={<StaffOtPage />} />
            <Route path="staff" element={<Navigate to="/staff-ot" replace />} />
            <Route path="equipment" element={<EquipmentPage />} />
            <Route path="recommendations" element={<RecommendationsPage />} />
            <Route path="simulator" element={<SimulatorPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="audit" element={<Navigate to="/audit-log" replace />} />
            <Route path="_kit" element={<UiKitShowroomPage />} />
          </Route>

          {/* 404 handler */}
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
