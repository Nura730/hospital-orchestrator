/**
 * @file Application-wide constants.
 * Enums, thresholds, and static configuration values.
 * No magic numbers in components — import from here.
 */

/* ── Departments ────────────────────────────────────────────────── */
export const DEPARTMENTS = [
  'Emergency',
  'General Ward',
  'ICU',
  'HDU',
  'Radiology',
  'Isolation',
  'OT',
];

export const DEPARTMENT_SHORT = {
  Emergency:     'ER',
  'General Ward': 'GW',
  ICU:           'ICU',
  HDU:           'HDU',
  Radiology:     'RAD',
  Isolation:     'ISO',
  OT:            'OT',
};

/* ── Bed Statuses ───────────────────────────────────────────────── */
export const BED_STATUS = {
  AVAILABLE:   'available',
  OCCUPIED:    'occupied',
  CLEANING:    'cleaning',
  MAINTENANCE: 'maintenance',
  RESERVED:    'reserved',
};

export const BED_STATUS_LABELS = {
  [BED_STATUS.AVAILABLE]:   'Available',
  [BED_STATUS.OCCUPIED]:    'Occupied',
  [BED_STATUS.CLEANING]:    'Cleaning',
  [BED_STATUS.MAINTENANCE]: 'Maintenance',
  [BED_STATUS.RESERVED]:    'Reserved',
};

export const BED_TYPES = ['General', 'ICU', 'HDU', 'Isolation', 'Pediatric', 'Maternity'];

/* ── Patient Statuses ───────────────────────────────────────────── */
export const PATIENT_STATUS = {
  WAITING:    'waiting',
  ADMITTED:   'admitted',
  IN_SURGERY: 'in_surgery',
  RECOVERY:   'recovery',
  DISCHARGED: 'discharged',
  TRANSFERRED:'transferred',
};

export const ACUITY_LEVELS = [
  { value: 1, label: 'Critical',    color: 'danger' },
  { value: 2, label: 'Emergency',   color: 'danger' },
  { value: 3, label: 'Urgent',      color: 'warning' },
  { value: 4, label: 'Semi-Urgent', color: 'info' },
  { value: 5, label: 'Non-Urgent',  color: 'success' },
];

/* ── Staff Statuses ─────────────────────────────────────────────── */
export const STAFF_STATUS = {
  AVAILABLE:   'available',
  ON_DUTY:     'on_duty',
  IN_SURGERY:  'in_surgery',
  ON_BREAK:    'on_break',
  OFF_DUTY:    'off_duty',
  ON_CALL:     'on_call',
};

export const STAFF_ROLES = ['Doctor', 'Nurse', 'Surgeon', 'Anesthetist', 'Technician'];

/* ── Equipment ──────────────────────────────────────────────────── */
export const EQUIPMENT_STATUS = {
  AVAILABLE:   'available',
  IN_USE:      'in_use',
  MAINTENANCE: 'maintenance',
  OFFLINE:     'offline',
};

export const EQUIPMENT_TYPES = [
  'Ventilator',
  'Monitor',
  'Infusion Pump',
  'Defibrillator',
  'X-Ray',
  'Ultrasound',
  'ECG Machine',
  'Wheelchair',
  'Stretcher',
  'Oxygen Concentrator',
];

/* ── OT ─────────────────────────────────────────────────────────── */
export const OT_STATUS = {
  AVAILABLE:   'available',
  IN_USE:      'in_use',
  CLEANING:    'cleaning',
  MAINTENANCE: 'maintenance',
};

export const OT_CASE_STATUS = {
  SCHEDULED:   'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED:   'completed',
  CANCELLED:   'cancelled',
};

/* ── Alerts ─────────────────────────────────────────────────────── */
export const ALERT_SEVERITY = {
  CRITICAL: 'critical',
  HIGH:     'high',
  MEDIUM:   'medium',
  LOW:      'low',
  INFO:     'info',
};

export const ALERT_STATUS = {
  OPEN:         'open',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED:     'resolved',
};

export const ALERT_TYPES = [
  'bed_shortage',
  'staff_overload',
  'equipment_failure',
  'ot_overrun',
  'patient_waiting',
  'occupancy_critical',
  'escalation',
];

/* ── Recommendations ────────────────────────────────────────────── */
export const RECOMMENDATION_STATUS = {
  PENDING:  'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  AUTO:     'auto_executed',
};

export const RECOMMENDATION_TYPES = [
  'bed_transfer',
  'staff_reallocation',
  'discharge_suggestion',
  'ot_reschedule',
  'equipment_redistribution',
  'admission_routing',
];

export const RISK_LEVELS = {
  LOW:    'low',
  MEDIUM: 'medium',
  HIGH:   'high',
};

/* ── Autonomy Modes ─────────────────────────────────────────────── */
export const AUTONOMY_MODES = {
  ADVISORY: 'advisory',
  APPROVAL: 'approval',
  AUTO:     'auto',
};

export const AUTONOMY_MODE_LABELS = {
  [AUTONOMY_MODES.ADVISORY]: 'Advisory',
  [AUTONOMY_MODES.APPROVAL]: 'Approval Required',
  [AUTONOMY_MODES.AUTO]:     'Auto-Execute',
};

/* ── Thresholds ─────────────────────────────────────────────────── */
export const THRESHOLDS = {
  OCCUPANCY_WARN:     70,
  OCCUPANCY_DANGER:   90,
  WORKLOAD_WARN:      75,
  WORKLOAD_DANGER:    90,
  FATIGUE_WARN:       75,
  FATIGUE_DANGER:     90,
  WAIT_TIME_WARN_MIN: 30,
  WAIT_TIME_DANGER_MIN: 60,
  ED_WAIT_TARGET_MIN: 15,
  BATTERY_LOW:        20,
  BATTERY_CRITICAL:   10,
};

/* ── Socket Events ──────────────────────────────────────────────── */
export const SOCKET_EVENTS = {
  BED_UPDATED:          'bed.updated',
  PATIENT_UPDATED:      'patient.updated',
  OT_CASE_STARTED:      'ot.caseStarted',
  OT_CASE_COMPLETED:    'ot.caseCompleted',
  OT_OVERRUN:           'ot.overrun',
  DOCTOR_STATUS_CHANGED:'doctor.statusChanged',
  ALERT_CREATED:        'alert.created',
  ALERT_ESCALATED:      'alert.escalated',
  KPI_UPDATED:          'kpi.updated',
  NOTIFICATION_NEW:     'notification.new',
  RECOMMENDATION_NEW:   'recommendation.new',
};

/* ── Forecast Horizons ──────────────────────────────────────────── */
export const FORECAST_HORIZONS = [
  { value: 3,  label: '3h' },
  { value: 6,  label: '6h' },
  { value: 12, label: '12h' },
  { value: 24, label: '24h' },
];

/* ── Misc ───────────────────────────────────────────────────────── */
export const LIVE_EMITTER_INTERVAL_MS = 3000;
export const MOCK_LATENCY_MIN_MS     = 300;
export const MOCK_LATENCY_MAX_MS     = 700;
export const ITEMS_PER_PAGE           = 20;
export const MAX_RECENT_ALERTS        = 8;
export const SIMULATOR_HISTORY_MAX    = 5;
