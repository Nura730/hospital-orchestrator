/**
 * @file liveEmitter.js
 * In-memory simulated real-time event generator.
 * Fires every 3 seconds to rotate bed statuses, adjust live KPIs, emit alerts,
 * and dispatch the exact same event payloads as the backend Socket.IO emitter.
 */

import { hospitalState } from './seed.js';
import {
  SOCKET_EVENTS,
  BED_STATUS,
  LIVE_EMITTER_INTERVAL_MS,
  ALERT_SEVERITY,
  ALERT_STATUS,
  STAFF_STATUS,
} from '../../utils/constants.js';

class LiveEventEmitter {
  constructor() {
    this.listeners = new Map();
    this.intervalId = null;
    this.tickCount = 0;
  }

  /**
   * Register listener for specific event or wildcard '*'.
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Remove event listener.
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Dispatch event to registered listeners.
   */
  emit(event, data) {
    // Specific event listeners
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[LiveEmitter] error in listener for ${event}:`, err);
        }
      });
    }

    // Wildcard listeners
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach((cb) => {
        try {
          cb(event, data);
        } catch (err) {
          console.error('[LiveEmitter] error in wildcard listener:', err);
        }
      });
    }
  }

  /**
   * Start 3-second simulation loop.
   */
  start() {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.tick();
    }, LIVE_EMITTER_INTERVAL_MS);
  }

  /**
   * Stop simulation loop.
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Single tick simulation cycle: selects a realistic action.
   */
  tick() {
    this.tickCount++;
    const actionSelector = this.tickCount % 5;

    switch (actionSelector) {
      // 1. Bed status cycle (e.g. Cleaning -> Available or Available -> Occupied)
      case 0: {
        const cleaningBeds = hospitalState.beds.filter((b) => b.status === BED_STATUS.CLEANING);
        if (cleaningBeds.length > 0) {
          const bed = cleaningBeds[Math.floor(Math.random() * cleaningBeds.length)];
          bed.status = BED_STATUS.AVAILABLE;
          bed.lastCleanedAt = new Date().toISOString();

          this.emit(SOCKET_EVENTS.BED_UPDATED, {
            bedId: bed.id,
            bedNumber: bed.bedNumber,
            department: bed.department,
            status: bed.status,
            patientId: null,
            timestamp: new Date().toISOString(),
          });
        } else {
          // Flip an occupied bed with high confidence to cleaning
          const occupied = hospitalState.beds.filter((b) => b.status === BED_STATUS.OCCUPIED);
          if (occupied.length > 0) {
            const bed = occupied[Math.floor(Math.random() * occupied.length)];
            bed.status = BED_STATUS.CLEANING;
            const releasedPatId = bed.patientId;
            bed.patientId = null;

            this.emit(SOCKET_EVENTS.BED_UPDATED, {
              bedId: bed.id,
              bedNumber: bed.bedNumber,
              department: bed.department,
              status: bed.status,
              patientId: null,
              previousPatientId: releasedPatId,
              timestamp: new Date().toISOString(),
            });
          }
        }
        break;
      }

      // 2. Micro-adjust live KPIs (ED wait, occupancy drift)
      case 1: {
        const deltaWait = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 2) + 1);
        hospitalState.kpis.edWaitTimeMinutes = Math.max(15, Math.min(65, hospitalState.kpis.edWaitTimeMinutes + deltaWait));

        const occupiedCount = hospitalState.beds.filter((b) => b.status === BED_STATUS.OCCUPIED).length;
        const totalOccPct = Math.round((occupiedCount / hospitalState.beds.length) * 100);

        const icuBeds = hospitalState.beds.filter((b) => b.department === 'ICU');
        const icuOccupied = icuBeds.filter((b) => b.status === BED_STATUS.OCCUPIED).length;
        const icuPct = icuBeds.length ? Math.round((icuOccupied / icuBeds.length) * 100) : 0;

        const kpiPayload = {
          edWaitTimeMinutes: hospitalState.kpis.edWaitTimeMinutes,
          overallBedOccupancyPct: totalOccPct,
          icuOccupancyPct: icuPct,
          otUtilizationPct: 75 + Math.floor(Math.random() * 10),
          activeAlertsCount: hospitalState.alerts.filter((a) => a.status !== ALERT_STATUS.RESOLVED).length,
          pendingRecommendationsCount: hospitalState.recommendations.filter((r) => r.status === 'pending').length,
          timestamp: new Date().toISOString(),
        };

        this.emit(SOCKET_EVENTS.KPI_UPDATED, kpiPayload);
        break;
      }

      // 3. Waiting patient wait time increment
      case 2: {
        hospitalState.patients.forEach((p) => {
          if (p.status === 'waiting') {
            p.waitingTimeMinutes = (p.waitingTimeMinutes || 0) + 1;
          }
        });

        const randomWaiting = hospitalState.patients.find((p) => p.status === 'waiting');
        if (randomWaiting) {
          this.emit(SOCKET_EVENTS.PATIENT_UPDATED, {
            patientId: randomWaiting.id,
            name: randomWaiting.name,
            status: randomWaiting.status,
            acuity: randomWaiting.acuity,
            waitingTimeMinutes: randomWaiting.waitingTimeMinutes,
            timestamp: new Date().toISOString(),
          });
        }
        break;
      }

      // 4. OT Case progress / Overrun update
      case 3: {
        const ot2 = hospitalState.otRooms.find((r) => r.id === 2);
        if (ot2 && ot2.currentCase) {
          ot2.currentCase.overrunMinutes += 1;
          this.emit(SOCKET_EVENTS.OT_OVERRUN, {
            roomId: ot2.id,
            roomName: ot2.name,
            caseId: ot2.currentCase.id,
            overrunMinutes: ot2.currentCase.overrunMinutes,
            timestamp: new Date().toISOString(),
          });
        }
        break;
      }

      // 5. Staff shift / break status change
      case 4: {
        const onDutyNurses = hospitalState.staff.filter(
          (s) => s.role === 'Nurse' && (s.status === STAFF_STATUS.ON_DUTY || s.status === STAFF_STATUS.ON_BREAK)
        );
        if (onDutyNurses.length > 0) {
          const nurse = onDutyNurses[Math.floor(Math.random() * onDutyNurses.length)];
          nurse.status = nurse.status === STAFF_STATUS.ON_DUTY ? STAFF_STATUS.ON_BREAK : STAFF_STATUS.ON_DUTY;

          this.emit(SOCKET_EVENTS.DOCTOR_STATUS_CHANGED, {
            staffId: nurse.id,
            name: nurse.name,
            newStatus: nurse.status,
            department: nurse.department,
            timestamp: new Date().toISOString(),
          });
        }
        break;
      }

      default:
        break;
    }
  }
}

export const liveEmitter = new LiveEventEmitter();
