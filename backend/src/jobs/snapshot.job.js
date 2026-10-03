const kpiRepo = require('../repositories/kpi.repo');
const emitter = require('../sockets/emitter');
const logger = require('../utils/logger');

/**
 * Runs every 5 minutes: computes and records a point-in-time KPI snapshot
 */
async function captureKpiSnapshot() {
  try {
    const liveMetrics = await kpiRepo.computeCurrentLiveMetrics();
    await kpiRepo.insertSnapshot(liveMetrics);

    emitter.emitKpiUpdated(liveMetrics);
    logger.debug('Captured periodic 5-minute KPI snapshot.');
  } catch (err) {
    logger.error({ err: err.message }, 'Error in KPI snapshot job');
  }
}

module.exports = {
  captureKpiSnapshot,
};
