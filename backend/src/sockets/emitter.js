const { getIO } = require('./index');
const logger = require('../utils/logger');

function safeEmit(room, event, data) {
  try {
    const io = getIO();
    if (!io) return;
    if (room) {
      io.to(room).emit(event, data);
    } else {
      io.emit(event, data);
    }
  } catch (err) {
    logger.error({ err: err.message, event, room }, 'Failed to emit socket event');
  }
}

const emitter = {
  /**
   * Emit bed status update
   * @param {{ bedId: string, status: string, patientId?: string }} payload
   */
  emitBedUpdated(payload) {
    safeEmit(null, 'bed.updated', payload);
  },

  /**
   * Emit patient status update
   * @param {{ patientId: string, status: string, acuity: number }} payload
   */
  emitPatientUpdated(payload) {
    safeEmit(null, 'patient.updated', payload);
  },

  /**
   * Emit OT case started event
   * @param {{ caseId: string, roomId: number, surgeonName: string, patientName: string }} payload
   */
  emitOtCaseStarted(payload) {
    safeEmit(null, 'ot.caseStarted', payload);
  },

  /**
   * Emit OT case completed event
   * @param {{ caseId: string, roomId: number, duration: number, nextStatus: string }} payload
   */
  emitOtCaseCompleted(payload) {
    safeEmit(null, 'ot.caseCompleted', payload);
  },

  /**
   * Emit OT overrun event
   * @param {{ caseId: string, roomId: number, overrunMinutes: number }} payload
   */
  emitOtOverrun(payload) {
    safeEmit(['admin', 'ot_manager'], 'ot.overrun', payload);
  },

  /**
   * Emit doctor status change event
   * @param {{ doctorId: string, name: string, newStatus: string, location?: string }} payload
   */
  emitDoctorStatusChanged(payload) {
    safeEmit(null, 'doctor.statusChanged', payload);
  },

  /**
   * Emit new alert created
   * @param {{ alertId: string, severity: string, title: string, department?: string }} payload
   */
  emitAlertCreated(payload) {
    safeEmit(['admin', 'ot_manager'], 'alert.created', payload);
  },

  /**
   * Emit alert escalated
   * @param {{ alertId: string, newLevel: number }} payload
   */
  emitAlertEscalated(payload) {
    safeEmit(['admin', 'ot_manager'], 'alert.escalated', payload);
  },

  /**
   * Emit updated KPI snapshots
   * @param {object} payload
   */
  emitKpiUpdated(payload) {
    safeEmit('admin', 'kpi.updated', {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Emit targeted notification to specific user
   * @param {string} userId
   * @param {object} notification
   */
  emitNotification(userId, notification) {
    safeEmit(`user-${userId}`, 'notification.new', {
      userId,
      notification,
    });
  },
};

module.exports = emitter;
