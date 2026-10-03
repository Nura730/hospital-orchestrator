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

module.exports = {
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
