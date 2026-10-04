/**
 * @file careApi.js
 * Patient-care API used by the Doctor, Nurse, Patient, OT and Admin care screens: patient detail,
 * treatment journey, reports, requests, nurse shift/tasks, doctor calendar and the OT room board.
 *
 * The backend does not expose these endpoints yet, so they are served by the in-browser care model
 * (careMock), which shares its hospital state with the flow mock. Swap each call for an apiClient
 * request when the matching backend route exists.
 */

import * as care from './mock/careMock.js';
import { flowApi, isFlowMock } from './flowApi.js';
import apiClient from './client.js';
import { loadIcuModel } from '../ml/icuNeed.js';
import { commit } from './mock/hospitalSync.js';

const wait = (ms = 120 + Math.random() * 160) => new Promise((r) => setTimeout(r, ms));

/** Run a care-model call asynchronously and hand back a copy (callers can't mutate shared state). */
async function call(fn, ...args) {
  await Promise.all([wait(), loadIcuModel()]);
  return care.clone(fn(...args));
}

/** Same as call(), then share the change with every open tab and refresh all pages. */
async function change(fn, ...args) {
  const r = await call(fn, ...args);
  commit(fn.name);
  return r;
}

export const REQUEST_TYPES = care.REQUEST_TYPES;
export const TASK_TYPES = care.TASK_TYPES;

export const careApi = {
  // Patients
  listPatients: () => call(care.listPatients),
  getPatientDetail: (patientId) => call(care.getPatientDetail, patientId),
  getJourney: (patientId) => call(care.getJourney, patientId),
  updatePatientStatus: (patientId, body, by) => change(care.updatePatientStatus, patientId, body, by),

  // Reports
  generateReport: (patientId, opts) => change(care.generateReport, patientId, opts),
  shareReport: (reportId) => change(care.shareReport, reportId),

  // Requests
  createRequest: (body) => change(care.createRequest, body),
  updateRequest: (id, status) => change(care.updateRequest, id, status),

  // Nurse
  listNurses: () => call(care.listNurses),
  getNurseDashboard: () => call(care.getNurseDashboard),
  setNurseStatus: (status) => change(care.setNurseStatus, status),
  updateTask: (taskId, status) => change(care.updateTask, taskId, status),
  addTask: (body) => change(care.addTask, body),
  addNote: (patientId, note, by) => change(care.addNote, patientId, note, by),
  alertDoctor: (patientId, message, by) => change(care.alertDoctor, patientId, message, by),

  // Doctor
  getDoctorDashboard: () => call(care.getDoctorDashboard),
  getDoctorEvents: (fromMs, toMs) => call(care.getDoctorEvents, fromMs, toMs),
  addDoctorEvent: (body) => change(care.addDoctorEvent, body),
  /** Saves to PATCH /doctor/status on the real backend; always mirrored in the care model. */
  setDoctorStatus: async (status) => {
    if (!isFlowMock) await apiClient.patch('/doctor/status', { status });
    return change(care.setDoctorStatus, status);
  },
  requestOt: (patientId, procedure, by) => change(care.requestOtForPatient, patientId, procedure, by),

  // OT
  getOtBoard: () => call(care.getOtBoard),
  getDoctorAvailability: () => call(care.getDoctorAvailability),
  completeCase: async (caseId, roomId) => {
    const res = await flowApi.postEvent('OT_COMPLETE', { caseId });
    care.noteRoomCleaning(roomId);
    care.onCaseCompleted(caseId);
    commit('ot-complete');
    return res;
  },
  delayCase: (caseId, minutes) => change(care.delayCase, caseId, minutes),
  markRoomReady: (roomId) => change(care.markRoomReady, roomId),
  assignCase: (roomId, caseId) => change(care.assignCase, roomId, caseId),
  assignOtDoctor: (patientId, doctorId, opts) => change(care.assignOtDoctor, patientId, doctorId, opts),
  assignSurgeon: (caseId, doctorId) => change(care.assignSurgeon, caseId, doctorId),

  // Workflow: requests, OT queue, transfers (shared across tabs)
  listRequests: (role) => call(care.listRequests, role),
  escalateToOt: (requestId, patientId, body, by) => change(care.escalateToOt, requestId, patientId, body, by),
  listOtRequests: () => call(care.listOtRequests),
  otAvailability: (start, durationMin) => call(care.otAvailability, start, durationMin),
  scheduleOtRequest: (id, body, by) => change(care.scheduleOtRequest, id, body, by),
  declineOtRequest: (id, reason, by) => change(care.declineOtRequest, id, reason, by),
  transferPatient: (patientId, toType, by) => change(care.transferPatient, patientId, toType, by),
  getBadgeCounts: (role) => call(care.getBadgeCounts, role),

  // Patient portal
  getPortal: () => call(care.getPortal),
  submitPortalRequest: (body) => change(care.submitPortalRequest, body),
  previewPortalRoute: (type) => call(care.previewPortalRoute, type),

  // Notifications (shared hospital feed)
  getNotifications: (role) => call(care.getNotifications, role),
  markRead: (id, role) => change(care.markRead, id, role),
  markAllRead: (role) => change(care.markAllRead, role),
};

export default careApi;
