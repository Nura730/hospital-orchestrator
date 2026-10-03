/**
 * @file ot.js
 * Mock handlers for Operating Theatres, surgical timelines, and emergency case insertion.
 */

import { hospitalState } from './seed.js';
import { OT_STATUS, OT_CASE_STATUS } from '../../utils/constants.js';

/**
 * Get all 4 Operating Theatres with Gantt timeline data.
 */
export function mockGetOtRooms() {
  return hospitalState.otRooms;
}

/**
 * Get all OT cases across rooms.
 */
export function mockGetOtCases() {
  const cases = [];
  hospitalState.otRooms.forEach((room) => {
    room.schedule.forEach((slot) => {
      cases.push({
        ...slot,
        roomId: room.id,
        roomName: room.name,
      });
    });
  });
  return cases;
}

/**
 * Perform emergency case insertion into an OT room:
 * Inserts the emergency procedure as immediate, pushes downstream elective cases,
 * and returns the updated room schedule + displaced cases.
 */
export function mockEmergencyInsertCase(payload) {
  const { roomId, patientName, procedure, surgeonName, durationMinutes = 90 } = payload;
  const room = hospitalState.otRooms.find((r) => r.id === Number(roomId));

  if (!room) {
    throw new Error(`OT Room ${roomId} not found`);
  }

  const newCaseId = `case-emg-${Date.now().toString().slice(-4)}`;
  const affectedElectives = [];

  // Find all scheduled future elective cases in this room
  room.schedule.forEach((slot) => {
    if (slot.status === OT_CASE_STATUS.SCHEDULED) {
      affectedElectives.push({
        id: slot.id,
        title: slot.title,
        originalStart: slot.start,
        delayedMinutes: durationMinutes + 30, // case + turnover
      });
    }
  });

  const emergencySlot = {
    id: newCaseId,
    title: `[EMERGENCY] ${procedure} (${patientName || 'Trauma Patient'})`,
    start: 'Immediate',
    end: `+${durationMinutes}m`,
    status: OT_CASE_STATUS.IN_PROGRESS,
    type: 'emergency',
  };

  room.status = OT_STATUS.IN_USE;
  room.currentCase = {
    id: newCaseId,
    procedure,
    patientName: patientName || 'Trauma Patient',
    surgeonName: surgeonName || 'On-Call Trauma Surgeon',
    startTime: new Date().toISOString(),
    scheduledDurationMinutes: durationMinutes,
    estimatedEndTime: new Date(Date.now() + durationMinutes * 60000).toISOString(),
    isOverrun: false,
    overrunMinutes: 0,
  };

  room.schedule.unshift(emergencySlot);

  // Log audit
  hospitalState.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userName: 'Emergency Surgeon',
    userRole: 'doctor',
    action: 'OT_EMERGENCY_INSERT',
    details: `Inserted emergency case ${procedure} into ${room.name}. Delayed ${affectedElectives.length} elective cases.`,
    ip: '127.0.0.1',
  });

  return {
    success: true,
    room,
    insertedCaseId: newCaseId,
    affectedElectives,
  };
}

/**
 * Update case status.
 */
export function mockUpdateOtCaseStatus(caseId, status) {
  let found = null;
  hospitalState.otRooms.forEach((room) => {
    const slot = room.schedule.find((s) => s.id === caseId);
    if (slot) {
      slot.status = status;
      found = slot;
      if (status === OT_CASE_STATUS.COMPLETED && room.currentCase?.id === caseId) {
        room.currentCase = null;
        room.status = OT_STATUS.CLEANING;
      }
    }
  });

  if (!found) throw new Error(`OT Case ${caseId} not found`);
  return found;
}
