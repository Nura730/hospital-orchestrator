/**
 * @file AlertItem.jsx
 * Live feed alert item row with acknowledge action and escalation indicators.
 */

import React from 'react';
import clsx from 'clsx';
import { Check, Clock, AlertTriangle } from 'lucide-react';
import SeverityBadge from '../ui/SeverityBadge.jsx';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import { formatRelativeTime } from '../../utils/format.js';

export function AlertItem({ alert, onAcknowledge = null, compact = false }) {
  if (!alert) return null;

  const isAcked = alert.status === 'acknowledged';

  return (
    <div
      className={clsx(
        'p-3.5 rounded-xl border border-surface-border bg-surface-elevated transition-all flex flex-col gap-2',
        alert.severity === 'critical' && 'border-l-4 border-l-danger-500 shadow-xs',
        alert.severity === 'high' && 'border-l-4 border-l-warning-500',
        alert.severity === 'medium' && 'border-l-4 border-l-info-500',
        isAcked && 'opacity-65 filter grayscale-[20%]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <SeverityBadge severity={alert.severity} size="xs" />
          <span className="font-semibold text-xs text-surface-foreground truncate">
            {alert.title}
          </span>
        </div>

        <span className="text-xs text-surface-muted flex items-center gap-1 font-mono shrink-0">
          <Clock className="w-3 h-3" />
          {formatRelativeTime(alert.createdAt)}
        </span>
      </div>

      {!compact && (
        <p className="text-xs text-surface-muted line-clamp-2 leading-relaxed">
          {alert.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-surface-border/50 text-xs">
        <div className="flex items-center gap-2">
          {alert.department && (
            <Badge color="neutral" size="xs">
              {alert.department}
            </Badge>
          )}
          {alert.escalationLevel && alert.escalationLevel > 1 && (
            <Badge color="danger" size="xs" icon={AlertTriangle}>
              Tier {alert.escalationLevel} Escalation
            </Badge>
          )}
        </div>

        {onAcknowledge && !isAcked && (
          <Button
            variant="outline"
            size="xs"
            icon={Check}
            onClick={() => onAcknowledge(alert.id)}
          >
            Acknowledge
          </Button>
        )}

        {isAcked && (
          <span className="text-xs text-surface-muted italic">
            Acknowledged
          </span>
        )}
      </div>
    </div>
  );
}

export default AlertItem;
