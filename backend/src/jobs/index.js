const cron = require('node-cron');
const { checkOtOverruns } = require('./otStatus.job');
const { escalateAlerts } = require('./escalation.job');
const { captureKpiSnapshot } = require('./snapshot.job');
const { startFlowAnalysis, stopFlowAnalysis } = require('./flowAnalysis.job');
const logger = require('../utils/logger');
const env = require('../config/env');

let jobs = [];

function registerJobs() {
  if (env.NODE_ENV === 'test') {
    logger.info('Background cron jobs disabled in test environment');
    return;
  }

  logger.info('Registering scheduled background jobs...');

  // 1. OT Status & Overrun check: Every 60 seconds
  const otJob = cron.schedule('* * * * *', () => {
    checkOtOverruns();
  });
  jobs.push(otJob);

  // 2. Alert Escalation check: Every 30 seconds
  const escalationJob = cron.schedule('*/30 * * * * *', () => {
    escalateAlerts();
  });
  jobs.push(escalationJob);

  // 3. KPI Snapshot Capture: Every 5 minutes
  const snapshotJob = cron.schedule('*/5 * * * *', () => {
    captureKpiSnapshot();
  });
  jobs.push(snapshotJob);

  // 4. Predictive Flow Intelligence analysis: every FLOW_ANALYSIS_INTERVAL_MS (default 60 s)
  jobs.push(startFlowAnalysis());

  logger.info('Scheduled background jobs registered successfully.');
}

function stopJobs() {
  stopFlowAnalysis();
  jobs.forEach((j) => j.stop());
  jobs = [];
}

module.exports = {
  registerJobs,
  stopJobs,
};
