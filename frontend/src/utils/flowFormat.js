/**
 * @file flowFormat.js
 * Shared helpers for the Predictive Flow Intelligence UI: status colors, utilization bands,
 * number/time formatting and CSV export.
 */

export const BED_STATUS_COLORS = {
  available: '#10B981',
  occupied: '#014BAA',
  cleaning: '#F59E0B',
  reserved: '#8B5CF6',
  blocked: '#6B7280',
};

export const BED_STATUS_LABELS = {
  available: 'Available',
  occupied: 'Occupied',
  cleaning: 'Cleaning',
  reserved: 'Reserved',
  blocked: 'Maintenance',
};

/** Utilization band: green < 70%, amber 70-90%, red > 90%. Accepts 0-1 or 0-100. */
export function utilBand(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'neutral';
  const pct = value <= 1.5 ? value * 100 : value;
  if (pct > 90) return 'danger';
  if (pct >= 70) return 'warning';
  return 'success';
}

export const BAND_STYLES = {
  success: { text: 'text-fg-ok', bg: 'bg-[#10B981]/10', border: 'border-[#10B981]', hex: '#10B981' },
  warning: { text: 'text-fg-warn', bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]', hex: '#F59E0B' },
  danger: { text: 'text-fg-bad', bg: 'bg-[#EF4444]/10', border: 'border-[#EF4444]', hex: '#EF4444' },
  neutral: { text: 'text-royal-500', bg: 'bg-royal-100', border: 'border-cream-200', hex: '#014BAA' },
};

export function pctText(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const pct = Math.abs(value) <= 1.5 ? value * 100 : value;
  return `${pct.toFixed(digits)}%`;
}

export function num(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function timeUntil(ts) {
  if (!ts) return '—';
  const m = Math.round((new Date(ts).getTime() - Date.now()) / 60000);
  if (m <= 0) return 'now';
  if (m < 60) return `~${m} min`;
  const h = m / 60;
  return h < 24 ? `~${h.toFixed(h < 10 ? 1 : 0)}h` : `~${Math.round(h / 24)}d`;
}

export function clock(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function dateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function readinessBand(score) {
  if (score > 70) return 'success';
  if (score >= 40) return 'warning';
  return 'danger';
}

export function confidenceBand(c) {
  if (c === null || c === undefined) return { label: 'Unknown', band: 'neutral' };
  if (c > 0.8) return { label: 'High', band: 'success' };
  if (c >= 0.5) return { label: 'Medium', band: 'warning' };
  return { label: 'Low', band: 'danger' };
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Download rows as CSV.
 * @param {string} filename
 * @param {{key: string, label: string}[]} columns
 * @param {object[]} rows
 */
export function exportCsv(filename, columns, rows) {
  const header = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(typeof c.csv === 'function' ? c.csv(r) : r[c.key])).join(',')).join('\n');
  downloadText(`${filename}.csv`, `${header}\n${body}`, 'text/csv;charset=utf-8');
}

export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initials(name) {
  if (!name) return '?';
  return name
    .replace(/^(Dr\.?|Nurse)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function displayName(user) {
  return user?.name || user?.fullName || user?.full_name || 'User';
}

/** Acuity 1 (most critical) .. 5 (least): color for dots and badges. */
export const ACUITY_COLORS = { 1: '#EF4444', 2: '#F97316', 3: '#F59E0B', 4: '#014BAA', 5: '#10B981' };

export function acuityColor(a) {
  return ACUITY_COLORS[a] || '#94A3B8';
}

/** Readable (WCAG AA) text shade for each acuity level, for labels on light backgrounds. */
export const ACUITY_TEXT = { 1: '#991B1B', 2: '#9A3412', 3: '#92400E', 4: '#014BAA', 5: '#046C4E' };

export function acuityTextColor(a) {
  return ACUITY_TEXT[a] || '#5B6B80';
}

/** Whole days since a timestamp, counting the admission day as Day 1. */
export function dayNumber(since, now = Date.now()) {
  if (!since) return null;
  const start = new Date(since);
  if (Number.isNaN(start.getTime())) return null;
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const n = new Date(now);
  const b = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export function shortDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Doctor calendar / schedule event colors. */
export const EVENT_COLORS = {
  consultation: '#014BAA',
  surgery: '#8B5CF6',
  rounds: '#10B981',
  emergency: '#EF4444',
};
