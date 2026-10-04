/**
 * Pure-function tests for the Predictive Flow Intelligence engines (no DB required).
 */
const prediction = require('../src/services/predictionEngine.service');
const bottleneck = require('../src/services/bottleneckEngine.service');
const simulator = require('../src/services/whatIfSimulator.service');
const aiReport = require('../src/services/aiReport.service');

describe('CALC 1 forecastFromHistory', () => {
  it('weights recent weeks more and builds an 80% band', () => {
    const now = new Date('2026-10-05T10:20:00Z'); // Monday
    const target = new Date('2026-10-05T11:00:00Z');
    const history = [1, 2, 3, 4].map((w) => ({
      hour_start: new Date(target.getTime() - w * 7 * 24 * 3600 * 1000).toISOString(),
      arrivals: w === 1 ? 10 : 4, // most recent week is busier
    }));
    const f = prediction.forecastFromHistory(history, now, 1);
    expect(f.timestamps[0]).toBe(target.toISOString());
    // weights 4,3,2,1 → (10*4 + 4*3 + 4*2 + 4*1) / 10 = 6.4
    expect(f.predicted[0]).toBeCloseTo(6.4, 1);
    expect(f.lower[0]).toBeLessThan(f.predicted[0]);
    expect(f.upper[0]).toBeGreaterThan(f.predicted[0]);
    expect(f.samples[0]).toBe(4);
  });

  it('returns zeros when no history exists', () => {
    const f = prediction.forecastFromHistory([], new Date(), 3);
    expect(f.predicted).toEqual([0, 0, 0]);
  });
});

describe('CALC 2 estimateAdmissionProbability', () => {
  it('applies acuity base and factors, capped at 99%', () => {
    const day = new Date('2026-10-05T12:00:00');
    expect(prediction.estimateAdmissionProbability({ acuity: 3, arrivalTime: day }).probability).toBe(0.6);
    const night = new Date('2026-10-05T23:00:00');
    const r = prediction.estimateAdmissionProbability({ acuity: 1, requires_icu: true, requires_isolation: true, arrivalTime: night });
    expect(r.probability).toBe(0.99);
    expect(r.factors.map((f) => f.factor)).toEqual(expect.arrayContaining(['Requires ICU', 'Requires isolation']));
  });
});

describe('CALC 3 predictLosFromTable', () => {
  it('falls back to defaults with 0.5 confidence', () => {
    const r = prediction.predictLosFromTable({ acuity: 2, department_id: 1, admission_date: new Date() }, new Map());
    expect(r.predictedHours).toBe(72);
    expect(r.confidence).toBe(0.5);
  });
  it('uses historical averages and caps confidence at 0.92', () => {
    const table = new Map([['4-2', { avg_hours: 30, sample_count: 80 }]]);
    const r = prediction.predictLosFromTable({ acuity: 4, department_id: 2, admission_date: new Date() }, table);
    expect(r.predictedHours).toBe(30);
    expect(r.confidence).toBe(0.92);
  });
});

describe('CALC 5 scoreDischargeReadiness', () => {
  it('scores a fully ready patient at 100 and keeps admin tasks as blockers', () => {
    const now = new Date();
    const r = prediction.scoreDischargeReadiness(
      {
        acuity: 5,
        requires_imaging: false,
        expected_discharge: new Date(now.getTime() + 3600 * 1000),
        discharge_date: new Date(now.getTime() + 2 * 3600 * 1000),
        pending_tasks: ['Transport not booked'],
      },
      now
    );
    expect(r.score).toBe(100);
    expect(r.probability).toBe(1);
    expect(r.blockingFactors).toEqual(['Transport not booked']);
  });
  it('lists clinical blockers for an unstable patient', () => {
    const r = prediction.scoreDischargeReadiness({ acuity: 2, requires_imaging: true, pending_tasks: [] });
    expect(r.score).toBe(0);
    expect(r.blockingFactors.length).toBe(4);
  });
});

describe('bottleneck chain walk', () => {
  it('worst severity wins: earliest HIGH department is root cause, contiguous non-LOW after it are cascade', () => {
    const r = bottleneck.walkChain([
      { department: 'Emergency', severity: 'LOW' },
      { department: 'Radiology', severity: 'LOW' },
      { department: 'General Ward', severity: 'MEDIUM' },
      { department: 'HDU', severity: 'LOW' },
      { department: 'ICU', severity: 'HIGH' },
      { department: 'OT', severity: 'HIGH' },
    ]);
    expect(r.rootCause).toBe('ICU');
    expect(r.cascade).toEqual(['OT']);
  });

  it('a LOW department breaks the cascade; all LOW means no root cause', () => {
    const r = bottleneck.walkChain([
      { department: 'Emergency', severity: 'MEDIUM' },
      { department: 'Radiology', severity: 'MEDIUM' },
      { department: 'General Ward', severity: 'LOW' },
      { department: 'HDU', severity: 'MEDIUM' },
    ]);
    expect(r.rootCause).toBe('Emergency');
    expect(r.cascade).toEqual(['Radiology']);
    expect(bottleneck.walkChain([{ department: 'ICU', severity: 'LOW' }]).rootCause).toBeNull();
  });

  it('generates cleaning, discharge and transfer actions', () => {
    const all = [
      { department: 'ICU', utilization: 0.95, capacity: 12, occupied: 11, cleaning: 3, dischargeReady: 2, nursesOnShift: 5, available: 0 },
      { department: 'HDU', utilization: 0.5, capacity: 8, occupied: 4, cleaning: 0, dischargeReady: 0, nursesOnShift: 2, available: 4 },
    ];
    const actions = bottleneck.generateRecommendedActions(all[0], all);
    const types = actions.map((a) => a.type);
    expect(types).toEqual(expect.arrayContaining(['cleaning', 'discharge', 'transfer']));
    expect(actions.find((a) => a.type === 'transfer').text).toMatch(/to HDU/);
  });
});

describe('what-if simulator', () => {
  const baseline = {
    totalBeds: 79,
    currentPatients: 60,
    dirtyBeds: 5,
    dischargeReadyCount: 3,
    icuTotal: 12,
    icuOccupied: 11,
    icuShare: 0.12,
    totalNurses: 18,
    floatAvailable: 2,
    forecastArrivals: 30,
    admissionRate: 0.35,
    avgServiceTimeMin: 30,
    dischargeRatePerHour: 2,
    electiveOtCases: 1,
    baselineWaitMin: 30,
    horizonHours: 6,
  };

  it('scenario C is never worse than A and is recommended', () => {
    const r = simulator.simulateScenarios(baseline, { arrivalIncreasePct: 40, nursesAbsent: 2, icuBedsClosed: 0 });
    expect(r.recommendedScenario).toBe('C');
    expect(r.scenarioC.avgWaitMin).toBeLessThanOrEqual(r.scenarioB.avgWaitMin);
    expect(r.scenarioB.avgWaitMin).toBeLessThanOrEqual(r.scenarioA.avgWaitMin);
    expect(r.scenarioA.avgWaitMin).toBeGreaterThan(r.scenarioC.avgWaitMin);
    expect(r.expectedWaitReduction).toBe(`${r.scenarioA.avgWaitMin} min to ${r.scenarioC.avgWaitMin} min`);
    expect(r.actions.length).toBeGreaterThan(0);
  });

  it('clamps inputs to the baseline', () => {
    const r = simulator.simulateScenarios(baseline, { arrivalIncreasePct: 0, nursesAbsent: 99, icuBedsClosed: 99 });
    expect(r.params.nursesAbsent).toBe(18);
    expect(r.params.icuBedsClosed).toBe(12);
  });
});

describe('AI report local template', () => {
  it('produces all six sections from a snapshot without inventing data', () => {
    const r = aiReport.localTemplate({
      scope: 'admin',
      occupancy: { pct: 76, occupied: 60, capacity: 79 },
      icu: { pct: 92, occupied: 11, total: 12 },
      departments: [{ department: 'General Ward', utilizationPct: 83, predicted2hPct: 85, predicted4hPct: 88, gap2hBeds: -5, gap4hBeds: -3, severity: 'MEDIUM' }],
      dirtyBeds: 5,
      dischargeReady: 3,
      bottleneck: { rootCause: 'General Ward', cascade: ['ICU', 'OT'] },
      thresholds: { warn: 0.75, danger: 0.88, source: 'auto' },
      topActions: [{ action: 'Expedite discharge for 3 medically ready patients', impact: '+3 beds' }],
      lastSimulation: null,
    });
    expect(r.provider).toBe('local-template');
    for (const h of ['Situation summary', 'Key numbers', 'Root cause and cascade', 'Predicted next 2-4 hours', 'Recommended actions', 'Risks and confidence']) {
      expect(r.reportText).toContain(h);
    }
    expect(r.reportText).toContain('General Ward');
  });
});
