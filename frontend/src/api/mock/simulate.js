/**
 * @file simulate.js
 * Mock handlers for the hospital scenario simulator and stress testing engine.
 */

import { SIMULATOR_HISTORY_MAX, RISK_LEVELS } from '../../utils/constants.js';

// In-memory simulator history (persists during session)
let simulationHistory = [
  {
    id: 'sim-init-1',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    scenarioName: 'Flu Outbreak Surge',
    inputs: { arrivalIncreasePct: 40, nursesAbsent: 4, icuBedsClosed: 1 },
    results: {
      before: { avgWaitTimeMins: 38, bedShortageCount: 0, nurseShortageCount: 1 },
      after: { avgWaitTimeMins: 52, bedShortageCount: 4, nurseShortageCount: 5 },
      projectedOccupancy6h: [75, 82, 88, 93, 91, 89],
    },
  },
];

/**
 * Execute scenario simulation.
 */
export function mockRunSimulation(params = {}) {
  const {
    arrivalIncreasePct = 0,
    nursesAbsent = 0,
    icuBedsClosed = 0,
    scenarioName = 'Custom Scenario',
  } = params;

  // Base state
  const baseWait = 38;
  const baseBedShortage = 0;
  const baseNurseShortage = 0;

  // Stress formulas
  const projectedWait = Math.round(
    baseWait + (arrivalIncreasePct * 0.45) + (nursesAbsent * 3.5) + (icuBedsClosed * 2.5)
  );
  const projectedBedShortage = Math.max(
    0,
    Math.round((arrivalIncreasePct * 0.12) + (icuBedsClosed * 1.5) - 2)
  );
  const projectedNurseShortage = Math.max(0, Math.round(nursesAbsent + (arrivalIncreasePct * 0.08) - 1));

  // 6-hour timeline
  const timeline = [];
  const baseOccupancy = 75;
  for (let i = 1; i <= 6; i++) {
    const stressFactor = (arrivalIncreasePct * 0.2) + (icuBedsClosed * 1.2);
    const occ = Math.min(100, Math.round(baseOccupancy + (i * (stressFactor / 3.5))));
    timeline.push(occ);
  }

  // Generated AI mitigation recommendation
  const generatedPlan = {
    id: `rec-sim-${Date.now().toString().slice(-4)}`,
    title: `Simulated Surge Mitigation Plan for ${scenarioName}`,
    summary: `Activate Level 2 Surge Protocol: Open 6 overflow beds in HDU Step-down, call in 4 float nurses, and pause non-urgent elective OT cases.`,
    risk: projectedBedShortage > 5 ? RISK_LEVELS.HIGH : RISK_LEVELS.MEDIUM,
    actions: [
      { type: 'activate_surge_beds', count: Math.min(8, projectedBedShortage + 2), location: 'Floor 2 Observation Unit' },
      { type: 'call_on_duty_staff', count: Math.max(2, projectedNurseShortage), shift: 'Immediate 4-hour evening extension' },
      { type: 'delay_electives', otRoom: 'OT-3', count: 2, reason: 'Preserve post-op recovery beds' },
    ],
    expectedBenefit: `Cuts projected ED wait from ${projectedWait}m down to 42m; eliminates ${projectedBedShortage} acute bed deficit.`,
  };

  const runResult = {
    id: `sim-${Date.now()}`,
    timestamp: new Date().toISOString(),
    scenarioName,
    inputs: { arrivalIncreasePct, nursesAbsent, icuBedsClosed },
    results: {
      before: {
        avgWaitTimeMins: baseWait,
        bedShortageCount: baseBedShortage,
        nurseShortageCount: baseNurseShortage,
      },
      after: {
        avgWaitTimeMins: projectedWait,
        bedShortageCount: projectedBedShortage,
        nurseShortageCount: projectedNurseShortage,
      },
      shortageSummary: {
        edWaitDeltaMins: projectedWait - baseWait,
        bedDeficit: projectedBedShortage,
        nurseDeficit: projectedNurseShortage,
        overcapacityRisk: projectedWait > 60 || projectedBedShortage > 3,
      },
      projectedOccupancy6h: timeline,
      timelineHours: ['+1h', '+2h', '+3h', '+4h', '+5h', '+6h'],
      generatedPlan,
    },
  };

  // Prepend to history, max 5 entries
  simulationHistory.unshift(runResult);
  if (simulationHistory.length > SIMULATOR_HISTORY_MAX) {
    simulationHistory = simulationHistory.slice(0, SIMULATOR_HISTORY_MAX);
  }

  return runResult;
}

/**
 * Get history of past simulation runs.
 */
export function mockGetSimulationHistory() {
  return simulationHistory;
}
