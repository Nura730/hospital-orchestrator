/**
 * Predictive Flow Intelligence configuration.
 * Reads optional env vars (dotenv is already loaded by config/env.js) and
 * resolves bottleneck thresholds from hospital size at startup.
 */
require('./env');
const db = require('./db');
const logger = require('../utils/logger');
const { FLOW_SIZE_THRESHOLDS } = require('./constants');

function num(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const hasExplicitWarn = process.env.BOTTLENECK_WARN_THRESHOLD !== undefined && process.env.BOTTLENECK_WARN_THRESHOLD !== '';
const hasExplicitDanger = process.env.BOTTLENECK_DANGER_THRESHOLD !== undefined && process.env.BOTTLENECK_DANGER_THRESHOLD !== '';

const flowConfig = {
  FLOW_ANALYSIS_INTERVAL_MS: num('FLOW_ANALYSIS_INTERVAL_MS', 60000),
  PREDICTION_HORIZON_HOURS: num('PREDICTION_HORIZON_HOURS', 6),
  BOTTLENECK_WARN_THRESHOLD: num('BOTTLENECK_WARN_THRESHOLD', 0.8),
  BOTTLENECK_DANGER_THRESHOLD: num('BOTTLENECK_DANGER_THRESHOLD', 0.9),
  DISCHARGE_NUDGE_THRESHOLD: num('DISCHARGE_NUDGE_THRESHOLD', 0.6),
  AMBULANCE_RESERVATION_HORIZON: num('AMBULANCE_RESERVATION_HORIZON', 30),
  AI_PROVIDER: (process.env.AI_PROVIDER || 'gemini').toLowerCase(),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  AI_REPORT_MAX_TOKENS: num('AI_REPORT_MAX_TOKENS', 900),
  thresholdSource: 'env-default',
  totalBeds: null,
};

/**
 * Pick WARN/DANGER thresholds from the bed count unless explicitly set in env.
 * Explicit env values always win.
 */
async function resolveThresholds() {
  try {
    const res = await db.query('SELECT COUNT(*)::int AS n FROM beds');
    const n = res.rows[0].n;
    flowConfig.totalBeds = n;
    const band = FLOW_SIZE_THRESHOLDS.find((b) => n < b.maxBeds) || FLOW_SIZE_THRESHOLDS[FLOW_SIZE_THRESHOLDS.length - 1];
    if (!hasExplicitWarn) flowConfig.BOTTLENECK_WARN_THRESHOLD = band.warn;
    if (!hasExplicitDanger) flowConfig.BOTTLENECK_DANGER_THRESHOLD = band.danger;
    flowConfig.thresholdSource = hasExplicitWarn && hasExplicitDanger ? 'env' : `auto(${band.label})`;
    logger.info(
      {
        beds: n,
        warn: flowConfig.BOTTLENECK_WARN_THRESHOLD,
        danger: flowConfig.BOTTLENECK_DANGER_THRESHOLD,
        source: flowConfig.thresholdSource,
      },
      'Flow thresholds resolved'
    );
  } catch (err) {
    logger.warn({ err: err.message }, 'Could not resolve flow thresholds from bed count; using env defaults');
  }
  return flowConfig;
}

flowConfig.resolveThresholds = resolveThresholds;

module.exports = flowConfig;
