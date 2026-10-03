/**
 * @file Color mappings for statuses, severities, and Chart.js palettes.
 * Maps status/severity values to Tailwind classes and raw hex/rgb values for charts.
 */

import {
  BED_STATUS,
  EQUIPMENT_STATUS,
  STAFF_STATUS,
  ALERT_SEVERITY,
  ALERT_STATUS,
  PATIENT_STATUS,
  OT_STATUS,
  OT_CASE_STATUS,
  RISK_LEVELS,
  THRESHOLDS,
} from './constants';

/* ── Bed Status Colors ──────────────────────────────────────────── */
export const bedStatusColor = {
  [BED_STATUS.AVAILABLE]:   { bg: 'bg-success-100 dark:bg-success-900/30', text: 'text-success-700 dark:text-success-400', dot: 'bg-success-500', hex: '#22c55e' },
  [BED_STATUS.OCCUPIED]:    { bg: 'bg-info-100 dark:bg-info-900/30',       text: 'text-info-700 dark:text-info-400',       dot: 'bg-info-500',    hex: '#0ea5e9' },
  [BED_STATUS.CLEANING]:    { bg: 'bg-warning-100 dark:bg-warning-900/30', text: 'text-warning-700 dark:text-warning-400', dot: 'bg-warning-500', hex: '#f59e0b' },
  [BED_STATUS.MAINTENANCE]: { bg: 'bg-danger-100 dark:bg-danger-900/30',   text: 'text-danger-700 dark:text-danger-400',   dot: 'bg-danger-500',  hex: '#ef4444' },
  [BED_STATUS.RESERVED]:    { bg: 'bg-purple-100 dark:bg-purple-900/30',   text: 'text-purple-700 dark:text-purple-400',   dot: 'bg-purple-500',  hex: '#8b5cf6' },
};

/* ── Equipment Status Colors ────────────────────────────────────── */
export const equipmentStatusColor = {
  [EQUIPMENT_STATUS.AVAILABLE]:   { bg: 'bg-success-100 dark:bg-success-900/30', text: 'text-success-700 dark:text-success-400', hex: '#22c55e' },
  [EQUIPMENT_STATUS.IN_USE]:      { bg: 'bg-info-100 dark:bg-info-900/30',       text: 'text-info-700 dark:text-info-400',       hex: '#0ea5e9' },
  [EQUIPMENT_STATUS.MAINTENANCE]: { bg: 'bg-warning-100 dark:bg-warning-900/30', text: 'text-warning-700 dark:text-warning-400', hex: '#f59e0b' },
  [EQUIPMENT_STATUS.OFFLINE]:     { bg: 'bg-danger-100 dark:bg-danger-900/30',   text: 'text-danger-700 dark:text-danger-400',   hex: '#ef4444' },
};

/* ── Staff Status Colors ────────────────────────────────────────── */
export const staffStatusColor = {
  [STAFF_STATUS.AVAILABLE]:  { bg: 'bg-success-100 dark:bg-success-900/30', text: 'text-success-700 dark:text-success-400', hex: '#22c55e' },
  [STAFF_STATUS.ON_DUTY]:    { bg: 'bg-info-100 dark:bg-info-900/30',       text: 'text-info-700 dark:text-info-400',       hex: '#0ea5e9' },
  [STAFF_STATUS.IN_SURGERY]: { bg: 'bg-purple-100 dark:bg-purple-900/30',   text: 'text-purple-700 dark:text-purple-400',   hex: '#8b5cf6' },
  [STAFF_STATUS.ON_BREAK]:   { bg: 'bg-warning-100 dark:bg-warning-900/30', text: 'text-warning-700 dark:text-warning-400', hex: '#f59e0b' },
  [STAFF_STATUS.OFF_DUTY]:   { bg: 'bg-gray-100 dark:bg-gray-800/30',       text: 'text-gray-600 dark:text-gray-400',       hex: '#9ca3af' },
  [STAFF_STATUS.ON_CALL]:    { bg: 'bg-teal-100 dark:bg-teal-900/30',       text: 'text-teal-700 dark:text-teal-400',       hex: '#014BAA' },
};

/* ── Alert Severity Colors ──────────────────────────────────────── */
export const severityColor = {
  [ALERT_SEVERITY.CRITICAL]: { bg: 'bg-danger-100 dark:bg-danger-900/30',   text: 'text-danger-700 dark:text-danger-400',   border: 'border-danger-500', hex: '#ef4444' },
  [ALERT_SEVERITY.HIGH]:     { bg: 'bg-danger-50 dark:bg-danger-900/20',    text: 'text-danger-600 dark:text-danger-400',   border: 'border-danger-400', hex: '#f87171' },
  [ALERT_SEVERITY.MEDIUM]:   { bg: 'bg-warning-100 dark:bg-warning-900/30', text: 'text-warning-700 dark:text-warning-400', border: 'border-warning-500',hex: '#f59e0b' },
  [ALERT_SEVERITY.LOW]:      { bg: 'bg-info-100 dark:bg-info-900/30',       text: 'text-info-700 dark:text-info-400',       border: 'border-info-500',   hex: '#0ea5e9' },
  [ALERT_SEVERITY.INFO]:     { bg: 'bg-gray-100 dark:bg-gray-800/30',       text: 'text-gray-600 dark:text-gray-400',       border: 'border-gray-400',   hex: '#9ca3af' },
};

/* ── Alert Status Colors ────────────────────────────────────────── */
export const alertStatusColor = {
  [ALERT_STATUS.OPEN]:         { bg: 'bg-danger-100 dark:bg-danger-900/30', text: 'text-danger-700 dark:text-danger-400' },
  [ALERT_STATUS.ACKNOWLEDGED]: { bg: 'bg-warning-100 dark:bg-warning-900/30', text: 'text-warning-700 dark:text-warning-400' },
  [ALERT_STATUS.RESOLVED]:     { bg: 'bg-success-100 dark:bg-success-900/30', text: 'text-success-700 dark:text-success-400' },
};

/* ── Patient Status Colors ──────────────────────────────────────── */
export const patientStatusColor = {
  [PATIENT_STATUS.WAITING]:     { bg: 'bg-warning-100 dark:bg-warning-900/30', text: 'text-warning-700 dark:text-warning-400', hex: '#f59e0b' },
  [PATIENT_STATUS.ADMITTED]:    { bg: 'bg-info-100 dark:bg-info-900/30',       text: 'text-info-700 dark:text-info-400',       hex: '#0ea5e9' },
  [PATIENT_STATUS.IN_SURGERY]:  { bg: 'bg-purple-100 dark:bg-purple-900/30',   text: 'text-purple-700 dark:text-purple-400',   hex: '#8b5cf6' },
  [PATIENT_STATUS.RECOVERY]:    { bg: 'bg-teal-100 dark:bg-teal-900/30',       text: 'text-teal-700 dark:text-teal-400',       hex: '#014BAA' },
  [PATIENT_STATUS.DISCHARGED]:  { bg: 'bg-success-100 dark:bg-success-900/30', text: 'text-success-700 dark:text-success-400', hex: '#22c55e' },
  [PATIENT_STATUS.TRANSFERRED]: { bg: 'bg-gray-100 dark:bg-gray-800/30',       text: 'text-gray-600 dark:text-gray-400',       hex: '#9ca3af' },
};

/* ── OT Status Colors ──────────────────────────────────────────── */
export const otStatusColor = {
  [OT_STATUS.AVAILABLE]:   { bg: 'bg-success-100 dark:bg-success-900/30', text: 'text-success-700 dark:text-success-400', hex: '#22c55e' },
  [OT_STATUS.IN_USE]:      { bg: 'bg-info-100 dark:bg-info-900/30',       text: 'text-info-700 dark:text-info-400',       hex: '#0ea5e9' },
  [OT_STATUS.CLEANING]:    { bg: 'bg-warning-100 dark:bg-warning-900/30', text: 'text-warning-700 dark:text-warning-400', hex: '#f59e0b' },
  [OT_STATUS.MAINTENANCE]: { bg: 'bg-danger-100 dark:bg-danger-900/30',   text: 'text-danger-700 dark:text-danger-400',   hex: '#ef4444' },
};

/* ── OT Case Status Colors ──────────────────────────────────────── */
export const otCaseStatusColor = {
  [OT_CASE_STATUS.SCHEDULED]:   { bg: 'bg-info-100 dark:bg-info-900/30',       text: 'text-info-700 dark:text-info-400',       hex: '#0ea5e9' },
  [OT_CASE_STATUS.IN_PROGRESS]: { bg: 'bg-purple-100 dark:bg-purple-900/30',   text: 'text-purple-700 dark:text-purple-400',   hex: '#8b5cf6' },
  [OT_CASE_STATUS.COMPLETED]:   { bg: 'bg-success-100 dark:bg-success-900/30', text: 'text-success-700 dark:text-success-400', hex: '#22c55e' },
  [OT_CASE_STATUS.CANCELLED]:   { bg: 'bg-gray-100 dark:bg-gray-800/30',       text: 'text-gray-600 dark:text-gray-400',       hex: '#9ca3af' },
};

/* ── Risk Level Colors ──────────────────────────────────────────── */
export const riskColor = {
  [RISK_LEVELS.LOW]:    { bg: 'bg-success-100 dark:bg-success-900/30', text: 'text-success-700 dark:text-success-400', hex: '#22c55e' },
  [RISK_LEVELS.MEDIUM]: { bg: 'bg-warning-100 dark:bg-warning-900/30', text: 'text-warning-700 dark:text-warning-400', hex: '#f59e0b' },
  [RISK_LEVELS.HIGH]:   { bg: 'bg-danger-100 dark:bg-danger-900/30',   text: 'text-danger-700 dark:text-danger-400',   hex: '#ef4444' },
};

/* ── Occupancy RAG Color ────────────────────────────────────────── */
/**
 * Returns RAG color class based on occupancy percentage.
 * @param {number} pct - Occupancy percentage (0-100)
 * @returns {{ bg: string, text: string, hex: string }}
 */
export function getOccupancyColor(pct) {
  if (pct >= THRESHOLDS.OCCUPANCY_DANGER)  return { bg: 'bg-danger-100 dark:bg-danger-900/30',   text: 'text-danger-600 dark:text-danger-400',   hex: '#ef4444' };
  if (pct >= THRESHOLDS.OCCUPANCY_WARN)    return { bg: 'bg-warning-100 dark:bg-warning-900/30', text: 'text-warning-600 dark:text-warning-400', hex: '#f59e0b' };
  return { bg: 'bg-success-100 dark:bg-success-900/30', text: 'text-success-600 dark:text-success-400', hex: '#22c55e' };
}

/* ── Workload RAG Color ─────────────────────────────────────────── */
/**
 * Returns RAG color based on workload percentage.
 * @param {number} pct - Workload percentage (0-100)
 * @returns {{ bg: string, text: string, hex: string }}
 */
export function getWorkloadColor(pct) {
  if (pct >= THRESHOLDS.WORKLOAD_DANGER)  return { bg: 'bg-danger-100 dark:bg-danger-900/30',   text: 'text-danger-600 dark:text-danger-400',   hex: '#ef4444' };
  if (pct >= THRESHOLDS.WORKLOAD_WARN)    return { bg: 'bg-warning-100 dark:bg-warning-900/30', text: 'text-warning-600 dark:text-warning-400', hex: '#f59e0b' };
  return { bg: 'bg-success-100 dark:bg-success-900/30', text: 'text-success-600 dark:text-success-400', hex: '#22c55e' };
}

/* ── Chart.js Color Helpers ─────────────────────────────────────── */

/** Read a CSS custom property value from the document root. */
function getCSSVar(name) {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Returns the chart palette as an array of hex strings.
 * Reads from CSS variables so colors auto-switch with dark mode.
 * @param {number} [count=8] - Number of colors needed
 * @returns {string[]}
 */
export function getChartPalette(count = 8) {
  const palette = [];
  for (let i = 1; i <= Math.min(count, 8); i++) {
    palette.push(getCSSVar(`--chart-${i}`) || FALLBACK_CHART_COLORS[i - 1]);
  }
  return palette;
}

/** Fallback chart colors if CSS vars aren't available. */
const FALLBACK_CHART_COLORS = [
  '#014BAA', '#0ea5e9', '#8b5cf6', '#f59e0b',
  '#ec4899', '#22c55e', '#ef4444', '#6366f1',
];

/**
 * Returns bed-status chart colors as parallel arrays for Chart.js datasets.
 * Order: available, occupied, cleaning, maintenance, reserved
 * @returns {{ labels: string[], colors: string[] }}
 */
export function getBedStatusChartColors() {
  return {
    labels: ['Available', 'Occupied', 'Cleaning', 'Maintenance', 'Reserved'],
    colors: [
      bedStatusColor.available.hex,
      bedStatusColor.occupied.hex,
      bedStatusColor.cleaning.hex,
      bedStatusColor.maintenance.hex,
      bedStatusColor.reserved.hex,
    ],
  };
}

/**
 * Returns equipment-status chart colors.
 * @returns {{ labels: string[], colors: string[] }}
 */
export function getEquipmentStatusChartColors() {
  return {
    labels: ['Available', 'In Use', 'Maintenance', 'Offline'],
    colors: [
      equipmentStatusColor.available.hex,
      equipmentStatusColor.in_use.hex,
      equipmentStatusColor.maintenance.hex,
      equipmentStatusColor.offline.hex,
    ],
  };
}

/**
 * Returns occupancy bar color for a given percentage (for Chart.js bar fills).
 * @param {number} pct
 * @returns {string} hex color
 */
export function getOccupancyBarColor(pct) {
  if (pct >= THRESHOLDS.OCCUPANCY_DANGER) return '#ef4444';
  if (pct >= THRESHOLDS.OCCUPANCY_WARN)   return '#f59e0b';
  return '#014BAA';
}

/**
 * Creates an rgba string from hex + alpha.
 * @param {string} hex - e.g. "#014BAA"
 * @param {number} alpha - 0-1
 * @returns {string}
 */
export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
