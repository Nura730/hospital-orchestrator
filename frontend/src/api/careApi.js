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

const wait = (ms = 120 + Math.random() * 160) => new Promise((r) => setTimeout(r, ms));

/** Run a care-model call asynchronously and hand back a copy (callers can't mutate shared state). */
async function call(fn, ...args) {
  await Promise.all([wait(), loadIcuModel()]);
  return care.clone(fn(...args));
}

export const REQUEST_TYPES = care.REQUEST_TYPES;
export const TASK_TYPES = care.TASK_TYPES;

export const careApi = {
  // Patients
  listPatients: () => call(care.listPatients),
  getPatientDetail: (patientId) => call(care.getPatientDetail, patientId),
  getJourney: (patientId) => call(care.getJourney, patientId),
  updatePatientStatus: (patientId, body, by) => call(care.updatePatientStatus, patientId, body, by),

  // Reports
  generateReport: (patientId, opts) => call(care.generateReport, patientId, opts),
  shareReport: (reportId) => call(care.shareReport, reportId),

  // Requests
  createRequest: (body) => call(care.createRequest, body),
  updateRequest: (id, status) => call(care.updateRequest, id, status),

  // Nurse
  listNurses: () => call(care.listNurses),
  getNurseDashboard: () => call(care.getNurseDashboard),
  setNurseStatus: (status) => call(care.setNurseStatus, status),
  updateTask: (taskId, status) => call(care.updateTask, taskId, status),
  addTask: (body) => call(care.addTask, body),
  addNote: (patientId, note, by) => call(care.addNote, patientId, note, by),
  alertDoctor: (patientId, message, by) => call(care.alertDoctor, patientId, message, by),

  // Doctor
  getDoctorDashboard: () => call(care.getDoctorDashboard),
  getDoctorEvents: (fromMs, toMs) => call(care.getDoctorEvents, fromMs, toMs),
  addDoctorEvent: (body) => call(care.addDoctorEvent, body),
  /** Saves to PATCH /doctor/status on the real backend; always mirrored in the care model. */
  setDoctorStatus: async (status) => {
    if (!isFlowMock) await apiClient.patch('/doctor/status', { status });
    return call(care.setDoctorStatus, status);
  },
  requestOt: (patientId, procedure, by) => call(care.requestOtForPatient, patientId, procedure, by),

  // OT
  getOtBoard: () => call(care.getOtBoard),
  getDoctorAvailability: () => call(care.getDoctorAvailability),
  completeCase: async (caseId, roomId) => {
    const res = await flowApi.postEvent('OT_COMPLETE', { caseId });
    care.noteRoomCleaning(roomId);
    return res;
  },
  delayCase: (caseId, minutes) => call(care.delayCase, caseId, minutes),
  markRoomReady: (roomId) => call(care.markRoomReady, roomId),
  assignCase: (roomId, caseId) => call(care.assignCase, roomId, caseId),
  assignOtDoctor: (patientId, doctorId, opts) => call(care.assignOtDoctor, patientId, doctorId, opts),
  assignSurgeon: (caseId, doctorId) => call(care.assignSurgeon, caseId, doctorId),

  // Patient portal
  getPortal: () => call(care.getPortal),
  submitPortalRequest: (body) => call(care.submitPortalRequest, body),

  // Notifications (shared hospital feed)
  getNotifications: () => call(care.getNotifications),
  markRead: (id) => call(care.markRead, id),
  markAllRead: () => call(care.markAllRead),
};

export default careApi;
