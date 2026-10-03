import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

/* ── Lazy-loaded pages ──────────────────────────────────────────── */
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
const NotFoundPage        = lazy(() => import('./pages/NotFoundPage'));

/* ── Placeholder for layout (Phase 4) ──────────────────────────── */
// import AppShell from './components/layout/AppShell';
// import ProtectedRoute from './components/layout/ProtectedRoute';

/**
 * Page-level loading fallback
 */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Loading…</p>
      </div>
    </div>
  );
}

/**
 * Root application component.
 * Sets up routing, providers, and socket bootstrap.
 */
export default function App() {
  return (
    <BrowserRouter>
      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--color-surface)',
            color: 'var(--color-foreground)',
            border: '1px solid var(--color-border)',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08)',
          },
          success: {
            iconTheme: { primary: '#16a34a', secondary: '#f0fdf4' },
          },
          error: {
            iconTheme: { primary: '#dc2626', secondary: '#fef2f2' },
          },
        }}
      />

      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes (wrapped in AppShell in Phase 4) */}
          <Route path="/" element={<CommandCenterPage />} />
          <Route path="/digital-twin" element={<DigitalTwinPage />} />
          <Route path="/beds" element={<BedsPatientsPage />} />
          <Route path="/staff" element={<StaffOtPage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/audit" element={<AuditLogPage />} />

          {/* Mobile alert view */}
          <Route path="/m" element={<MobileAlertsPage />} />

          {/* Catch-all */}
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
