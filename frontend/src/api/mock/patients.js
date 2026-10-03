/**
 * @file patients.js
 * Mock handlers for hospital patient management and ED waiting queue.
 */

import { hospitalState } from './seed.js';
import { PATIENT_STATUS, BED_STATUS } from '../../utils/constants.js';

/**
 * Get all patients with filters.
 */
export function mockGetPatients(params = {}) {
  const { department, status, acuity, search } = params;
  let list = [...hospitalState.patients];

  if (department && department !== 'all') {
    list = list.filter((p) => p.department.toLowerCase() === department.toLowerCase());
  }

  if (status && status !== 'all') {
    list = list.filter((p) => p.status === status);
  }

  if (acuity && acuity !== 'all') {
    list = list.filter((p) => p.acuity === Number(acuity));
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        p.chiefComplaint.toLowerCase().includes(q)
    );
  }

  return list;
}

/**
 * Get Emergency waiting queue:
 * Sorted by acuity ascending (1 Critical first), then waiting time descending.
 */
export function mockGetWaitingQueue() {
  const waiting = hospitalState.patients.filter(
    (p) => p.status === PATIENT_STATUS.WAITING || !p.bedId
  );

  return waiting.sort((a, b) => {
    if (a.acuity !== b.acuity) {
      return a.acuity - b.acuity; // Acuity 1 comes before Acuity 2
    }
    return (b.waitingTimeMinutes || 0) - (a.waitingTimeMinutes || 0); // Longest wait first
  });
}

/**
 * Get patient by ID.
 */
export function mockGetPatientById(id) {
  const patient = hospitalState.patients.find((p) => p.id === id || p.mrn === id);
  if (!patient) {
    throw new Error(`Patient ${id} not found`);
  }
  return patient;
}

/**
 * Admit patient from waiting queue into a designated bed.
 */
export function mockAdmitPatient({ patientId, bedId }) {
  const patient = hospitalState.patients.find((p) => p.id === patientId);
  const bed = hospitalState.beds.find((b) => b.id === bedId);

  if (!patient) throw new Error(`Patient ${patientId} not found`);
  if (!bed) throw new Error(`Bed ${bedId} not found`);

  patient.status = PATIENT_STATUS.ADMITTED;
  patient.bedId = bed.id;
  patient.bedCode = bed.bedNumber;
  patient.department = bed.department;
  patient.admittedAt = new Date().toISOString();
  patient.waitingTimeMinutes = 0;

  bed.status = BED_STATUS.OCCUPIED;
  bed.patientId = patient.id;
  bed.expectedReleaseTime = new Date(Date.now() + 86400000 * (patient.expectedLosDays || 3)).toISOString();
  bed.releaseConfidence = 85;

  hospitalState.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userName: 'Admission Officer',
    userRole: 'bed_manager',
    action: 'PATIENT_ADMITTED',
    details: `Admitted ${patient.name} (${patient.mrn}) to bed ${bed.bedNumber} in ${bed.department}`,
    ip: '127.0.0.1',
  });

  return { patient, bed };
}

/**
 * Transfer patient between beds.
 */
export function mockTransferPatient({ patientId, toBedId }) {
  const patient = hospitalState.patients.find((p) => p.id === patientId);
  const targetBed = hospitalState.beds.find((b) => b.id === toBedId);
  const currentBed = patient && patient.bedId ? hospitalState.beds.find((b) => b.id === patient.bedId) : null;

  if (!patient) throw new Error(`Patient ${patientId} not found`);
  if (!targetBed) throw new Error(`Destination bed ${toBedId} not found`);

  // Release old bed to cleaning
  if (currentBed) {
    currentBed.status = BED_STATUS.CLEANING;
    currentBed.patientId = null;
    currentBed.expectedReleaseTime = null;
  }

  // Occupy target bed
  targetBed.status = BED_STATUS.OCCUPIED;
  targetBed.patientId = patient.id;
  targetBed.expectedReleaseTime = new Date(Date.now() + 86400000 * 2).toISOString();

  patient.bedId = targetBed.id;
  patient.bedCode = targetBed.bedNumber;
  patient.department = targetBed.department;

  hospitalState.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userName: 'Charge Nurse',
    userRole: 'nurse_manager',
    action: 'PATIENT_TRANSFERRED',
    details: `Transferred ${patient.name} from ${currentBed ? currentBed.bedNumber : 'Queue'} to ${targetBed.bedNumber}`,
    ip: '127.0.0.1',
  });

  return { patient, targetBed };
}

/**
 * Discharge patient and free up bed.
 */
export function mockDischargePatient(patientId) {
  const patient = hospitalState.patients.find((p) => p.id === patientId);
  if (!patient) throw new Error(`Patient ${patientId} not found`);

  if (patient.bedId) {
    const bed = hospitalState.beds.find((b) => b.id === patient.bedId);
    if (bed) {
      bed.status = BED_STATUS.CLEANING;
      bed.patientId = null;
      bed.expectedReleaseTime = null;
    }
  }

  patient.status = PATIENT_STATUS.DISCHARGED;
  patient.bedId = null;
  patient.bedCode = null;

  hospitalState.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userName: 'Attending Physician',
    userRole: 'doctor',
    action: 'PATIENT_DISCHARGED',
    details: `Discharged ${patient.name} (${patient.mrn})`,
    ip: '127.0.0.1',
  });

  return patient;
}
