/**
 * @file icuNeed.js
 * ICU-need classifier in the browser (same features and output as backend/src/ml/icuNeed.js).
 * The model JSON (~0.5 MB) is loaded lazily on first use so it is not part of the initial bundle:
 * call `loadIcuModel()` once (the mock API layers do), then `predictIcuNeed()` synchronously.
 */

import { rawScore, contributions, transform, categoryCode } from './lightgbm.js';

export const ICU_THRESHOLD = 0.5;
export const ICU_WATCH = 0.2;
export const PRIORITY_BY_ACUITY = { 1: 'CRITICAL', 2: 'HIGH', 3: 'MEDIUM', 4: 'LOW', 5: 'LOW' };

let model = null;
let loading = null;

/** Load the exported model once; resolves to the model. */
export function loadIcuModel() {
  if (model) return Promise.resolve(model);
  if (!loading) {
    loading = import('./models/icu_need.json').then((m) => {
      model = m.default || m;
      return model;
    });
  }
  return loading;
}

export const isIcuModelLoaded = () => Boolean(model);

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? NaN : Number(v));

function normaliseGender(g) {
  if (!g) return null;
  const c = String(g).trim().charAt(0).toUpperCase();
  return c === 'M' || c === 'F' ? c : null;
}

function calendar(arrival) {
  const d = arrival instanceof Date ? arrival : new Date(arrival || Date.now());
  const hour = d.getHours();
  const dow = (d.getDay() + 6) % 7; // pandas: Monday = 0
  return { hour, dow, weekend: dow >= 5 ? 1 : 0 };
}

export function buildFeatures(p) {
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
    gender: categoryCode(model, 'gender', p.gender === undefined ? null : normaliseGender(p.gender) ?? p.gender),
    priority: categoryCode(model, 'priority', priority),
    diagnostic_type: categoryCode(model, 'diagnostic_type', p.diagnosticType || null),
  };
  return model.features.map((f) => values[f]);
}

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
 * @returns {{ probability: number, needsIcu: boolean, level: 'high'|'watch'|'low', factors: object[], model: string } | null}
 *   null until loadIcuModel() has resolved.
 */
export function predictIcuNeed(p) {
  if (!model) return null;
  const x = buildFeatures(p);
  const probability = transform(model, rawScore(model, x));
  const { contrib } = contributions(model, x);
  const grouped = {};
  model.features.forEach((f, i) => {
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
