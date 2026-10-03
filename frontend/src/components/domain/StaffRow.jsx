/**
 * @file StaffRow.jsx
 * Operational staff roster item with workload, fatigue progress bars, and active status chip.
 */

import React from 'react';
import StatusBadge from '../ui/StatusBadge.jsx';
import ProgressBar from '../ui/ProgressBar.jsx';
import Badge from '../ui/Badge.jsx';

export function StaffRow({ staffMember }) {
  if (!staffMember) return null;

  return (
    <div className="p-3.5 rounded-xl border border-surface-border bg-surface-elevated flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      {/* Name and Designation */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-full bg-primary-600/10 text-primary-600 dark:text-primary-400 font-bold flex items-center justify-center text-xs shrink-0 border border-primary-500/20">
          {staffMember.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-surface-foreground truncate">
              {staffMember.name}
            </span>
            <span className="text-[11px] font-mono text-surface-muted">
              {staffMember.employeeId}
            </span>
          </div>
          <span className="text-[11px] text-surface-muted truncate">
            {staffMember.title} • {staffMember.department}
          </span>
        </div>
      </div>

      {/* Workload and Fatigue Progress Bars */}
      <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
        <div className="w-28 sm:w-32">
          <ProgressBar
            value={staffMember.workload || 0}
            showValue
            label="Workload"
            size="sm"
          />
        </div>

        <div className="w-28 sm:w-32">
          <ProgressBar
            value={staffMember.fatigue || 0}
            showValue
            label="Fatigue"
            size="sm"
            color="warning"
          />
        </div>

        <div className="shrink-0">
          <StatusBadge status={staffMember.status} size="xs" />
        </div>
      </div>
    </div>
  );
}

export default StaffRow;
