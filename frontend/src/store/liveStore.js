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

  // Predictive Flow Intelligence
  flowState: {
    bottlenecks: [],
    stateSummary: null,
    activeSimulation: null,
    dischargeCandidates: [],
    lastAnalysisAt: null,
    ambulanceIncoming: null,
    bedMap: null,
    lastAiReport: null,
    feed: [],
    predictions: {},
  },

  /** Merge a partial flowState update. */
  setFlowState: (partial) => set((state) => ({ flowState: { ...state.flowState, ...partial } })),

  /** Push an item onto the live action feed (newest first, max 20). */
  pushFlowFeed: (item) =>
    set((state) => ({
      flowState: {
        ...state.flowState,
        feed: [{ id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), ...item }, ...state.flowState.feed].slice(0, 20),
      },
    })),

  clearAmbulance: () => set((state) => ({ flowState: { ...state.flowState, ambulanceIncoming: null } })),

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
    // Each slice loads independently: one missing/failed endpoint must not fail the whole load.
    // The store is always marked initialized afterwards; otherwise useLiveData retries in a tight loop
    // and exhausts the API rate limit.
    const results = await Promise.allSettled([
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
    const value = (i) => (results[i].status === 'fulfilled' ? results[i].value?.data : undefined);
    const list = (i) => {
      const d = value(i);
      return Array.isArray(d) ? d : [];
    };
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) {
      console.warn(`Hospital state: ${failed.length} of ${results.length} initial requests failed`, failed.map((f) => f.reason?.message));
    }

    set({
      kpis: value(0)?.kpis || get().kpis,
      counts: value(0)?.counts || get().counts,
      beds: list(1),
      patients: list(2),
      staff: list(3),
      equipment: list(4),
      otRooms: list(5),
      alerts: list(6),
      recommendations: list(7),
      bottlenecks: list(8),
      isInitialized: true,
      isLoading: false,
      error: failed.length === results.length ? 'Could not load hospital state' : null,
    });
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

          // Patch the flow bed map tile as well
          let bedMap = state.flowState.bedMap;
          if (bedMap && bedId) {
            bedMap = {
              ...bedMap,
              zones: bedMap.zones.map((z) => ({
                ...z,
                tiles: z.tiles.map((t) =>
                  t.id === bedId
                    ? {
                        ...t,
                        status: status === 'maintenance' ? 'blocked' : status,
                        rawStatus: status,
                        ...(status === 'available' || status === 'cleaning'
                          ? { patientId: null, patientAlias: null, acuity: null, doctorName: null, expectedRelease: null }
                          : {}),
                        ...(status === 'cleaning' ? { cleaningSince: now } : {}),
                        ...(status === 'available' ? { lastCleanedAt: now, cleaningSince: null } : {}),
                        pulse: Date.now(),
                      }
                    : t
                ),
              })),
            };
          }
          const feedItem = bedId
            ? [{ id: `feed-${Date.now()}-${bedId}`, at: now, kind: 'bed', title: `${bedId} → ${status}`, detail: status === 'cleaning' ? 'Housekeeping notified' : status === 'reserved' ? 'Reserved for incoming patient' : status === 'available' ? 'Ready for next patient' : 'Bed status updated', impact: status === 'available' ? '+1 bed' : null }]
            : [];

          return {
            beds: updatedBeds,
            counts: {
              ...state.counts,
              occupiedBeds: occupied,
              availableBeds: available,
              cleaningBeds: cleaning,
            },
            flowState: { ...state.flowState, bedMap, feed: [...feedItem, ...state.flowState.feed].slice(0, 20) },
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
          flowState: {
            ...state.flowState,
            feed: [
              { id: `feed-${Date.now()}-${payload.id || 'rec'}`, at: now, kind: 'recommendation', title: payload.title || 'New recommendation', detail: payload.detail || payload.type || '', impact: payload.expectedImpact || null, risk: payload.risk, recommendationId: payload.id, status: payload.status },
              ...state.flowState.feed,
            ].slice(0, 20),
          },
          lastEventTimestamp: now,
        }));
        break;
      }

      // ── Predictive Flow Intelligence ──
      case SOCKET_EVENTS.FLOW_BOTTLENECK_DETECTED: {
        set((state) => ({
          flowState: {
            ...state.flowState,
            bottlenecks: payload.bottlenecks || state.flowState.bottlenecks,
            feed: [
              { id: `feed-${Date.now()}-bn`, at: now, kind: 'bottleneck', title: payload.rootCause ? `Root cause: ${payload.rootCause}` : 'Bottleneck detected', detail: payload.cascade && payload.cascade.length ? `Cascade → ${payload.cascade.join(', ')}` : 'High severity department', impact: null },
              ...state.flowState.feed,
            ].slice(0, 20),
          },
          lastEventTimestamp: now,
        }));
        break;
      }

      case SOCKET_EVENTS.FLOW_ANALYSIS_COMPLETE: {
        set((state) => ({
          flowState: {
            ...state.flowState,
            stateSummary: payload.stateSummary || state.flowState.stateSummary,
            bottlenecks: payload.bottlenecks || state.flowState.bottlenecks,
            lastAnalysisAt: payload.analyzedAt || now,
          },
          lastEventTimestamp: now,
        }));
        break;
      }

      case SOCKET_EVENTS.FLOW_DISCHARGE_NUDGE: {
        set((state) => ({
          flowState: {
            ...state.flowState,
            feed: [
              { id: `feed-${Date.now()}-${payload.patientId}`, at: now, kind: 'discharge', title: `Discharge nudge: ${payload.alias}`, detail: `Readiness ${payload.score ?? Math.round((payload.probability || 0) * 100)}/100${payload.bedId ? ` in ${payload.bedId}` : ''}`, impact: payload.bedId ? `Frees ${payload.bedId}` : null, patientId: payload.patientId },
              ...state.flowState.feed,
            ].slice(0, 20),
          },
          lastEventTimestamp: now,
        }));
        break;
      }

      case SOCKET_EVENTS.FLOW_AMBULANCE_INCOMING: {
        set((state) => ({
          flowState: {
            ...state.flowState,
            ambulanceIncoming: { ...payload, receivedAt: payload.receivedAt || now },
            feed: [
              { id: `feed-${Date.now()}-amb`, at: now, kind: 'ambulance', title: `Ambulance ETA ${payload.eta} min`, detail: `Acuity ${payload.acuity}${payload.injuryType ? `, ${payload.injuryType}` : ''}`, impact: payload.bedId ? `${payload.bedId} ${payload.bedMode === 'releasing' ? 'releasing' : 'reserved'}` : null },
              ...state.flowState.feed,
            ].slice(0, 20),
          },
          lastEventTimestamp: now,
        }));
        // Auto-clear after 60 s unless a newer ambulance replaced it
        const receivedAt = payload.receivedAt || now;
        setTimeout(() => {
          const current = get().flowState.ambulanceIncoming;
          if (current && current.receivedAt === receivedAt && !current.acknowledged) {
            set((state) => ({ flowState: { ...state.flowState, ambulanceIncoming: null } }));
          }
        }, 60000);
        break;
      }

      case SOCKET_EVENTS.FLOW_PREDICTION_UPDATED: {
        set((state) => ({
          flowState: {
            ...state.flowState,
            predictions: { ...state.flowState.predictions, [`${payload.type}:${payload.department || payload.departmentId || 'all'}`]: { ...payload, receivedAt: now } },
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
