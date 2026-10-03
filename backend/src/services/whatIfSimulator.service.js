/**
 * What-If simulator. Baseline numbers come from the DB; the scenario math is pure JS
 * (simulateScenarios) so it can be unit tested and reproduced exactly.
 */
const db = require('../config/db');
const flowRepo = require('../repositories/flow.repo');
const prediction = require('./predictionEngine.service');
const { SAFE_PATIENTS_PER_NURSE } = require('../config/constants');

const AVG_SERVICE_TIME_MIN = 30; // average ED treatment slot per patient
const SIM_HORIZON_HOURS = 6;

/** Gather the live baseline the simulation starts from. */
async function getBaseline() {
  const [totals, staffing, floatPool, candidates, ed, latestKpi] = await Promise.all([
    flowRepo.getHospitalBedTotals(),
    flowRepo.getNurseStaffing(),
    flowRepo.getFloatPool(),
    prediction.getDischargeCandidates(),
    flowRepo.getDepartmentByName('Emergency'),
    flowRepo.getLatestKpiSnapshot(),
  ]);

  const forecast = await prediction.forecastArrivals(ed ? ed.id : null, SIM_HORIZON_HOURS);
  const forecastArrivals = forecast.predicted.reduce((s, v) => s + v, 0);

  const dischargeRes = await db.query(
    `SELECT COALESCE(SUM(COALESCE(release_confidence, 0.7)), 0)::float AS expected
     FROM beds WHERE status = 'occupied' AND expected_release_time <= NOW() + INTERVAL '${SIM_HORIZON_HOURS} hours'`
  );
  const histDischarges = await db.query(
    `SELECT COUNT(*)::int AS n FROM patients WHERE status = 'discharged' AND discharge_date >= NOW() - INTERVAL '7 days'`
  );
  const expectedDischarges = dischargeRes.rows[0].expected;
  // Beds freed per hour: predicted releases in the window plus the 7-day discharge run-rate
  const dischargeRatePerHour = Math.max(
    1,
    expectedDischarges / SIM_HORIZON_HOURS + histDischarges.rows[0].n / (7 * 24)
  );

  const electiveRes = await db.query(
    `SELECT COUNT(*)::int AS n FROM ot_cases
     WHERE status IN ('scheduled', 'delayed') AND urgency = 'elective' AND post_op_bed_required
       AND scheduled_start BETWEEN NOW() AND NOW() + INTERVAL '${SIM_HORIZON_HOURS} hours'`
  );
  const icuShareRes = await db.query(
    `SELECT COALESCE(SUM(high_acuity)::float / NULLIF(SUM(arrivals), 0), 0.12) AS share
     FROM arrivals_history WHERE hour_start >= NOW() - INTERVAL '28 days'`
  );

  const totalNurses = staffing.reduce((s, d) => s + d.nurses_on_shift, 0);
  const floatAvailable = floatPool.filter((f) => f.on_shift).length;

  return {
    totalBeds: totals.capacity,
    currentPatients: totals.occupied,
    dirtyBeds: totals.cleaning,
    dischargeReadyCount: candidates.readyCount,
    icuTotal: totals.icu_total - totals.icu_maintenance,
    icuOccupied: totals.icu_occupied,
    icuShare: Math.min(0.5, Number(icuShareRes.rows[0].share) || 0.12),
    totalNurses,
    floatAvailable,
    forecastArrivals: Math.round(forecastArrivals * 10) / 10,
    admissionRate: forecast.historicalAdmissionRate || 0.35,
    avgServiceTimeMin: AVG_SERVICE_TIME_MIN,
    dischargeRatePerHour: Math.round(dischargeRatePerHour * 10) / 10,
    electiveOtCases: electiveRes.rows[0].n,
    baselineWaitMin: latestKpi && latestKpi.avg_wait_minutes ? Number(latestKpi.avg_wait_minutes) : null,
    horizonHours: SIM_HORIZON_HOURS,
  };
}

function scenario(label, b, p, { extraBeds = 0, extraNurses = 0, deferredElective = 0 }) {
  const effectiveCapacity = b.totalBeds - p.icuBedsClosed + extraBeds;
  const effectiveStaff = Math.max(0, b.totalNurses - p.nursesAbsent + extraNurses);
  const safeCapacity = effectiveStaff * SAFE_PATIENTS_PER_NURSE;
  const surgeArrivals = b.forecastArrivals * (1 + p.arrivalIncreasePct / 100);
  const demand = b.currentPatients + surgeArrivals * b.admissionRate - deferredElective;
  const supply = Math.min(effectiveCapacity, safeCapacity);

  const avgWaitMin = Math.max(0, ((demand - supply) * b.avgServiceTimeMin) / Math.max(1, b.dischargeRatePerHour));
  const bedShortage = Math.max(0, Math.ceil(demand - effectiveCapacity));
  const nurseShortage = Math.max(0, Math.ceil(demand / SAFE_PATIENTS_PER_NURSE - effectiveStaff));
  const icuCapacity = Math.max(0, b.icuTotal - p.icuBedsClosed);
  const icuDemand = b.icuOccupied + surgeArrivals * b.icuShare * b.admissionRate;
  const icuOverflow = Math.max(0, Math.ceil(icuDemand - icuCapacity));

  return {
    label,
    avgWaitMin: Math.round(avgWaitMin),
    bedShortage,
    nurseShortage,
    icuOverflow,
    effectiveCapacity,
    effectiveStaff,
    safeCapacity,
    demand: Math.round(demand * 10) / 10,
    supply,
    extraBeds,
    extraNurses,
    deferredElective,
  };
}

/**
 * Pure three-scenario simulation.
 * @param {object} b baseline from getBaseline()
 * @param {{ arrivalIncreasePct: number, nursesAbsent: number, icuBedsClosed: number }} params
 */
function simulateScenarios(b, params) {
  const p = {
    arrivalIncreasePct: Math.max(0, Math.min(200, Number(params.arrivalIncreasePct) || 0)),
    nursesAbsent: Math.max(0, Math.min(b.totalNurses, Number(params.nursesAbsent) || 0)),
    icuBedsClosed: Math.max(0, Math.min(b.icuTotal, Number(params.icuBedsClosed) || 0)),
  };

  const scenarioA = scenario('Do Nothing', b, p, {});

  const scenarioB = scenario('Partial Action', b, p, {
    extraBeds: Math.floor(b.dirtyBeds * 0.5),
    extraNurses: Math.min(1, b.floatAvailable),
  });

  // Full orchestration: all dirty beds + all discharge-ready, optimal float nurses, defer elective OT if still short
  const fullBeds = b.dirtyBeds + b.dischargeReadyCount;
  const probe = scenario('probe', b, p, { extraBeds: fullBeds });
  const neededNurses = Math.max(0, Math.ceil(probe.demand / SAFE_PATIENTS_PER_NURSE) - probe.effectiveStaff);
  const floatNurses = Math.min(neededNurses, b.floatAvailable);
  let scenarioC = scenario('Full Orchestration', b, p, { extraBeds: fullBeds, extraNurses: floatNurses });
  if ((scenarioC.bedShortage > 0 || scenarioC.avgWaitMin > 0) && b.electiveOtCases > 0) {
    scenarioC = scenario('Full Orchestration', b, p, {
      extraBeds: fullBeds,
      extraNurses: floatNurses,
      deferredElective: b.electiveOtCases,
    });
  }

  // Baseline triage wait (current measured ED wait) applies to every scenario
  const base = b.baselineWaitMin != null ? Math.round(b.baselineWaitMin * (1 + p.arrivalIncreasePct / 200)) : 0;
  for (const s of [scenarioA, scenarioB, scenarioC]) {
    s.queueWaitMin = s.avgWaitMin;
    s.avgWaitMin = s.avgWaitMin + base;
  }

  const actions = [];
  if (b.dirtyBeds > 0) {
    actions.push({ type: 'cleaning', text: `Prioritize cleaning of ${b.dirtyBeds} dirty beds`, impact: `+${b.dirtyBeds} beds`, count: b.dirtyBeds });
  }
  if (b.dischargeReadyCount > 0) {
    actions.push({ type: 'discharge', text: `Expedite discharge for ${b.dischargeReadyCount} medically ready patients`, impact: `+${b.dischargeReadyCount} beds`, count: b.dischargeReadyCount });
  }
  if (floatNurses > 0) {
    actions.push({ type: 'staffing', text: `Deploy ${floatNurses} float nurse${floatNurses > 1 ? 's' : ''} to the busiest wards`, impact: `+${floatNurses * SAFE_PATIENTS_PER_NURSE} safe patient slots`, count: floatNurses });
  }
  if (scenarioC.deferredElective > 0) {
    actions.push({ type: 'defer_ot', text: `Defer ${scenarioC.deferredElective} elective OT case${scenarioC.deferredElective > 1 ? 's' : ''} needing post-op beds`, impact: `-${scenarioC.deferredElective} bed demand`, count: scenarioC.deferredElective });
  }

  const reductionPct = scenarioA.avgWaitMin > 0 ? Math.round(((scenarioA.avgWaitMin - scenarioC.avgWaitMin) / scenarioA.avgWaitMin) * 100) : 0;

  return {
    params: p,
    baseline: b,
    scenarioA,
    scenarioB,
    scenarioC,
    recommendedScenario: 'C',
    actions,
    expectedWaitReduction: `${scenarioA.avgWaitMin} min to ${scenarioC.avgWaitMin} min`,
    waitReductionPct: reductionPct,
  };
}

/** Run with live baseline and persist to simulation_runs. */
async function runSimulation(params, user) {
  const baseline = await getBaseline();
  const result = simulateScenarios(baseline, params);
  const res = await db.query(
    `INSERT INTO simulation_runs (params, result, created_by) VALUES ($1, $2, $3) RETURNING id, created_at`,
    [JSON.stringify(result.params), JSON.stringify(result), user ? user.id : null]
  );
  return { id: res.rows[0].id, createdAt: res.rows[0].created_at, ...result };
}

async function getHistory(limit = 5) {
  const res = await db.query(
    `SELECT s.id, s.params, s.result, s.applied, s.created_at, u.full_name AS created_by_name
     FROM simulation_runs s LEFT JOIN users u ON u.id = s.created_by
     ORDER BY s.created_at DESC LIMIT $1`,
    [Math.max(1, Math.min(50, Number(limit) || 5))]
  );
  return res.rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    createdBy: r.created_by_name,
    applied: r.applied,
    params: r.params,
    scenarioA: r.result.scenarioA,
    scenarioB: r.result.scenarioB,
    scenarioC: r.result.scenarioC,
    actions: r.result.actions,
    expectedWaitReduction: r.result.expectedWaitReduction,
    waitReductionPct: r.result.waitReductionPct,
  }));
}

async function getRun(id) {
  const res = await db.query('SELECT * FROM simulation_runs WHERE id = $1', [id]);
  return res.rows[0] || null;
}

module.exports = {
  getBaseline,
  simulateScenarios,
  runSimulation,
  getHistory,
  getRun,
};
