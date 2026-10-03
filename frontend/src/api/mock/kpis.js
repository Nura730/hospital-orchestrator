/**
 * @file kpis.js
 * Mock handlers for master KPIs, live metrics polling, and historical analytics.
 */

import { hospitalState } from './seed.js';
import { BED_STATUS, ALERT_STATUS, RECOMMENDATION_STATUS } from '../../utils/constants.js';

/**
 * Get master operational overview.
 */
export function mockGetOverview() {
  const beds = hospitalState.beds;
  const occupiedBeds = beds.filter((b) => b.status === BED_STATUS.OCCUPIED).length;
  const icuBeds = beds.filter((b) => b.department === 'ICU');
  const icuOccupied = icuBeds.filter((b) => b.status === BED_STATUS.OCCUPIED).length;

  const totalOccupancy = Math.round((occupiedBeds / beds.length) * 100);
  const icuOccupancy = icuBeds.length > 0 ? Math.round((icuOccupied / icuBeds.length) * 100) : 0;

  // Active OT utilization
  const totalOt = hospitalState.otRooms.length;
  const inUseOt = hospitalState.otRooms.filter((r) => r.status === 'in_use').length;
  const otUtil = Math.round((inUseOt / totalOt) * 100);

  const activeAlerts = hospitalState.alerts.filter((a) => a.status !== ALERT_STATUS.RESOLVED).length;
  const pendingRecs = hospitalState.recommendations.filter((r) => r.status === RECOMMENDATION_STATUS.PENDING).length;

  return {
    kpis: {
      edWaitTimeMinutes: hospitalState.kpis.edWaitTimeMinutes,
      edWaitTrend: '+6m vs 1h ago',
      edWaitStatus: 'warning',
      sparklineEdWait: [24, 28, 31, 29, 34, 38],

      overallBedOccupancyPct: totalOccupancy,
      bedOccupancyTrend: '+2.4% vs 1h ago',
      bedOccupancyStatus: totalOccupancy >= 90 ? 'danger' : totalOccupancy >= 70 ? 'warning' : 'success',
      sparklineBed: [68, 70, 71, 72, 72, totalOccupancy],

      icuOccupancyPct: icuOccupancy,
      icuOccupancyTrend: '+8.3% vs 1h ago',
      icuOccupancyStatus: icuOccupancy >= 90 ? 'danger' : icuOccupancy >= 75 ? 'warning' : 'success',
      sparklineIcu: [66, 66, 75, 75, 83, icuOccupancy],

      otUtilizationPct: otUtil,
      otTrend: '-3.1% vs 1h ago',
      otStatus: 'success',
      sparklineOt: [85, 82, 80, 78, 75, otUtil],

      staffOvertimeHours: hospitalState.kpis.staffOvertimeHours,
      overtimeTrend: '+5.2h today',
      overtimeStatus: 'warning',
      sparklineOvertime: [20, 24, 29, 35, 39, 42.5],
    },
    counts: {
      totalBeds: beds.length,
      occupiedBeds,
      availableBeds: beds.filter((b) => b.status === BED_STATUS.AVAILABLE).length,
      cleaningBeds: beds.filter((b) => b.status === BED_STATUS.CLEANING).length,
      activeAlerts,
      pendingRecommendations: pendingRecs,
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get lightweight live KPIs for polling or socket sync.
 */
export function mockGetLiveKpis() {
  const overview = mockGetOverview();
  return {
    edWaitTimeMinutes: overview.kpis.edWaitTimeMinutes,
    overallBedOccupancyPct: overview.kpis.overallBedOccupancyPct,
    icuOccupancyPct: overview.kpis.icuOccupancyPct,
    otUtilizationPct: overview.kpis.otUtilizationPct,
    activeAlertsCount: overview.counts.activeAlerts,
    pendingRecommendationsCount: overview.counts.pendingRecommendations,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get analytics comparison: Manual Baseline vs AI System Orchestration.
 */
export function mockGetAnalyticsBaseline() {
  return {
    metrics: [
      { metric: 'Avg ED Wait (mins)', baseline: 64, system: 38, improvementPct: 40.6, unit: 'mins' },
      { metric: 'Bed Overflow Incidents', baseline: 14, system: 2, improvementPct: 85.7, unit: 'events' },
      { metric: 'Staff Overtime (hrs/wk)', baseline: 112, system: 42.5, improvementPct: 62.0, unit: 'hrs' },
      { metric: 'OT Turnover Idle Time (mins)', baseline: 48, system: 24, improvementPct: 50.0, unit: 'mins' },
    ],
    acceptanceRate: {
      labels: ['6 Days Ago', '5 Days Ago', '4 Days Ago', '3 Days Ago', '2 Days Ago', 'Yesterday', 'Today'],
      rates: [78, 81, 85, 84, 89, 91, 94],
    },
    safety: {
      unsafeRecommendationsDetected: 0,
      overrideRatePct: 4.8,
      totalRecommendationsExecuted: 142,
    },
  };
}
