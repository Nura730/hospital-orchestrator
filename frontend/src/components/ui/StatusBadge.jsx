/**
 * @file StatusBadge.jsx
 * Status indicator badge that always pairs icon + text label + color (never color alone).
 */

import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wrench,
  Sparkles,
  UserCheck,
  UserX,
  Coffee,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import Badge from './Badge.jsx';
import { BED_STATUS, STAFF_STATUS, EQUIPMENT_STATUS, PATIENT_STATUS } from '../../utils/constants.js';

const STATUS_CONFIGS = {
  // Bed Statuses
  [BED_STATUS.AVAILABLE]: { label: 'Available', color: 'success', icon: CheckCircle2 },
  [BED_STATUS.OCCUPIED]: { label: 'Occupied', color: 'danger', icon: Activity },
  [BED_STATUS.CLEANING]: { label: 'Cleaning', color: 'warning', icon: Sparkles },
  [BED_STATUS.MAINTENANCE]: { label: 'Maintenance', color: 'neutral', icon: Wrench },
  [BED_STATUS.RESERVED]: { label: 'Reserved', color: 'info', icon: Clock },

  // Staff Statuses
  [STAFF_STATUS.ON_DUTY]: { label: 'On Duty', color: 'success', icon: UserCheck },
  [STAFF_STATUS.AVAILABLE]: { label: 'Available', color: 'info', icon: CheckCircle2 },
  [STAFF_STATUS.IN_SURGERY]: { label: 'In Surgery', color: 'danger', icon: Activity },
  [STAFF_STATUS.ON_BREAK]: { label: 'On Break', color: 'warning', icon: Coffee },
  [STAFF_STATUS.OFF_DUTY]: { label: 'Off Duty', color: 'neutral', icon: UserX },
  [STAFF_STATUS.ON_CALL]: { label: 'On Call', color: 'info', icon: Clock },

  // Equipment Statuses
  [EQUIPMENT_STATUS.IN_USE]: { label: 'In Use', color: 'primary', icon: Activity },
  [EQUIPMENT_STATUS.OFFLINE]: { label: 'Offline', color: 'neutral', icon: ShieldAlert },

  // Patient Statuses
  [PATIENT_STATUS.WAITING]: { label: 'Waiting Queue', color: 'warning', icon: Clock },
  [PATIENT_STATUS.ADMITTED]: { label: 'Admitted', color: 'primary', icon: Activity },
  [PATIENT_STATUS.DISCHARGED]: { label: 'Discharged', color: 'neutral', icon: CheckCircle2 },
  [PATIENT_STATUS.TRANSFERRED]: { label: 'Transferred', color: 'info', icon: Clock },
};

export function StatusBadge({ status, size = 'sm', className = '', customLabel = null }) {
  const norm = (status || '').toLowerCase();
  const cfg = STATUS_CONFIGS[norm] || {
    label: customLabel || status || 'Unknown',
    color: 'neutral',
    icon: CheckCircle2,
  };

  return (
    <Badge
      color={cfg.color}
      size={size}
      icon={cfg.icon}
      className={className}
    >
      {customLabel || cfg.label}
    </Badge>
  );
}

export default StatusBadge;
