/**
 * @file App.jsx
 * Root application component: code-split routes for the five roles (Admin, Doctor, OT Manager, Nurse, Patient),
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
const PatientsPage          = lazy(() => import('./pages/admin/PatientsPage'));
const NurseManagementPage   = lazy(() => import('./pages/admin/NurseManagementPage'));
const PatientJourneyPage    = lazy(() => import('./pages/admin/PatientJourneyPage'));
const NurseDashboard        = lazy(() => import('./pages/nurse/NurseDashboard'));
const PatientDashboard      = lazy(() => import('./pages/patient/PatientDashboard'));
const DoctorRequestsPage    = lazy(() => import('./pages/doctor/DoctorRequestsPage'));
const OtRequestsPage        = lazy(() => import('./pages/ot/OtRequestsPage'));
const OtSurgeonsPage        = lazy(() => import('./pages/ot/OtSurgeonsPage'));
const RequestCenterPage     = lazy(() => import('./pages/admin/RequestCenterPage'));

/** Page-level loading fallback */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] w-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-[3px] border-royal-500 border-t-transparent rounded-full animate-spin" />
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
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: 'rgb(var(--cream-50))',
            color: 'rgb(var(--ink-900))',
            border: '1px solid rgb(var(--cream-200))',
            borderRadius: '0.75rem',
            fontSize: '0.8125rem',
            boxShadow: 'none',
          },
          success: { iconTheme: { primary: '#10B981', secondary: '#FFFFFF' } },
          error: { iconTheme: { primary: '#EF4444', secondary: '#FFFFFF' } },
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
            <Route path="admin/patients" element={<PatientsPage />} />
            <Route path="admin/requests" element={<RequestCenterPage />} />
            <Route path="admin/nurses" element={<NurseManagementPage />} />
            <Route path="admin/patient-journey" element={<PatientJourneyPage />} />
            <Route path="admin/patient-journey/:patientId" element={<PatientJourneyPage />} />
            <Route path="patient-journey/:patientId" element={<PatientJourneyPage />} />

            {/* Doctor */}
            <Route path="doctor/dashboard" element={<DoctorDashboard />} />
            <Route path="doctor/schedule" element={<DoctorDashboard />} />
            <Route path="doctor/patients" element={<DoctorDashboard />} />
            <Route path="doctor/ot-cases" element={<DoctorDashboard />} />
            <Route path="doctor/calendar" element={<DoctorDashboard />} />
            <Route path="doctor/notifications" element={<DoctorDashboard />} />
            <Route path="doctor/requests" element={<DoctorRequestsPage />} />
            <Route path="doctor/flow/predictions" element={<DoctorPredictionsPage />} />

            {/* OT Manager */}
            <Route path="ot/dashboard" element={<OtDashboard />} />
            <Route path="ot/requests" element={<OtRequestsPage />} />
            <Route path="ot/surgeons" element={<OtSurgeonsPage />} />
            <Route path="ot/flow/impact" element={<OtFlowImpactPage />} />

            {/* Nurse */}
            <Route path="nurse/dashboard" element={<NurseDashboard />} />
            <Route path="nurse/patients" element={<NurseDashboard />} />
            <Route path="nurse/tasks" element={<NurseDashboard />} />
            <Route path="nurse/beds" element={<NurseDashboard />} />
            <Route path="nurse/notifications" element={<NurseDashboard />} />

            {/* Patient */}
            <Route path="patient/dashboard" element={<PatientDashboard />} />
            <Route path="patient/treatment" element={<PatientDashboard />} />
            <Route path="patient/reports" element={<PatientDashboard />} />
            <Route path="patient/requests" element={<PatientDashboard />} />
            <Route path="patient/help" element={<PatientDashboard />} />
          </Route>

          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
