/**
 * @file outlook.js
 * EXPERIMENTAL department utilization outlook (+1h, +4h, +24h) from the trained `pressure_utilization_*`
 * LightGBM models (ml/). Display only: never used for severity, alarms or recommendations.
 *
 * The models were trained on another hospital and expect 24 h of hourly history per department. The app
 * has no such history yet, so the inputs assume the current state held steady for the last 48 h and use
 * typical values for what the app does not measure (queue, waiting time, staff and resource gaps).
 * ml/scripts/export_js_models.py builds the same inputs in Python; tests/fixtures/outlook_parity.json
 * checks this file against it. See ml/INTEGRATION.md for why the numbers read low for busy departments.
 */

import { rawScore, categoryCode } from './lightgbm.js';

export const OUTLOOK_HORIZONS = [
  ['t1h', 'pressure_utilization_t1h', '+1h'],
  ['t4h', 'pressure_utilization_t4h', '+4h'],
  ['t24h', 'pressure_utilization_t24h', '+24h'],
];

/** App department name -> department category the models were trained with. */
export const MODEL_DEPARTMENT = { Emergency: 'ED', Radiology: 'RADIOLOGY', 'General Ward': 'MEDICINE', HDU: 'HDU', ICU: 'ICU', OT: 'OT' };

const LAGS = [1, 2, 3, 6, 12, 24];
const ROLLS = [3, 6, 24];
const LAG_COLS = ['pressure_score', 'utilization_percent', 'queue_length', 'average_waiting_time'];

let models = null;
let loading = null;

/** Load the three models once (lazy, separate chunks). Resolves to the models. */
export function loadOutlookModels() {
  if (models) return Promise.resolve(models);
  if (!loading) {
    loading = Promise.all([
      import('./models/pressure_utilization_t1h.json'),
      import('./models/pressure_utilization_t4h.json'),
      import('./models/pressure_utilization_t24h.json'),
    ])
      .then((mods) => {
        models = Object.fromEntries(OUTLOOK_HORIZONS.map(([key], i) => [key, mods[i].default || mods[i]]));
        return models;
      })
      .catch((err) => {
        loading = null; // allow a retry later
        throw err;
      });
  }
  return loading;
}

/** Current-state inputs for one department (same defaults as steady_inputs() in the export script). */
export function steadyInputs(department, capacity, occupied) {
  const ed = department === 'Emergency';
  const queue = ed ? 4 : 1;
  const wait = ed ? 45 : 20;
  const util = (100 * occupied) / Math.max(capacity, 1);
  return {
    total_capacity: capacity,
    occupied_capacity: occupied,
    available_capacity: capacity - occupied,
    patient_count: occupied + queue,
    queue_length: queue,
    average_waiting_time: wait,
    utilization_percent: util,
    pressure_score: 0.45 * util + 1.5 * queue + 0.1 * wait,
    staff_gap: 5 - 4,
    resource_gap: 5 - 4,
  };
}

/**
 * Feature rows for every known department at time `at` (steady 48 h history, so lags equal the current
 * value, rolling standard deviations are 0, and diff/trend are 0).
 * @param {{department: string, capacity: number, occupied: number}[]} departments
 */
export function buildOutlookFeatures(departments, at = new Date()) {
  const known = departments.filter((d) => MODEL_DEPARTMENT[d.department] && Number(d.capacity) > 0);
  const rows = known.map((d) => ({ d, x: steadyInputs(d.department, Number(d.capacity), Number(d.occupied) || 0) }));
  if (!rows.length) return [];
  const mean = (k) => rows.reduce((s, r) => s + r.x[k], 0) / rows.length;
  const hospPressure = mean('pressure_score');
  const hospUtil = mean('utilization_percent');
  const hospQueue = rows.reduce((s, r) => s + r.x.queue_length, 0);
  const hour = at.getHours();
  const dow = (at.getDay() + 6) % 7; // pandas: Monday = 0

  return rows.map(({ d, x }) => {
    const f = {
      ...x,
      occupancy_ratio: x.occupied_capacity / Math.max(x.total_capacity, 1),
      hosp_mean_pressure: hospPressure,
      hosp_mean_util: hospUtil,
      hosp_total_queue: hospQueue,
      rel_pressure_to_hosp: x.pressure_score - hospPressure,
      hour,
      day_of_week: dow,
      is_weekend: dow >= 5 ? 1 : 0,
      hour_sin: Math.sin((2 * Math.PI * hour) / 24),
      hour_cos: Math.cos((2 * Math.PI * hour) / 24),
    };
    for (const c of LAG_COLS) {
      for (const lag of LAGS) f[`${c}_lag${lag}`] = x[c];
      for (const w of ROLLS) {
        f[`${c}_rmean${w}`] = x[c];
        f[`${c}_rstd${w}`] = 0;
      }
      f[`${c}_diff1`] = 0;
      f[`${c}_trend3`] = 0;
    }
    return { department: d.department, values: f };
  });
}

function toVector(model, values, department) {
  return model.features.map((name) => (name === 'department' ? categoryCode(model, 'department', MODEL_DEPARTMENT[department]) : values[name]));
}

/**
 * Outlook per department: { department, now, t1h, t4h, t24h } in utilization percent (0-100+).
 * Requires loadOutlookModels() to have resolved; returns [] otherwise.
 */
export function predictOutlook(departments, at = new Date()) {
  if (!models) return [];
  return buildOutlookFeatures(departments, at).map(({ department, values }) => {
    const out = { department, now: values.utilization_percent };
    for (const [key] of OUTLOOK_HORIZONS) {
      const v = rawScore(models[key], toVector(models[key], values, department));
      out[key] = Math.max(0, v);
    }
    return out;
  });
}

export const isOutlookLoaded = () => Boolean(models);
