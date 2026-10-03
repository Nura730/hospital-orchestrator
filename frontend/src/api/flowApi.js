/**
 * @file flowApi.js
 * Predictive Flow Intelligence API. Real data comes from /api/v1/flow (Neon DB).
 * Mock data is used only when VITE_MOCK_MODE=true (or, when VITE_MOCK_MODE is unset,
 * when the app-wide VITE_USE_MOCK mock mode is on, so the offline demo keeps working).
 */

import apiClient from './client.js';
import { flowMock } from './mock/flowMock.js';
import { commit } from './mock/hospitalSync.js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const appMock = env.VITE_USE_MOCK !== undefined ? env.VITE_USE_MOCK !== 'false' : true;
export const isFlowMock = env.VITE_MOCK_MODE !== undefined ? env.VITE_MOCK_MODE === 'true' : appMock;

const AI_TIMEOUT_MS = 45000;

function unwrap(res) {
  return res && typeof res === 'object' && 'data' in res ? res.data : res;
}

async function get(path, params) {
  if (isFlowMock) return flowMock.get(path, params);
  return unwrap(await apiClient.get(`/flow${path}`, { params }));
}

async function post(path, body, config) {
  if (isFlowMock) {
    const r = await flowMock.post(path, body);
    if (path !== '/ai-report' && path !== '/simulate') commit(path);
    return r;
  }
  return unwrap(await apiClient.post(`/flow${path}`, body, config));
}

async function patch(path, body) {
  if (isFlowMock) {
    const r = await flowMock.patch(path, body);
    commit(path);
    return r;
  }
  return unwrap(await apiClient.patch(`/flow${path}`, body));
}

export const flowApi = {
  // Phase 1 — events
  postEvent: (eventType, payload) => post('/event', { eventType, payload }),

  // Phase 2 — predictions
  getForecast: (department, horizon = 6) => get('/forecast', { department, horizon }),
  getBedDemand: (department, horizon) => get('/bed-demand', { department, horizon }),
  getDischargeCandidates: () => get('/discharge-candidates'),
  getAdmissionProbability: (patientId) => get(`/admission-probability/${patientId}`),
  getLos: (patientId) => get(`/los/${patientId}`),

  // Phase 3 — live state
  getBottlenecks: (severity) => get('/bottlenecks', severity ? { severity } : undefined),
  getStateSummary: () => get('/state-summary'),
  getBedMap: () => get('/bed-map'),
  getDashboardNumbers: (scope) => get('/dashboard-numbers', { scope }),
  getConfig: () => get('/config'),

  /** Generic GET used by <ChartPopup endpoint="..."> (path relative to /flow, may include a query string). */
  getRaw: (endpoint) => {
    const [path, qs] = endpoint.split('?');
    const params = qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined;
    return get(path.startsWith('/') ? path : `/${path}`, params);
  },

  // Phase 4 — simulator
  simulate: (params) => post('/simulate', params),
  getSimulationHistory: (limit = 5) => get('/simulations/history', { limit }),
  applySimulation: (id) => post(`/simulations/${id}/apply`, {}),

  // Workflow actions
  getRecommendations: (status) => get('/recommendations', status ? { status } : undefined),
  createRecommendationBatch: (actions, opts = {}) => post('/recommendations/batch', { actions, ...opts }),
  decideRecommendation: (id, status) => patch(`/recommendations/${id}`, { status }),
  nudgeDischarges: (patientIds = []) => post('/discharge/nudge', { patientIds }),
  markDischargeReady: (patientId) => post(`/discharge/${patientId}/mark-ready`, {}),
  getBedsAboutToFree: (hours = 4) => get('/beds/about-to-free', { hours }),
  getWaitingPatients: () => get('/waiting-patients'),
  preAssignBed: (bedId, patientId) => post(`/beds/${bedId}/pre-assign`, { patientId }),
  getOtImpact: () => get('/ot-impact'),
  getDoctorPatients: () => get('/doctor/patients'),
  getStaffRoster: () => get('/staff-roster'),
  getHousekeeping: () => get('/housekeeping'),
  getAudit: (params) => get('/audit', params),

  // Phase 9 — AI report + demo controls
  aiReport: (scope, format = 'explain') => post('/ai-report', { scope, format }, { timeout: AI_TIMEOUT_MS }),
  demoReset: () => post('/demo/reset', {}),
  demoAmbulance: (body = {}) => post('/demo/ambulance', body),
  demoSurge: () => post('/demo/surge', {}),

  // Doctor OT request (core doctor API)
  requestOt: async (body) => {
    if (isFlowMock) {
      const r = await flowMock.requestOt(body);
      commit('ot-request');
      return r;
    }
    return unwrap(await apiClient.post('/doctor/ot-requests', body));
  },

  // Notifications (core API, shared with the rest of the app)
  getNotifications: async () => {
    if (isFlowMock) return flowMock.getNotifications();
    return unwrap(await apiClient.get('/notifications'));
  },
  markNotificationRead: async (id) => {
    if (isFlowMock) {
      const r = await flowMock.markNotificationRead(id);
      commit('notification-read');
      return r;
    }
    return unwrap(await apiClient.patch(`/notifications/${id}/read`));
  },
  markAllNotificationsRead: async () => {
    if (isFlowMock) {
      const r = await flowMock.markAllNotificationsRead();
      commit('notifications-read');
      return r;
    }
    return unwrap(await apiClient.patch('/notifications/read-all'));
  },
};

export default flowApi;
