/**
 * @file flowFormat.js
 * Shared helpers for the Predictive Flow Intelligence UI: status colors, utilization bands,
 * number/time formatting and CSV export.
 */

export const BED_STATUS_COLORS = {
  available: '#1FA971',
  occupied: '#D64545',
  cleaning: '#F2A93B',
  reserved: '#2BA8E0',
  blocked: '#6B7280',
};

export const BED_STATUS_LABELS = {
  available: 'Available',
  occupied: 'Occupied',
  cleaning: 'Cleaning',
  reserved: 'Reserved',
  blocked: 'Blocked',
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
  success: { text: 'text-[#13784F]', bg: 'bg-[#1FA971]/10', border: 'border-[#1FA971]', hex: '#1FA971' },
  warning: { text: 'text-[#9A5B00]', bg: 'bg-[#F2A93B]/15', border: 'border-[#F2A93B]', hex: '#F2A93B' },
  danger: { text: 'text-[#B02E2E]', bg: 'bg-[#D64545]/10', border: 'border-[#D64545]', hex: '#D64545' },
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
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function dateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
