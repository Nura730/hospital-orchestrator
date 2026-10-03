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

  /* ── Predictive Flow Intelligence ─────────────────────────── */

  /**
   * New actionable recommendation. Emitted under both names so existing
   * clients ('recommendation.new') and flow clients ('recommendation.created') receive it.
   * @param {object} payload
   */
  emitRecommendationCreated(payload) {
    safeEmit(null, 'recommendation.new', payload);
    safeEmit(null, 'recommendation.created', payload);
  },

  /**
   * @param {{ bottlenecks: object[], rootCause: string|null, detectedAt: string }} payload
   */
  emitFlowBottleneckDetected(payload) {
    safeEmit(null, 'flow.bottleneckDetected', payload);
  },

  /**
   * @param {{ type: string, departmentId?: number, department?: string, horizon?: number, values?: object }} payload
   */
  emitFlowPredictionUpdated(payload) {
    safeEmit(null, 'flow.predictionUpdated', payload);
  },

  /**
   * @param {{ patientId: string, alias: string, doctorId?: string, probability: number, bedId?: string }} payload
   */
  emitFlowDischargeNudge(payload) {
    safeEmit(['admin', 'doctor'], 'flow.dischargeNudge', payload);
  },

  /**
   * @param {{ eventId: string, eta: number, acuity: number, injuryType?: string, bedId?: string, probability: number }} payload
   */
  emitFlowAmbulanceIncoming(payload) {
    safeEmit(null, 'flow.ambulanceIncoming', payload);
  },

  /**
   * @param {{ analyzedAt: string, stateSummary: object, bottlenecks: object[] }} payload
   */
  emitFlowAnalysisComplete(payload) {
    safeEmit(null, 'flow.analysisComplete', payload);
  },
};

module.exports = emitter;
