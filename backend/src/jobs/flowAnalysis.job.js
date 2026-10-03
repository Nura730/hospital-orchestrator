/**
 * Flow analysis job — runs every FLOW_ANALYSIS_INTERVAL_MS.
 * 1 detectBottlenecks  2 dedupe alerts for HIGH  3 projectBedDemand for all departments
 * 4 dirty beds > 2 → cleaning alert  5 discharge-ready → nudge notifications
 * 6 emit flow.analysisComplete  7 write predictions (+ kpi_snapshots when stale)
 */
const db = require('../config/db');
const flowRepo = require('../repositories/flow.repo');
const flowConfig = require('../config/flowConfig');
const emitter = require('../sockets/emitter');
const logger = require('../utils/logger');
const prediction = require('../services/predictionEngine.service');
const bottleneck = require('../services/bottleneckEngine.service');
const dashboard = require('../services/flowDashboard.service');
const kpiRepo = require('../repositories/kpi.repo');
const { FLOW_SEVERITY } = require('../config/constants');

let running = false;
let timer = null;
const nudgedRecently = new Map(); // patientId → timestamp (one nudge per patient per 30 min)
const NUDGE_COOLDOWN_MS = 30 * 60 * 1000;

function hourBucket() {
  return new Date().toISOString().slice(0, 13);
}

async function runFlowAnalysis() {
  if (running) return null;
  running = true;
  const started = Date.now();
  try {
    // 1 — bottlenecks
    bottleneck.invalidateCache();
    const analysis = await bottleneck.detectBottlenecks({ force: true });
    const list = bottleneck.toBottleneckList(analysis);

    // 2 — one alert per HIGH department per hour (dedupe key)
    const high = analysis.departments.filter((d) => d.severity === FLOW_SEVERITY.HIGH);
    for (const d of high) {
      const alert = await flowRepo.insertAlert({
        severity: d.rootCause ? 'critical' : 'high',
        title: `${d.department} ${d.rootCause ? 'is the ROOT CAUSE bottleneck' : 'bottleneck (cascade)'}`,
        message: `Utilization ${Math.round(d.utilization * 100)}%, predicted 2h gap ${d.predictedGap}. ${d.recommendedActions[0] ? `Top action: ${d.recommendedActions[0].text}` : ''}`,
        departmentId: d.departmentId,
        departmentName: d.department,
        relatedType: 'department',
        relatedId: d.departmentId,
        dedupeKey: `flow-bottleneck-${d.department}-${hourBucket()}`,
      });
      if (alert) {
        emitter.emitAlertCreated({ alertId: alert.id, severity: alert.severity, title: alert.title, description: alert.message, department: d.department });
      }
    }
    if (high.length) {
      emitter.emitFlowBottleneckDetected({
        bottlenecks: list,
        rootCause: analysis.rootCause,
        cascade: analysis.cascade,
        detectedAt: analysis.analyzedAt,
        trigger: 'scheduled',
      });
    }

    // 3 + 7 — bed demand projections and stored predictions
    const predictionRows = [];
    for (const d of analysis.departments) {
      if (!d.departmentId || !d.demand) continue;
      for (const p of d.demand) {
        predictionRows.push([
          'bed_demand',
          d.departmentId,
          p.horizon,
          p.demand,
          p.demand - (p.expectedAdmissions * 0.3),
          p.demand + (p.expectedAdmissions * 0.3),
          p.confidence,
        ]);
      }
      predictionRows.push(['utilization', d.departmentId, 2, (d.predicted[2] || 0) * 100, null, null, null]);
    }
    const ed = analysis.departments.find((d) => d.department === 'Emergency');
    if (ed && ed.departmentId) {
      const f = await prediction.forecastArrivals(ed.departmentId, flowConfig.PREDICTION_HORIZON_HOURS);
      f.predicted.forEach((v, i) => predictionRows.push(['arrivals', ed.departmentId, i + 1, v, f.lower[i], f.upper[i], f.confidence]));
      emitter.emitFlowPredictionUpdated({
        type: 'arrivals',
        departmentId: ed.departmentId,
        department: 'Emergency',
        horizon: flowConfig.PREDICTION_HORIZON_HOURS,
        values: { timestamps: f.timestamps, predicted: f.predicted, lower: f.lower, upper: f.upper, confidence: f.confidence },
      });
    }
    if (predictionRows.length) {
      const values = [];
      const placeholders = predictionRows.map((row, i) => {
        values.push(...row);
        const o = i * 7;
        return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7})`;
      });
      await db.query(
        `INSERT INTO predictions (type, department_id, horizon_hours, predicted_value, lower_bound, upper_bound, confidence)
         VALUES ${placeholders.join(', ')}`,
        values
      );
      // Keep the table small: predictions older than 7 days are not used
      await db.query(`DELETE FROM predictions WHERE created_at < NOW() - INTERVAL '7 days'`);
    }

    // 4 — dirty beds alert
    const totals = await flowRepo.getHospitalBedTotals();
    if (totals.cleaning > 2) {
      const alert = await flowRepo.insertAlert({
        severity: 'medium',
        title: `${totals.cleaning} beds waiting for cleaning`,
        message: 'Prioritize housekeeping to recover capacity.',
        relatedType: 'beds',
        dedupeKey: `flow-cleaning-${hourBucket()}`,
      });
      if (alert) emitter.emitAlertCreated({ alertId: alert.id, severity: alert.severity, title: alert.title, description: alert.message });
    }

    // 5 — discharge nudges (cool-down per patient)
    const now = Date.now();
    for (const c of analysis.dischargeCandidates.candidates) {
      if (!c.ready || !c.doctorId) continue;
      const last = nudgedRecently.get(c.patientId);
      if (last && now - last < NUDGE_COOLDOWN_MS) continue;
      nudgedRecently.set(c.patientId, now);
      const rows = await flowRepo.notifyUsers([c.doctorId], {
        type: 'general',
        title: `Discharge-ready: ${c.alias}`,
        message: `Readiness ${c.score}/100 in ${c.bedId}. ${c.blockingFactors.length ? `Blocking: ${c.blockingFactors.join('; ')}` : 'Ready to sign.'}`,
        relatedId: c.patientId,
      });
      for (const n of rows) emitter.emitNotification(n.userId, n);
      emitter.emitFlowDischargeNudge({ patientId: c.patientId, alias: c.alias, doctorId: c.doctorId, probability: c.probability, bedId: c.bedId, score: c.score });
    }

    // 7b — KPI snapshot if the 5-minute snapshot job has not written one recently
    const latest = await flowRepo.getLatestKpiSnapshot();
    if (!latest || now - new Date(latest.ts).getTime() > Math.max(60000, flowConfig.FLOW_ANALYSIS_INTERVAL_MS)) {
      try {
        const metrics = await kpiRepo.computeCurrentLiveMetrics();
        await kpiRepo.insertSnapshot(metrics);
      } catch (err) {
        logger.warn({ err: err.message }, 'Flow job could not write KPI snapshot');
      }
    }

    // 6 — analysis complete
    const analyzedAt = new Date().toISOString();
    dashboard.setLastAnalysisAt(analyzedAt);
    const stateSummary = await dashboard.getStateSummary();
    emitter.emitFlowAnalysisComplete({ analyzedAt, stateSummary, bottlenecks: list, tookMs: Date.now() - started });

    logger.debug({ tookMs: Date.now() - started, high: high.length }, 'Flow analysis complete');
    return { analyzedAt, high: high.length };
  } catch (err) {
    logger.error({ err: err.message }, 'Flow analysis job failed');
    return null;
  } finally {
    running = false;
  }
}

/** Interval scheduler (cron syntax cannot express arbitrary millisecond intervals). */
function startFlowAnalysis() {
  stopFlowAnalysis();
  flowConfig
    .resolveThresholds()
    .catch(() => null)
    .finally(() => {
      runFlowAnalysis();
      timer = setInterval(runFlowAnalysis, flowConfig.FLOW_ANALYSIS_INTERVAL_MS);
      if (timer.unref) timer.unref();
    });
  return { stop: stopFlowAnalysis };
}

function stopFlowAnalysis() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { runFlowAnalysis, startFlowAnalysis, stopFlowAnalysis };
