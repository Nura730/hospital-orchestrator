/**
 * @file SeverityBadge.jsx
 * Criticality indicator badge for alerts and triage acuities.
 */

import React from 'react';
import { AlertOctagon, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import Badge from './Badge.jsx';
import { ALERT_SEVERITY } from '../../utils/constants.js';

const SEVERITY_CONFIG = {
  [ALERT_SEVERITY.CRITICAL]: { label: 'Critical', color: 'danger', icon: AlertOctagon },
  [ALERT_SEVERITY.HIGH]:     { label: 'High', color: 'warning', icon: AlertTriangle },
  [ALERT_SEVERITY.MEDIUM]:   { label: 'Medium', color: 'info', icon: Info },
  [ALERT_SEVERITY.LOW]:      { label: 'Low', color: 'success', icon: CheckCircle2 },
  [ALERT_SEVERITY.INFO]:     { label: 'Info', color: 'neutral', icon: Info },
};

export function SeverityBadge({ severity, size = 'sm', className = '' }) {
  const norm = (severity || '').toLowerCase();
  const cfg = SEVERITY_CONFIG[norm] || SEVERITY_CONFIG[ALERT_SEVERITY.INFO];

  return (
    <Badge color={cfg.color} size={size} icon={cfg.icon} className={className} dot>
      {cfg.label}
    </Badge>
  );
}

export default SeverityBadge;
