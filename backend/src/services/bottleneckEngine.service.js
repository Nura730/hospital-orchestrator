/**
 * Bottleneck engine — walks the patient-flow dependency chain to find the ROOT CAUSE
 * department and the downstream CASCADE, then produces concrete recommended actions.
 */
const db = require('../config/db');
const flowRepo = require('../repositories/flow.repo');
const flowConfig = require('../config/flowConfig');
const prediction = require('./predictionEngine.service');
const { DEPENDENCY_CHAIN, FLOW_SEVERITY, SAFE_PATIENTS_PER_NURSE } = require('../config/constants');

const CACHE_TTL_MS = 5000;
let cache = { at: 0, value: null, pending: null };

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

function invalidateCache() {
  cache = { at: 0, value: null, pending: null };
}

function classifySeverity(utilization, predictedGap) {
  if (utilization > flowConfig.BOTTLENECK_DANGER_THRESHOLD || predictedGap > 0) return FLOW_SEVERITY.HIGH;
  if (utilization > flowConfig.BOTTLENECK_WARN_THRESHOLD) return FLOW_SEVERITY.MEDIUM;
  return FLOW_SEVERITY.LOW;
}

const SEVERITY_RANK = { [FLOW_SEVERITY.LOW]: 0, [FLOW_SEVERITY.MEDIUM]: 1, [FLOW_SEVERITY.HIGH]: 2 };

/**
 * Pure chain walk.
 * Root cause = the earliest department in the chain at the worst severity present (a HIGH department
 * outranks an earlier MEDIUM one). Cascade = the unbroken run of non-LOW departments right after it;
 * a LOW department breaks the chain, because flow recovers there.
 * @param {{department: string, severity: string}[]} depts in DEPENDENCY_CHAIN order
 */
function walkChain(depts) {
  const worst = Math.max(0, ...depts.map((d) => SEVERITY_RANK[d.severity] || 0));
  const rootIdx = worst > 0 ? depts.findIndex((d) => (SEVERITY_RANK[d.severity] || 0) === worst) : -1;
  const rootCause = rootIdx >= 0 ? depts[rootIdx].department : null;
  const cascade = [];
  for (let i = rootIdx + 1; rootIdx >= 0 && i < depts.length && depts[i].severity !== FLOW_SEVERITY.LOW; i++) {
    cascade.push(depts[i].department);
  }
  return { rootCause, cascade, rootIdx };
}

/** Collect the per-department context the engine and actions need in a few queries. */
async function gatherContext() {
  const [bedStats, otStats, staffing, candidates, upcomingOt, arrivalAvg] = await Promise.all([
    flowRepo.getDepartmentBedStats(),
    flowRepo.getOtRoomStats(),
    flowRepo.getNurseStaffing(),
    prediction.getDischargeCandidates(),
    db.query(`
      SELECT COUNT(*)::int AS n,
             COUNT(*) FILTER (WHERE post_op_bed_required)::int AS needing_beds
      FROM ot_cases
      WHERE status IN ('scheduled', 'delayed') AND scheduled_start BETWEEN NOW() AND NOW() + INTERVAL '2 hours'
    `),
    db.query(`
      SELECT department_id, AVG(arrivals)::float AS avg_hourly
      FROM arrivals_history WHERE hour_start >= NOW() - INTERVAL '28 days'
      GROUP BY department_id
    `),
  ]);
  const avgArrivals = new Map(arrivalAvg.rows.map((r) => [r.department_id, r.avg_hourly]));
  const byName = new Map(bedStats.map((d) => [d.name, d]));
  const staffByDept = new Map(staffing.map((s) => [s.department_id, s]));
  const readyByDept = new Map();
  for (const c of candidates.candidates) {
    if (!c.ready) continue;
    readyByDept.set(c.departmentId, (readyByDept.get(c.departmentId) || 0) + 1);
  }
  return { byName, otStats, staffByDept, readyByDept, candidates, upcomingOt: upcomingOt.rows[0], avgArrivals };
}

async function computeDepartment(name, ctx) {
  if (name === 'OT') {
    const ot = ctx.otStats;
    const capacity = ot.capacity || 0;
    const busy = ot.in_surgery + ot.cleaning + ot.reserved;
    const utilization = capacity > 0 ? round(busy / capacity) : 0;
    const predictedGap = Math.max(0, busy + (ctx.upcomingOt.n || 0) * 0.5 - capacity);
    const dept = await flowRepo.getDepartmentByName('OT');
    return {
      department: 'OT',
      departmentId: dept ? dept.id : null,
      floor: dept ? dept.floor : null,
      capacity,
      occupied: busy,
      inSurgery: ot.in_surgery,
      cleaning: ot.cleaning,
      reserved: ot.reserved,
      available: ot.available,
      utilization,
      predictedGap: round(predictedGap, 1),
      predicted: {
        1: utilization,
        2: capacity > 0 ? round(Math.min(1.5, (busy + (ctx.upcomingOt.n || 0) * 0.5) / capacity)) : 0,
        // Theatre lists rarely run 4 h ahead of plan; carry the 2 h view forward instead of resetting to now
        4: capacity > 0 ? round(Math.min(1.5, (busy + (ctx.upcomingOt.n || 0) * 0.5) / capacity)) : 0,
      },
      dischargeReady: 0,
      nursesOnShift: (ctx.staffByDept.get(dept && dept.id) || {}).nurses_on_shift || 0,
      upcomingCases: ctx.upcomingOt.n,
    };
  }

  const d = ctx.byName.get(name);
  if (!d) return null;
  const utilization = d.capacity > 0 ? round(d.occupied / d.capacity) : 0;
  let demand = [];
  try {
    demand = await prediction.projectBedDemandAll(d.id, [1, 2, 4]);
  } catch {
    demand = [];
  }
  const at = (h) => demand.find((x) => x.horizon === h);
  const staff = ctx.staffByDept.get(d.id) || {};
  return {
    department: name,
    departmentId: d.id,
    floor: d.floor,
    capacity: d.capacity,
    occupied: d.occupied,
    cleaning: d.cleaning,
    reserved: d.reserved,
    available: d.available,
    utilization,
    predictedGap: at(2) ? at(2).gap : 0,
    predicted: {
      1: at(1) ? at(1).predictedUtilization : utilization,
      2: at(2) ? at(2).predictedUtilization : utilization,
      4: at(4) ? at(4).predictedUtilization : utilization,
    },
    demand,
    dischargeReady: ctx.readyByDept.get(d.id) || 0,
    nursesOnShift: staff.nurses_on_shift || 0,
    floatOnShift: staff.float_on_shift || 0,
    expectedArrivals2h: at(2) ? at(2).expectedArrivals : 0,
    expectedAdmissions2h: at(2) ? at(2).expectedAdmissions : 0,
    typicalArrivals2h: (ctx.avgArrivals.get(d.id) || 0) * 2,
  };
}

/**
 * Turn one department's situation into concrete actions.
 * @param {object} b department result (with severity)
 * @param {object[]} all every department in chain order
 */
function generateRecommendedActions(b, all) {
  const actions = [];
  const idx = all.findIndex((x) => x.department === b.department);
  const next = idx >= 0 ? all[idx + 1] : null;

  if (b.cleaning > 2) {
    actions.push({
      type: 'cleaning',
      department: b.department,
      count: b.cleaning,
      text: `Prioritize cleaning of ${b.cleaning} empty beds in ${b.department}`,
      impact: `+${b.cleaning} beds within ~45 min`,
      why: `${b.cleaning} beds in ${b.department} are in 'cleaning' status (rule: more than 2 dirty beds)`,
    });
  }
  if (b.dischargeReady > 0) {
    actions.push({
      type: 'discharge',
      department: b.department,
      count: b.dischargeReady,
      text: `Expedite discharge for ${b.dischargeReady} medically ready patients`,
      impact: `+${b.dischargeReady} beds within ~2h`,
      why: `${b.dischargeReady} patients score at or above ${Math.round(flowConfig.DISCHARGE_NUDGE_THRESHOLD * 100)}% discharge readiness (acuity ≥4, no imaging, expected discharge <4h, date set)`,
    });
  }
  if (b.utilization > 0.9) {
    // Downstream department first; ICU may also step down to the department before it (HDU)
    const prev = idx > 0 ? all[idx - 1] : null;
    const target = [next, b.department === 'ICU' ? prev : null].find(
      (t) => t && t.department !== 'OT' && t.utilization < 0.7 && t.capacity > 0
    );
    if (target) {
      const n = Math.max(1, Math.min(target.available || 1, Math.ceil(b.occupied - 0.85 * b.capacity)));
      actions.push({
        type: 'transfer',
        department: b.department,
        targetDepartment: target.department,
        count: n,
        text: `Move ${n} stable patient${n > 1 ? 's' : ''} to ${target.department}`,
        impact: `${b.department} utilization -${Math.round((n / Math.max(1, b.capacity)) * 100)} pts`,
        why: `${b.department} is at ${Math.round(b.utilization * 100)}% (rule: >90%) while ${target.department} is at ${Math.round(target.utilization * 100)}% (rule: <70%) with ${target.available} free beds`,
      });
    }
  }
  // Surge = next-2h forecast at least 25% above this department's 4-week average for 2 hours
  if (b.typicalArrivals2h > 0 && b.expectedArrivals2h > b.typicalArrivals2h * 1.25 && b.expectedAdmissions2h >= 1) {
    const n = Math.max(1, Math.round(b.expectedAdmissions2h * 0.5));
    actions.push({
      type: 'reserve',
      department: b.department,
      count: n,
      text: `Reserve ${n} bed${n > 1 ? 's' : ''} for incoming high-acuity patients`,
      impact: `Avoids ~${n * 20} min boarding delay`,
      why: `Forecast ${b.expectedArrivals2h} arrivals in 2h vs a 4-week average of ${Math.round(b.typicalArrivals2h * 10) / 10} (rule: >25% above average)`,
    });
  }
  if (b.department !== 'OT' && b.nursesOnShift > 0) {
    const ratio = b.occupied / b.nursesOnShift;
    if (ratio > SAFE_PATIENTS_PER_NURSE) {
      const donor = all
        .filter((x) => x.department !== b.department && x.department !== 'OT' && x.nursesOnShift > 1)
        .map((x) => ({ ...x, ratio: x.occupied / x.nursesOnShift }))
        .sort((a, c) => a.ratio - c.ratio)[0];
      if (donor && donor.ratio < SAFE_PATIENTS_PER_NURSE - 1) {
        actions.push({
          type: 'staffing',
          department: b.department,
          sourceDepartment: donor.department,
          count: 1,
          text: `Reassign a nurse from ${donor.department} to ${b.department}`,
          impact: `Nurse ratio 1:${ratio.toFixed(1)} → 1:${(b.occupied / (b.nursesOnShift + 1)).toFixed(1)}`,
          why: `${b.department} has 1 nurse per ${ratio.toFixed(1)} patients (safe limit 1:${SAFE_PATIENTS_PER_NURSE}); ${donor.department} runs at 1:${donor.ratio.toFixed(1)}`,
        });
      }
    }
  }
  return actions.map((a, i) => ({ id: `${b.department}-${a.type}-${i}`.replace(/\s+/g, '_'), ...a }));
}

async function computeBottlenecks() {
  const ctx = await gatherContext();
  const depts = [];
  for (const name of DEPENDENCY_CHAIN) {
    const d = await computeDepartment(name, ctx);
    if (d) depts.push({ ...d, severity: classifySeverity(d.utilization, d.predictedGap) });
  }
  const { rootCause, cascade } = walkChain(depts);
  const result = depts.map((d) => ({
    ...d,
    rootCause: d.department === rootCause,
    isCascade: cascade.includes(d.department),
    cascade: d.department === rootCause ? cascade : [],
    recommendedActions: generateRecommendedActions(d, depts),
  }));
  return {
    analyzedAt: new Date().toISOString(),
    thresholds: {
      warn: flowConfig.BOTTLENECK_WARN_THRESHOLD,
      danger: flowConfig.BOTTLENECK_DANGER_THRESHOLD,
      source: flowConfig.thresholdSource,
    },
    rootCause,
    cascade,
    departments: result,
    dischargeCandidates: ctx.candidates,
  };
}

/**
 * detectBottlenecks() — cached for 5 s so concurrent dashboards share one computation.
 * @param {{ force?: boolean }} opts
 */
async function detectBottlenecks({ force = false } = {}) {
  if (!force && cache.value && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  if (!force && cache.pending) return cache.pending;
  cache.pending = computeBottlenecks()
    .then((value) => {
      cache = { at: Date.now(), value, pending: null };
      return value;
    })
    .catch((err) => {
      cache.pending = null;
      throw err;
    });
  return cache.pending;
}

/** Spec-shaped list: [{ department, utilization, predictedGap, severity, rootCause, cascade[], recommendedActions[] }] */
function toBottleneckList(analysis) {
  return analysis.departments.map((d) => ({
    department: d.department,
    departmentId: d.departmentId,
    floor: d.floor,
    capacity: d.capacity,
    occupied: d.occupied,
    cleaning: d.cleaning,
    available: d.available,
    utilization: d.utilization,
    predicted: d.predicted,
    predictedGap: d.predictedGap,
    severity: d.severity,
    rootCause: d.rootCause,
    isCascade: d.isCascade,
    cascade: d.cascade,
    nursesOnShift: d.nursesOnShift,
    dischargeReady: d.dischargeReady,
    recommendedActions: d.recommendedActions,
  }));
}

module.exports = {
  classifySeverity,
  walkChain,
  generateRecommendedActions,
  detectBottlenecks,
  toBottleneckList,
  invalidateCache,
};
