/**
 * @file runway.js
 * Capacity runway: how long until a department is full, from the forecast it already has
 * (utilization now and predicted at +1h, +2h, +4h; 1.0 = full). Straight lines between the points;
 * past +4h the last trend is extended, up to 12 h. Works with mock and backend data alike.
 */

const MAX_HOURS = 12;

/**
 * @param {{ utilization: number, predicted?: Record<string, number> }} d
 * @returns {number|null} hours until full (0 = full now), or null if not within 12 h
 */
export function runwayHours(d) {
  const now = Number(d?.utilization);
  if (!Number.isFinite(now)) return null;
  if (now >= 1) return 0;
  const pts = [[0, now]];
  for (const h of [1, 2, 4]) {
    const v = Number(d.predicted?.[h]);
    if (Number.isFinite(v)) pts.push([h, v]);
  }
  for (let i = 1; i < pts.length; i++) {
    const [t0, u0] = pts[i - 1];
    const [t1, u1] = pts[i];
    if (u1 >= 1) return t0 + ((1 - u0) / (u1 - u0)) * (t1 - t0);
  }
  if (pts.length < 2) return null;
  const [ta, ua] = pts[pts.length - 2];
  const [tb, ub] = pts[pts.length - 1];
  const slope = (ub - ua) / (tb - ta);
  if (slope <= 0) return null;
  const t = tb + (1 - ub) / slope;
  return t <= MAX_HOURS ? t : null;
}

/** "Full now", "Full in ~40 min", "Full in ~2 h 40 min", or "Not within 12 h". */
export function formatRunway(hours) {
  if (hours === null || hours === undefined) return 'Not within 12 h';
  if (hours <= 0) return 'Full now';
  const mins = Math.max(5, Math.round((hours * 60) / 5) * 5);
  if (mins < 60) return `Full in ~${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `Full in ~${h} h${m ? ` ${m} min` : ''}`;
}

/** Tone for a runway: under 2 h urgent, under 6 h warning. */
export function runwayTone(hours) {
  if (hours === null || hours === undefined) return 'ok';
  if (hours < 2) return 'bad';
  if (hours < 6) return 'warn';
  return 'ok';
}

/** Department that fills first, with its runway, or null. `exclude` skips departments (e.g. OT). */
export function firstToFill(departments = [], exclude = []) {
  let best = null;
  for (const d of departments) {
    if (exclude.includes(d.department)) continue;
    const h = runwayHours(d);
    if (h !== null && (!best || h < best.hours)) best = { department: d.department, hours: h };
  }
  return best;
}
