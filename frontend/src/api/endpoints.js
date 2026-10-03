/**
 * @file endpoints.js
 * Centralized API endpoints switching between mock router and real Axios backend.
 * Checks import.meta.env.VITE_USE_MOCK to seamlessly route requests.
 */

import apiClient from './client.js';
import { mockApi } from './mock/index.js';

const isMock = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_MOCK !== undefined)
  ? import.meta.env.VITE_USE_MOCK !== 'false'
  : true;

// ── Auth Endpoints ──────────────────────────────────────────────────────────
export async function login(credentials) {
  if (isMock) return mockApi.login(credentials);
  // Backend expects userType; the UI passes role
  return apiClient.post('/auth/login', { ...credentials, userType: credentials.userType || credentials.role });
}

export async function logout() {
  if (isMock) return mockApi.logout();
  return apiClient.post('/auth/logout');
}

export async function getMe() {
  if (isMock) return mockApi.getMe();
  return apiClient.get('/auth/me');
}

export async function changePassword(payload) {
  if (isMock) return { ok: true, data: { message: 'Password updated' }, error: null };
  return apiClient.patch('/auth/change-password', payload);
}

// ── Dashboard & Operations Overview ─────────────────────────────────────────
export async function getOverview() {
  if (isMock) return mockApi.getOverview();
  return apiClient.get('/admin/dashboard');
}

export async function getLiveKpis() {
  if (isMock) return mockApi.getLiveKpis();
  return apiClient.get('/admin/dashboard/live-kpis');
}

export async function getDepartmentOccupancy() {
  if (isMock) return mockApi.getDepartmentOccupancy();
  return apiClient.get('/admin/dashboard/occupancy');
}

export async function getArrivalForecast(params) {
  if (isMock) return mockApi.getArrivalForecast(params);
  return apiClient.get('/admin/dashboard/forecast', { params });
}

export async function getDemandCapacity(params) {
  if (isMock) return mockApi.getDemandCapacity(params);
  return apiClient.get('/admin/dashboard/demand-capacity', { params });
}

export async function getBottlenecks() {
  if (isMock) return mockApi.getBottlenecks();
  return apiClient.get('/admin/dashboard/bottlenecks');
}

export async function getBottleneckById(id) {
  if (isMock) return mockApi.getBottleneckById(id);
  return apiClient.get(`/admin/dashboard/bottlenecks/${id}`);
}

// ── Beds & Patients ─────────────────────────────────────────────────────────
export async function getBeds(params) {
  if (isMock) return mockApi.getBeds(params);
  return apiClient.get('/admin/beds', { params });
}

export async function getBedById(id) {
  if (isMock) return mockApi.getBedById(id);
  return apiClient.get(`/admin/beds/${id}`);
}

export async function updateBedStatus(id, status) {
  if (isMock) return mockApi.updateBedStatus(id, status);
  return apiClient.patch(`/admin/beds/${id}/status`, { status });
}

export async function getBedSuggestions(patientId) {
  if (isMock) return mockApi.getBedSuggestions(patientId);
  return apiClient.get(`/admin/beds/suggestions/${patientId}`);
}

export async function getBedStatusDistribution() {
  if (isMock) return mockApi.getBedStatusDistribution();
  return apiClient.get('/admin/beds/distribution');
}

export async function getPatients(params) {
  if (isMock) return mockApi.getPatients(params);
  return apiClient.get('/admin/patients', { params });
}

export async function getWaitingQueue() {
  if (isMock) return mockApi.getWaitingQueue();
  return apiClient.get('/admin/patients/waiting-queue');
}

export async function getPatientById(id) {
  if (isMock) return mockApi.getPatientById(id);
  return apiClient.get(`/admin/patients/${id}`);
}

export async function admitPatient(payload) {
  if (isMock) return mockApi.admitPatient(payload);
  return apiClient.post('/admin/patients/admit', payload);
}

export async function transferPatient(payload) {
  if (isMock) return mockApi.transferPatient(payload);
  return apiClient.post('/admin/patients/transfer', payload);
}

export async function dischargePatient(id) {
  if (isMock) return mockApi.dischargePatient(id);
  return apiClient.post(`/admin/patients/${id}/discharge`);
}

// ── Staff & OT ──────────────────────────────────────────────────────────────
export async function getStaff(params) {
  if (isMock) return mockApi.getStaff(params);
  return apiClient.get('/admin/doctors', { params });
}

export async function getStaffById(id) {
  if (isMock) return mockApi.getStaffById(id);
  return apiClient.get(`/admin/doctors/${id}`);
}

export async function updateStaffStatus(id, status) {
  if (isMock) return mockApi.updateStaffStatus(id, status);
  return apiClient.patch(`/admin/doctors/${id}/status`, { status });
}

export async function getStaffMetrics() {
  if (isMock) return mockApi.getStaffMetrics();
  return apiClient.get('/admin/doctors/metrics');
}

export async function getOtRooms() {
  if (isMock) return mockApi.getOtRooms();
  return apiClient.get('/ot/rooms');
}

export async function getOtCases() {
  if (isMock) return mockApi.getOtCases();
  return apiClient.get('/ot/cases');
}

export async function emergencyInsertCase(payload) {
  if (isMock) return mockApi.emergencyInsertCase(payload);
  return apiClient.post('/ot/cases/emergency-insert', payload);
}

export async function updateOtCaseStatus(caseId, status) {
  if (isMock) return mockApi.updateOtCaseStatus(caseId, status);
  return apiClient.patch(`/ot/cases/${caseId}/status`, { status });
}

// ── Equipment ───────────────────────────────────────────────────────────────
export async function getEquipment(params) {
  if (isMock) return mockApi.getEquipment(params);
  return apiClient.get('/equipment', { params });
}

export async function getEquipmentById(id) {
  if (isMock) return mockApi.getEquipmentById(id);
  return apiClient.get(`/equipment/${id}`);
}

export async function updateEquipmentStatus(id, status) {
  if (isMock) return mockApi.updateEquipmentStatus(id, status);
  return apiClient.patch(`/equipment/${id}/status`, { status });
}

export async function getEquipmentStatusMix() {
  if (isMock) return mockApi.getEquipmentStatusMix();
  return apiClient.get('/equipment/status-mix');
}

// ── Alerts ──────────────────────────────────────────────────────────────────
export async function getAlerts(params) {
  if (isMock) return mockApi.getAlerts(params);
  return apiClient.get('/alerts', { params });
}

export async function acknowledgeAlert(id) {
  if (isMock) return mockApi.acknowledgeAlert(id);
  return apiClient.patch(`/alerts/${id}/ack`);
}

export async function resolveAlert(id) {
  if (isMock) return mockApi.resolveAlert(id);
  return apiClient.patch(`/alerts/${id}/resolve`);
}

export async function getAlertStats() {
  if (isMock) return mockApi.getAlertStats();
  return apiClient.get('/alerts/stats');
}

// ── Recommendations & Autonomy ──────────────────────────────────────────────
export async function getRecommendations(params) {
  if (isMock) return mockApi.getRecommendations(params);
  return apiClient.get('/admin/recommendations', { params });
}

export async function approveRecommendation(id) {
  if (isMock) return mockApi.approveRecommendation(id);
  return apiClient.post(`/admin/recommendations/${id}/approve`);
}

export async function rejectRecommendation(id, reason) {
  if (isMock) return mockApi.rejectRecommendation(id, reason);
  return apiClient.post(`/admin/recommendations/${id}/reject`, { reason });
}

export async function getAutonomyMode() {
  if (isMock) return mockApi.getAutonomyMode();
  return apiClient.get('/admin/autonomy-mode');
}

export async function setAutonomyMode(mode) {
  if (isMock) return mockApi.setAutonomyMode(mode);
  return apiClient.put('/admin/autonomy-mode', { mode });
}

// ── Simulator & Analytics ───────────────────────────────────────────────────
export async function runSimulation(params) {
  if (isMock) return mockApi.runSimulation(params);
  return apiClient.post('/admin/simulator/run', params);
}

export async function getSimulationHistory() {
  if (isMock) return mockApi.getSimulationHistory();
  return apiClient.get('/admin/simulator/history');
}

export async function getAnalyticsBaseline() {
  if (isMock) return mockApi.getAnalyticsBaseline();
  return apiClient.get('/admin/analytics/baseline');
}

// ── Audit Logs ──────────────────────────────────────────────────────────────
export async function getAuditLogs(params) {
  if (isMock) return mockApi.getAuditLogs(params);
  return apiClient.get('/admin/audit-logs', { params });
}
