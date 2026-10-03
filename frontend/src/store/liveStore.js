/**
 * @file liveStore.js
 * Central reactive store for all real-time hospital entities.
 * Processes granular socket events via applyEvent() to update narrow slices without full-page re-renders.
 */

import { create } from 'zustand';
import {
  getOverview,
  getBeds,
  getPatients,
  getStaff,
  getEquipment,
  getOtRooms,
  getAlerts,
  getRecommendations,
  getBottlenecks,
  getLiveKpis,
} from '../api/endpoints.js';
import {
  SOCKET_EVENTS,
  BED_STATUS,
  ALERT_STATUS,
  ALERT_SEVERITY,
  RECOMMENDATION_STATUS,
} from '../utils/constants.js';

export const useLiveStore = create((set, get) => ({
  // State slices
  kpis: {
    edWaitTimeMinutes: 38,
    edWaitTrend: '+6m vs 1h ago',
    edWaitStatus: 'warning',
    sparklineEdWait: [24, 28, 31, 29, 34, 38],

    overallBedOccupancyPct: 75,
    bedOccupancyTrend: '+2.4% vs 1h ago',
    bedOccupancyStatus: 'warning',
    sparklineBed: [68, 70, 71, 72, 72, 75],

    icuOccupancyPct: 83,
    icuOccupancyTrend: '+8.3% vs 1h ago',
    icuOccupancyStatus: 'warning',
    sparklineIcu: [66, 66, 75, 75, 83, 83],

    otUtilizationPct: 78,
    otTrend: '-3.1% vs 1h ago',
    otStatus: 'success',
    sparklineOt: [85, 82, 80, 78, 75, 78],

    staffOvertimeHours: 42.5,
    overtimeTrend: '+5.2h today',
    overtimeStatus: 'warning',
    sparklineOvertime: [20, 24, 29, 35, 39, 42.5],
  },
  counts: {
    totalBeds: 80,
    occupiedBeds: 60,
    availableBeds: 12,
    cleaningBeds: 5,
    activeAlerts: 6,
    pendingRecommendations: 3,
  },
  beds: [],
  patients: [],
  staff: [],
  equipment: [],
  otRooms: [],
  alerts: [],
  recommendations: [],
  bottlenecks: [],

  // Metadata
  isInitialized: false,
  isLoading: false,
  isConnected: false,
  lastEventTimestamp: null,
  error: null,

  setConnectionStatus: (connected) => set({ isConnected: connected }),

  /**
   * Initial data load across all operational dimensions.
   */
  fetchInitialData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [
        overviewRes,
        bedsRes,
        patientsRes,
        staffRes,
        equipmentRes,
        otRes,
        alertsRes,
        recsRes,
        bottlenecksRes,
      ] = await Promise.all([
        getOverview(),
        getBeds(),
        getPatients(),
        getStaff(),
        getEquipment(),
        getOtRooms(),
        getAlerts(),
        getRecommendations(),
        getBottlenecks(),
      ]);

      set({
        kpis: overviewRes?.data?.kpis || get().kpis,
        counts: overviewRes?.data?.counts || get().counts,
        beds: bedsRes?.data || [],
        patients: patientsRes?.data || [],
        staff: staffRes?.data || [],
        equipment: equipmentRes?.data || [],
        otRooms: otRes?.data || [],
        alerts: alertsRes?.data || [],
        recommendations: recsRes?.data || [],
        bottlenecks: bottlenecksRes?.data || [],
        isInitialized: true,
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to load hospital state:', err);
      set({ error: err.message, isLoading: false });
    }
  },

  /**
   * Apply incoming real-time socket event to the store state.
   */
  applyEvent: (event, payload) => {
    if (!payload) return;
    const now = new Date().toISOString();

    switch (event) {
      // Bed Status Updated
      case SOCKET_EVENTS.BED_UPDATED: {
        const { bedId, bedNumber, status, patientId } = payload;
        set((state) => {
          const updatedBeds = state.beds.map((b) => {
            if (b.id === bedId || b.bedNumber === bedNumber) {
              return {
                ...b,
                status,
                patientId: status === BED_STATUS.AVAILABLE ? null : patientId || b.patientId,
                lastCleanedAt: status === BED_STATUS.AVAILABLE ? now : b.lastCleanedAt,
              };
            }
            return b;
          });

          // Recalculate bed counts
          const occupied = updatedBeds.filter((b) => b.status === BED_STATUS.OCCUPIED).length;
          const available = updatedBeds.filter((b) => b.status === BED_STATUS.AVAILABLE).length;
          const cleaning = updatedBeds.filter((b) => b.status === BED_STATUS.CLEANING).length;

          return {
            beds: updatedBeds,
            counts: {
              ...state.counts,
              occupiedBeds: occupied,
              availableBeds: available,
              cleaningBeds: cleaning,
            },
            lastEventTimestamp: now,
          };
        });
        break;
      }

      // Patient Status Updated
      case SOCKET_EVENTS.PATIENT_UPDATED: {
        const { patientId, status, acuity, waitingTimeMinutes } = payload;
        set((state) => ({
          patients: state.patients.map((p) =>
            p.id === patientId
              ? {
                  ...p,
                  status: status || p.status,
                  acuity: acuity !== undefined ? acuity : p.acuity,
                  waitingTimeMinutes: waitingTimeMinutes !== undefined ? waitingTimeMinutes : p.waitingTimeMinutes,
                }
              : p
          ),
          lastEventTimestamp: now,
        }));
        break;
      }

      // Live KPIs Updated
      case SOCKET_EVENTS.KPI_UPDATED: {
        set((state) => ({
          kpis: {
            ...state.kpis,
            ...payload,
          },
          lastEventTimestamp: now,
        }));
        break;
      }

      // OT Overrun
      case SOCKET_EVENTS.OT_OVERRUN: {
        const { roomId, overrunMinutes } = payload;
        set((state) => ({
          otRooms: state.otRooms.map((room) => {
            if (room.id === Number(roomId) && room.currentCase) {
              return {
                ...room,
                currentCase: {
                  ...room.currentCase,
                  isOverrun: true,
                  overrunMinutes,
                },
              };
            }
            return room;
          }),
          lastEventTimestamp: now,
        }));
        break;
      }

      // Staff Status Changed
      case SOCKET_EVENTS.DOCTOR_STATUS_CHANGED: {
        const { staffId, newStatus } = payload;
        set((state) => ({
          staff: state.staff.map((s) => (s.id === staffId ? { ...s, status: newStatus } : s)),
          lastEventTimestamp: now,
        }));
        break;
      }

      // Alert Created
      case SOCKET_EVENTS.ALERT_CREATED: {
        set((state) => {
          const exists = state.alerts.some((a) => a.id === payload.alertId || a.id === payload.id);
          if (exists) return state;

          const newAlert = {
            id: payload.alertId || payload.id || `alt-${Date.now()}`,
            title: payload.title || 'New Operational Alert',
            description: payload.description || '',
            severity: payload.severity || ALERT_SEVERITY.HIGH,
            department: payload.department || 'Operations',
            status: ALERT_STATUS.OPEN,
            escalationLevel: payload.escalationLevel || 1,
            createdAt: now,
            updatedAt: now,
            metadata: payload.metadata || {},
          };

          return {
            alerts: [newAlert, ...state.alerts],
            counts: {
              ...state.counts,
              activeAlerts: state.counts.activeAlerts + 1,
            },
            lastEventTimestamp: now,
          };
        });
        break;
      }

      // Alert Escalated
      case SOCKET_EVENTS.ALERT_ESCALATED: {
        const { alertId, newLevel } = payload;
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === alertId ? { ...a, escalationLevel: newLevel, updatedAt: now } : a
          ),
          lastEventTimestamp: now,
        }));
        break;
      }

      // Recommendation Created
      case SOCKET_EVENTS.RECOMMENDATION_NEW: {
        set((state) => ({
          recommendations: [payload, ...state.recommendations],
          counts: {
            ...state.counts,
            pendingRecommendations: state.counts.pendingRecommendations + 1,
          },
          lastEventTimestamp: now,
        }));
        break;
      }

      default:
        break;
    }
  },

  // Optimistic UI updates
  optimisticUpdateBed: (bedId, newStatus) => {
    set((state) => ({
      beds: state.beds.map((b) => (b.id === bedId ? { ...b, status: newStatus } : b)),
    }));
  },

  optimisticAcknowledgeAlert: (alertId) => {
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === alertId ? { ...a, status: ALERT_STATUS.ACKNOWLEDGED } : a
      ),
    }));
  },

  optimisticResolveAlert: (alertId) => {
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === alertId ? { ...a, status: ALERT_STATUS.RESOLVED } : a
      ),
      counts: {
        ...state.counts,
        activeAlerts: Math.max(0, state.counts.activeAlerts - 1),
      },
    }));
  },

  optimisticApproveRec: (recId) => {
    set((state) => ({
      recommendations: state.recommendations.map((r) =>
        r.id === recId ? { ...r, status: RECOMMENDATION_STATUS.APPROVED } : r
      ),
      counts: {
        ...state.counts,
        pendingRecommendations: Math.max(0, state.counts.pendingRecommendations - 1),
      },
    }));
  },

  optimisticRejectRec: (recId, reason) => {
    set((state) => ({
      recommendations: state.recommendations.map((r) =>
        r.id === recId ? { ...r, status: RECOMMENDATION_STATUS.REJECTED, rejectionReason: reason } : r
      ),
      counts: {
        ...state.counts,
        pendingRecommendations: Math.max(0, state.counts.pendingRecommendations - 1),
      },
    }));
  },
}));
