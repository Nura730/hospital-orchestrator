/**
 * @file forecast.js
 * Mock handlers for arrival forecasting, demand-capacity curves, and department occupancy.
 */

import { hospitalState } from './seed.js';
import { DEPARTMENTS, BED_STATUS } from '../../utils/constants.js';

/**
 * Get arrival forecast with confidence bands and actual vs predicted.
 * @param {object} params
 * @param {number} params.horizon - Hours (3, 6, 12, 24)
 */
export function mockGetArrivalForecast({ horizon = 6 } = {}) {
  const h = Number(horizon) || 6;
  const labels = [];
  const actual = [];
  const predicted = [];
  const upperBound = [];
  const lowerBound = [];

  const now = new Date();
  const pastSteps = Math.min(4, Math.floor(h / 2));
  const futureSteps = h;

  // Past points (actual data exists)
  for (let i = pastSteps; i >= 1; i--) {
    const d = new Date(now.getTime() - i * 3600000);
    const hourStr = d.getHours().toString().padStart(2, '0') + ':00';
    labels.push(hourStr);
    const val = 12 + Math.floor(Math.sin(i) * 5) + (i % 3);
    actual.push(val);
    predicted.push(val); // historical prediction aligned
    lowerBound.push(Math.max(0, val - 2));
    upperBound.push(val + 2);
  }

  // Current "NOW" point
  const nowStr = now.getHours().toString().padStart(2, '0') + ':00';
  labels.push(nowStr);
  const currentActual = 16;
  actual.push(currentActual);
  predicted.push(currentActual);
  lowerBound.push(currentActual - 2);
  upperBound.push(currentActual + 3);

  const nowIndex = labels.length - 1;

  // Future points (predictions only)
  for (let i = 1; i <= futureSteps; i++) {
    const d = new Date(now.getTime() + i * 3600000);
    const hourStr = d.getHours().toString().padStart(2, '0') + ':00';
    labels.push(hourStr);
    actual.push(null); // No actual data in future

    const predVal = Math.round(15 + Math.sin((now.getHours() + i) / 2) * 6 + (i * 0.8));
    predicted.push(predVal);
    const spread = Math.min(8, 2 + i * 0.8);
    lowerBound.push(Math.max(0, Math.round(predVal - spread)));
    upperBound.push(Math.round(predVal + spread));
  }

  return {
    horizon: h,
    labels,
    nowIndex,
    datasets: {
      actual,
      predicted,
      lowerBound,
      upperBound,
    },
  };
}

/**
 * Get bed demand vs capacity projection for the next 6 hours.
 */
export function mockGetDemandCapacity({ horizon = 6 } = {}) {
  const h = Number(horizon) || 6;
  const labels = [];
  const capacity = [];
  const demand = [];

  const now = new Date();
  const totalBeds = hospitalState.beds.length; // 80

  for (let i = 0; i <= h; i++) {
    const d = new Date(now.getTime() + i * 3600000);
    labels.push(i === 0 ? 'Now' : `+${i}h`);
    // Effective capacity after scheduled turnover and cleaning
    capacity.push(totalBeds - (i % 2 === 0 ? 2 : 1));
    // Demand begins around current occupancy (e.g. 68) and peaks around +3h at 82 (deficit!)
    const projectedDemand = Math.round(65 + (i * 3.2) - (i > 3 ? (i - 3) * 1.5 : 0));
    demand.push(projectedDemand);
  }

  return {
    horizon: h,
    labels,
    capacity,
    demand,
    deficitAlert: demand.some((d, idx) => d > capacity[idx]),
  };
}

/**
 * Get current department occupancy percentages for the Bar chart.
 */
export function mockGetDepartmentOccupancy() {
  const deptStats = DEPARTMENTS.map((dept) => {
    const deptBeds = hospitalState.beds.filter((b) => b.department === dept);
    const total = deptBeds.length;
    const occupied = deptBeds.filter((b) => b.status === BED_STATUS.OCCUPIED).length;
    const percentage = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return {
      department: dept,
      total,
      occupied,
      available: total - occupied,
      occupancyPercentage: percentage,
      isWarning: percentage >= 70 && percentage < 90,
      isDanger: percentage >= 90,
    };
  });

  return deptStats;
}
