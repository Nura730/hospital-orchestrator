/**
 * @file Formatting utilities.
 * Percentage, duration, relative time, and number formatting.
 */

import { formatDistanceToNowStrict, format, isToday, isYesterday } from 'date-fns';

/**
 * Format a number as a percentage string.
 * @param {number} value - The decimal or percentage value
 * @param {boolean} [isDecimal=false] - If true, multiplies by 100 first
 * @param {number} [decimals=0] - Decimal places
 * @returns {string} e.g. "87%" or "87.5%"
 */
export function formatPercent(value, isDecimal = false, decimals = 0) {
  if (value == null || isNaN(value)) return '—';
  const pct = isDecimal ? value * 100 : value;
  return `${pct.toFixed(decimals)}%`;
}

/**
 * Format minutes into a readable duration string.
 * @param {number} minutes - Total minutes
 * @returns {string} e.g. "1h 20m", "45m", "2h"
 */
export function formatMinutes(minutes) {
  if (minutes == null || isNaN(minutes)) return '—';
  const mins = Math.round(minutes);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Format seconds into a readable duration string.
 * @param {number} seconds - Total seconds
 * @returns {string}
 */
export function formatSeconds(seconds) {
  if (seconds == null || isNaN(seconds)) return '—';
  return formatMinutes(seconds / 60);
}

/**
 * Format a date/timestamp into a relative time string.
 * @param {string|number|Date} date - The date to format
 * @returns {string} e.g. "5 min ago", "2 hours ago"
 */
export function formatRelativeTime(date) {
  if (!date) return '—';
  try {
    const d = new Date(date);
    return formatDistanceToNowStrict(d, { addSuffix: true });
  } catch {
    return '—';
  }
}

/**
 * Format a date/timestamp into a short human-readable string.
 * Today: "2:30 PM", Yesterday: "Yesterday 2:30 PM", Else: "Oct 3, 2:30 PM"
 * @param {string|number|Date} date
 * @returns {string}
 */
export function formatDateTime(date) {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isToday(d))     return format(d, 'h:mm a');
    if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
    return format(d, 'MMM d, h:mm a');
  } catch {
    return '—';
  }
}

/**
 * Format a date for display in tables: "Oct 3, 2024"
 * @param {string|number|Date} date
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return '—';
  try {
    return format(new Date(date), 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

/**
 * Format time only: "2:30 PM"
 * @param {string|number|Date} date
 * @returns {string}
 */
export function formatTime(date) {
  if (!date) return '—';
  try {
    return format(new Date(date), 'h:mm a');
  } catch {
    return '—';
  }
}

/**
 * Format a 24h time from hours number: 14 -> "2:00 PM"
 * @param {number} hour - 0-23
 * @returns {string}
 */
export function formatHour(hour) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return format(d, 'h a');
}

/**
 * Format a large number with compact notation.
 * @param {number} num
 * @returns {string} e.g. "1.2K", "3.4M"
 */
export function formatCompactNumber(num) {
  if (num == null || isNaN(num)) return '—';
  if (Math.abs(num) < 1000) return num.toString();
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(num);
}

/**
 * Pluralize a word based on count.
 * @param {number} count
 * @param {string} singular
 * @param {string} [plural] - Defaults to singular + 's'
 * @returns {string} e.g. "3 beds", "1 bed"
 */
export function pluralize(count, singular, plural) {
  const p = plural || `${singular}s`;
  return `${count} ${count === 1 ? singular : p}`;
}

/**
 * Clamp a value between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generate a trend arrow and delta string.
 * @param {number} current
 * @param {number} previous
 * @returns {{ delta: string, direction: 'up'|'down'|'flat' }}  (render the direction with an icon)
 */
export function getTrend(current, previous) {
  if (previous == null || current == null) return { delta: '—', direction: 'flat' };
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return { delta: '0%', direction: 'flat' };
  const pctChange = previous !== 0 ? ((diff / previous) * 100).toFixed(1) : '∞';
  if (diff > 0) return { delta: `+${pctChange}%`, direction: 'up' };
  return { delta: `${pctChange}%`, direction: 'down' };
}
