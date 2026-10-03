/**
 * @file icuNeed.js
 * ICU-need classifier (LightGBM, trained in ml/, ROC-AUC 0.975 on a held-out time split).
 * Predicts the probability that an arriving patient will need an ICU bed from information known at
 * arrival: age, gender, acuity, priority, planned surgery/diagnostics and arrival time.
 * Feature engineering mirrors ml/src/training/patients.py (build_features).
 */

const path = require('path');
const fs = require('fs');
const { rawScore, contributions, transform, categoryCode } = require('./lightgbm');

const MODEL_PATH = path.join(__dirname, 'models', 'icu_need.json');

/** Probability at or above which the patient is treated as needing ICU. */
const ICU_THRESHOLD = 0.5;
/** Probability at or above which the patient is flagged for ICU watch. */
const ICU_WATCH = 0.2;

let model = null;
function getModel() {
  if (!model) model = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
  return model;
}

const PRIORITY_BY_ACUITY = { 1: 'CRITICAL', 2: 'HIGH', 3: 'MEDIUM', 4: 'LOW', 5: 'LOW' };

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? NaN : Number(v));

/** 'Male' / 'female' / 'M' -> 'M' | 'F'; anything else -> null (missing). */
function normaliseGender(g) {
  if (!g) return null;
  const c = String(g).trim().charAt(0).toUpperCase();
  return c === 'M' || c === 'F' ? c : null;
}

/** Local-time calendar parts; pandas dayofweek is Monday=0. */
function calendar(arrival) {
  const d = arrival instanceof Date ? arrival : new Date(arrival || Date.now());
  const hour = d.getHours();
  const dow = (d.getDay() + 6) % 7;
  return { hour, dow, weekend: dow >= 5 ? 1 : 0 };
}

/**
 * Build the model's feature vector.
 * @param {{ age?: number, gender?: string, acuity: number, priority?: string, requiresOt?: boolean,
 *           requiresDiagnostic?: boolean, diagnosticType?: string, arrivalTime?: Date|string }} p
 */
function buildFeatures(p) {
  const m = getModel();
  const age = num(p.age);
  const acuity = num(p.acuity);
  const { hour, dow, weekend } = calendar(p.arrivalTime);
  const priority = p.priority === undefined ? PRIORITY_BY_ACUITY[acuity] || null : p.priority;
  const values = {
    age,
    acuity_level: acuity,
    requires_ot: p.requiresOt ? 1 : 0,
    requires_diagnostic: p.requiresDiagnostic ? 1 : 0,
    arrival_hour: hour,
    arrival_day_of_week: dow,
    arrival_is_weekend: weekend,
    arrival_hour_sin: Math.sin((2 * Math.PI * hour) / 24),
    arrival_hour_cos: Math.cos((2 * Math.PI * hour) / 24),
    is_elderly: age >= 65 ? 1 : 0,
    is_pediatric: age <= 18 ? 1 : 0,
    age_x_acuity: age * acuity,
    high_risk_flag: acuity <= 2 && age >= 60 ? 1 : 0,
    gender: categoryCode(m, 'gender', p.gender === undefined ? null : normaliseGender(p.gender) ?? p.gender),
    priority: categoryCode(m, 'priority', priority),
    diagnostic_type: categoryCode(m, 'diagnostic_type', p.diagnosticType || null),
  };
  return m.features.map((f) => values[f]);
}

/** Human-readable groups for the model's features (for "why" explanations). */
const GROUPS = {
  acuity_level: 'Acuity',
  priority: 'Acuity',
  age: 'Age',
  is_elderly: 'Age',
  is_pediatric: 'Age',
  age_x_acuity: 'Age with acuity',
  high_risk_flag: 'Age with acuity',
  requires_ot: 'Planned surgery',
  requires_diagnostic: 'Diagnostics',
  diagnostic_type: 'Diagnostics',
  arrival_hour: 'Arrival time',
  arrival_day_of_week: 'Arrival time',
  arrival_is_weekend: 'Arrival time',
  arrival_hour_sin: 'Arrival time',
  arrival_hour_cos: 'Arrival time',
  gender: 'Gender',
};

/**
 * Predict ICU need.
 * @returns {{ probability: number, needsIcu: boolean, level: 'high'|'watch'|'low', factors: {factor: string, direction: 'up'|'down', weight: number}[], model: string }}
 */
function predictIcuNeed(p) {
  const m = getModel();
  const x = buildFeatures(p);
  const probability = transform(m, rawScore(m, x));
  const { contrib } = contributions(m, x);
  const grouped = {};
  m.features.forEach((f, i) => {
    const g = GROUPS[f] || f;
    grouped[g] = (grouped[g] || 0) + contrib[i];
  });
  const factors = Object.entries(grouped)
    .filter(([, w]) => Math.abs(w) >= 0.15)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
    .map(([factor, w]) => ({ factor, direction: w > 0 ? 'up' : 'down', weight: Math.round(w * 100) / 100 }));
  return {
    probability: Math.round(probability * 1000) / 1000,
    needsIcu: probability >= ICU_THRESHOLD,
    level: probability >= ICU_THRESHOLD ? 'high' : probability >= ICU_WATCH ? 'watch' : 'low',
    factors,
    model: 'icu_need (LightGBM)',
  };
}

module.exports = { predictIcuNeed, buildFeatures, getModel, ICU_THRESHOLD, ICU_WATCH, PRIORITY_BY_ACUITY };
