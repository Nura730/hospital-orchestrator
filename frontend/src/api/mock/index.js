/**
 * @file index.js (Mock Router)
 * Intercepts or directs API calls to appropriate mock generator functions.
 * Adds realistic network latency (300ms - 700ms) and wraps responses
 * in the standard MediOrchestra envelope: { ok: true, data: ..., error: null }.
 */

import { MOCK_LATENCY_MIN_MS, MOCK_LATENCY_MAX_MS } from '../../utils/constants.js';

import {
  mockGetBeds,
  mockGetBedById,
  mockUpdateBedStatus,
  mockGetBedSuggestions,
  mockGetBedStatusDistribution,
} from './beds.js';

import {
  mockGetPatients,
  mockGetWaitingQueue,
  mockGetPatientById,
  mockAdmitPatient,
  mockTransferPatient,
  mockDischargePatient,
} from './patients.js';

import {
  mockGetStaff,
  mockGetStaffById,
  mockUpdateStaffStatus,
  mockGetStaffMetrics,
} from './staff.js';

import {
  mockGetEquipment,
  mockGetEquipmentById,
  mockUpdateEquipmentStatus,
  mockGetEquipmentStatusMix,
} from './equipment.js';

import {
  mockGetOtRooms,
  mockGetOtCases,
  mockEmergencyInsertCase,
  mockUpdateOtCaseStatus,
} from './ot.js';

import {
  mockGetAlerts,
  mockAcknowledgeAlert,
  mockResolveAlert,
  mockGetAlertStats,
} from './alerts.js';

import {
  mockGetRecommendations,
  mockApproveRecommendation,
  mockRejectRecommendation,
  mockGetAutonomyMode,
  mockSetAutonomyMode,
} from './recommendations.js';

import {
  mockGetArrivalForecast,
  mockGetDemandCapacity,
  mockGetDepartmentOccupancy,
} from './forecast.js';

import {
  mockGetBottlenecks,
  mockGetBottleneckById,
} from './bottlenecks.js';

import {
  mockGetOverview,
  mockGetLiveKpis,
  mockGetAnalyticsBaseline,
} from './kpis.js';

import {
  mockRunSimulation,
  mockGetSimulationHistory,
} from './simulate.js';

import {
  mockGetAuditLogs,
} from './audit.js';

import { hospitalState, resetHospitalState } from './seed.js';

/**
 * Simulates network delay between min and max ms.
 */
function delay() {
  const ms = Math.floor(Math.random() * (MOCK_LATENCY_MAX_MS - MOCK_LATENCY_MIN_MS + 1)) + MOCK_LATENCY_MIN_MS;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps mock execution in delay and standard API envelope.
 */
export async function mockRoute(handlerFn, ...args) {
  await delay();
  try {
    const result = await handlerFn(...args);
    return {
      ok: true,
      data: result,
      error: null,
    };
  } catch (err) {
    console.error('[MockRouter Error]', err);
    return {
      ok: false,
      data: null,
      error: err.message || 'Mock processing error',
    };
  }
}

// Export domain handlers for endpoints.js
export const mockApi = {
  // Auth
  login: async (credentials) => {
    await delay();
    const { email, password, role = 'admin' } = credentials;
    return {
      ok: true,
      data: {
        token: `mock-jwt-token-${role}-${Date.now()}`,
        user: {
          id: 'usr-001',
          name: role === 'doctor' ? 'Dr. Sarah Lin, MD' : role === 'bed_manager' ? 'Marcus Vance' : role === 'ot_manager' ? 'OT Manager Rhea Kapoor' : 'Admin Marcus Sterling',
          email: email || 'admin@hospital.org',
          role: role || 'admin',
          department: role === 'doctor' ? 'Emergency' : 'Operations',
        },
      },
      error: null,
    };
  },
  logout: async () => {
    await delay();
    return { ok: true, data: { message: 'Logged out successfully' }, error: null };
  },
  getMe: async (currentUser) => {
    await delay();
    return {
      ok: true,
      data: currentUser || {
        id: 'usr-001',
        name: 'Admin Marcus Sterling',
        email: 'admin@hospital.org',
        role: 'admin',
        department: 'Operations',
      },
      error: null,
    };
  },

  // Overview & KPIs
  getOverview: () => mockRoute(mockGetOverview),
  getLiveKpis: () => mockRoute(mockGetLiveKpis),
  getDepartmentOccupancy: () => mockRoute(mockGetDepartmentOccupancy),
  getArrivalForecast: (params) => mockRoute(mockGetArrivalForecast, params),
  getDemandCapacity: (params) => mockRoute(mockGetDemandCapacity, params),
  getBottlenecks: () => mockRoute(mockGetBottlenecks),
  getBottleneckById: (id) => mockRoute(mockGetBottleneckById, id),

  // Beds & Patients
  getBeds: (params) => mockRoute(mockGetBeds, params),
  getBedById: (id) => mockRoute(mockGetBedById, id),
  updateBedStatus: (id, status) => mockRoute(mockUpdateBedStatus, id, status),
  getBedSuggestions: (patientId) => mockRoute(mockGetBedSuggestions, patientId),
  getBedStatusDistribution: () => mockRoute(mockGetBedStatusDistribution),

  getPatients: (params) => mockRoute(mockGetPatients, params),
  getWaitingQueue: () => mockRoute(mockGetWaitingQueue),
  getPatientById: (id) => mockRoute(mockGetPatientById, id),
  admitPatient: (payload) => mockRoute(mockAdmitPatient, payload),
  transferPatient: (payload) => mockRoute(mockTransferPatient, payload),
  dischargePatient: (id) => mockRoute(mockDischargePatient, id),

  // Staff & OT
  getStaff: (params) => mockRoute(mockGetStaff, params),
  getStaffById: (id) => mockRoute(mockGetStaffById, id),
  updateStaffStatus: (id, status) => mockRoute(mockUpdateStaffStatus, id, status),
  getStaffMetrics: () => mockRoute(mockGetStaffMetrics),

  getOtRooms: () => mockRoute(mockGetOtRooms),
  getOtCases: () => mockRoute(mockGetOtCases),
  emergencyInsertCase: (payload) => mockRoute(mockEmergencyInsertCase, payload),
  updateOtCaseStatus: (caseId, status) => mockRoute(mockUpdateOtCaseStatus, caseId, status),

  // Equipment
  getEquipment: (params) => mockRoute(mockGetEquipment, params),
  getEquipmentById: (id) => mockRoute(mockGetEquipmentById, id),
  updateEquipmentStatus: (id, status) => mockRoute(mockUpdateEquipmentStatus, id, status),
  getEquipmentStatusMix: () => mockRoute(mockGetEquipmentStatusMix),

  // Alerts
  getAlerts: (params) => mockRoute(mockGetAlerts, params),
  acknowledgeAlert: (id) => mockRoute(mockAcknowledgeAlert, id),
  resolveAlert: (id) => mockRoute(mockResolveAlert, id),
  getAlertStats: () => mockRoute(mockGetAlertStats),

  // Recommendations & Autonomy
  getRecommendations: (params) => mockRoute(mockGetRecommendations, params),
  approveRecommendation: (id) => mockRoute(mockApproveRecommendation, id),
  rejectRecommendation: (id, reason) => mockRoute(mockRejectRecommendation, id, reason),
  getAutonomyMode: () => mockRoute(mockGetAutonomyMode),
  setAutonomyMode: (mode) => mockRoute(mockSetAutonomyMode, mode),

  // Simulator & Analytics
  runSimulation: (params) => mockRoute(mockRunSimulation, params),
  getSimulationHistory: () => mockRoute(mockGetSimulationHistory),
  getAnalyticsBaseline: () => mockRoute(mockGetAnalyticsBaseline),

  // Audit
  getAuditLogs: (params) => mockRoute(mockGetAuditLogs, params),

  // State Reset
  resetHospitalState: () => {
    resetHospitalState();
    return { ok: true, data: { message: 'Reset hospital state complete' }, error: null };
  },
};
