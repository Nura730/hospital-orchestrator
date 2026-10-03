const USER_TYPES = Object.freeze({
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  OT_MANAGER: 'ot_manager',
});

const DOCTOR_STATUS = Object.freeze({
  AVAILABLE: 'available',
  IN_SURGERY: 'in_surgery',
  IN_CONSULTATION: 'in_consultation',
  OFF_DUTY: 'off_duty',
  ON_BREAK: 'on_break',
  EMERGENCY: 'emergency',
});

const PATIENT_STATUS = Object.freeze({
  WAITING: 'waiting',
  ADMITTED: 'admitted',
  IN_CONSULTATION: 'in_consultation',
  IN_SURGERY: 'in_surgery',
  IN_RECOVERY: 'in_recovery',
  DISCHARGED: 'discharged',
  TRANSFERRED: 'transferred',
  CRITICAL: 'critical',
});

const BED_TYPE = Object.freeze({
  GENERAL: 'general',
  ICU: 'icu',
  HDU: 'hdu',
  ISOLATION: 'isolation',
  ED: 'ed',
  POST_OP: 'post_op',
  PEDIATRIC: 'pediatric',
  MATERNITY: 'maternity',
});

const BED_STATUS = Object.freeze({
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  CLEANING: 'cleaning',
  MAINTENANCE: 'maintenance',
  RESERVED: 'reserved',
});

const OT_ROOM_STATUS = Object.freeze({
  AVAILABLE: 'available',
  IN_SURGERY: 'in_surgery',
  CLEANING: 'cleaning',
  MAINTENANCE: 'maintenance',
  RESERVED: 'reserved',
  EMERGENCY: 'emergency',
});

const OT_CASE_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DELAYED: 'delayed',
  EMERGENCY_INSERTED: 'emergency_inserted',
});

const CASE_URGENCY = Object.freeze({
  ELECTIVE: 'elective',
  URGENT: 'urgent',
  EMERGENCY: 'emergency',
  CRITICAL: 'critical',
});

const EQUIPMENT_STATUS = Object.freeze({
  AVAILABLE: 'available',
  IN_USE: 'in_use',
  CLEANING: 'cleaning',
  MAINTENANCE: 'maintenance',
  FAULT: 'fault',
});

const ALERT_SEVERITY = Object.freeze({
  INFO: 'info',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

const ALERT_STATUS = Object.freeze({
  OPEN: 'open',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  ESCALATED: 'escalated',
});

const NOTIFICATION_TYPE = Object.freeze({
  OT_ASSIGNED: 'ot_assigned',
  OT_CHANGED: 'ot_changed',
  OT_CANCELLED: 'ot_cancelled',
  PATIENT_ASSIGNED: 'patient_assigned',
  PATIENT_CRITICAL: 'patient_critical',
  ALERT: 'alert',
  SHIFT_REMINDER: 'shift_reminder',
  GENERAL: 'general',
});

const DEPARTMENTS = Object.freeze([
  'Emergency',
  'General Ward',
  'ICU',
  'HDU',
  'OT',
  'Radiology',
  'Pediatrics',
]);

const THRESHOLDS = Object.freeze({
  DEFAULT_MAX_SURGERIES_PER_DAY: 4,
  ICU_HIGH_OCCUPANCY_PERCENT: 85,
  BED_CLEANING_TIMEOUT_MINUTES: 45,
  ALERT_ESCALATION_LEVEL_1_MINUTES: 5,
  ALERT_ESCALATION_LEVEL_2_MINUTES: 10,
  MAX_ESCALATION_LEVEL: 3,
  OT_OVERRUN_ALERT_MINUTES: 15,
});

/* ── Predictive Flow Intelligence ─────────────────────────────── */

// Patient flow order: a blockage upstream cascades to every department after it.
const DEPENDENCY_CHAIN = Object.freeze([
  'Emergency',
  'Radiology',
  'General Ward',
  'HDU',
  'ICU',
  'OT',
]);

// Auto thresholds by hospital size (COUNT(beds)); first band with n < maxBeds wins.
const FLOW_SIZE_THRESHOLDS = Object.freeze([
  { label: '<50 beds', maxBeds: 50, warn: 0.65, danger: 0.78 },
  { label: '50-200 beds', maxBeds: 201, warn: 0.75, danger: 0.88 },
  { label: '200+ beds', maxBeds: Infinity, warn: 0.82, danger: 0.92 },
]);

const FLOW_EVENT_TYPES = Object.freeze({
  DISCHARGE_SIGNED: 'DISCHARGE_SIGNED',
  CLEANING_DONE: 'CLEANING_DONE',
  OT_COMPLETE: 'OT_COMPLETE',
  PATIENT_DETERIORATED: 'PATIENT_DETERIORATED',
  AMBULANCE_INCOMING: 'AMBULANCE_INCOMING',
});

const FLOW_SEVERITY = Object.freeze({ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' });

const ADMISSION_BASE_BY_ACUITY = Object.freeze({ 1: 0.95, 2: 0.8, 3: 0.6, 4: 0.3, 5: 0.1 });

const LOS_DEFAULT_HOURS = Object.freeze({ 1: 120, 2: 72, 3: 48, 4: 24, 5: 8 });

// Bed map zones (Reference C schematic)
const BED_ZONES = Object.freeze(['ED', 'Radiology', 'General Ward', 'HDU', 'ICU', 'PACU', 'OT']);

const SAFE_PATIENTS_PER_NURSE = 4;

module.exports = {
  DEPENDENCY_CHAIN,
  FLOW_SIZE_THRESHOLDS,
  FLOW_EVENT_TYPES,
  FLOW_SEVERITY,
  ADMISSION_BASE_BY_ACUITY,
  LOS_DEFAULT_HOURS,
  BED_ZONES,
  SAFE_PATIENTS_PER_NURSE,
  USER_TYPES,
  DOCTOR_STATUS,
  PATIENT_STATUS,
  BED_TYPE,
  BED_STATUS,
  OT_ROOM_STATUS,
  OT_CASE_STATUS,
  CASE_URGENCY,
  EQUIPMENT_STATUS,
  ALERT_SEVERITY,
  ALERT_STATUS,
  NOTIFICATION_TYPE,
  DEPARTMENTS,
  THRESHOLDS,
};
