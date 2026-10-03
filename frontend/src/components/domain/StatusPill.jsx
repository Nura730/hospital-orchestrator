/**
 * @file StatusPill.jsx
 * One pill for every status vocabulary: bed status, severity, root cause/cascade, presence,
 * post-op bed availability, recommendation risk/status, patient status, tasks and requests.
 */

import React from 'react';
import clsx from 'clsx';

const GREEN = ['bg-[#10B981]/10 text-fg-ok border-[#10B981]/30', '#10B981'];
const RED = ['bg-[#EF4444]/10 text-fg-bad border-[#EF4444]/30', '#EF4444'];
const AMBER = ['bg-[#F59E0B]/10 text-fg-warn border-[#F59E0B]/30', '#F59E0B'];
const BLUE = ['bg-[#014BAA]/10 text-fg-info border-[#014BAA]/30', '#014BAA'];
const PURPLE = ['bg-[#8B5CF6]/10 text-fg-violet border-[#8B5CF6]/30', '#8B5CF6'];
const GREY = ['bg-[#6B7280]/10 text-ink-500 border-[#6B7280]/30', '#94A3B8'];

const s = (tone, label) => [tone[0], label, tone[1]];

const STYLES = {
  // bed / room status
  available: s(GREEN, 'Available'),
  occupied: s(BLUE, 'Occupied'),
  cleaning: s(AMBER, 'Cleaning'),
  reserved: s(PURPLE, 'Reserved'),
  blocked: s(GREY, 'Maintenance'),
  maintenance: s(GREY, 'Maintenance'),
  // severity
  HIGH: s(RED, 'High'),
  MEDIUM: s(AMBER, 'Medium'),
  LOW: s(GREEN, 'Low'),
  root: ['bg-[#DC2626] text-white border-[#DC2626]', 'ROOT CAUSE', '#FFFFFF'],
  cascade: ['bg-[#B45309] text-white border-[#B45309]', 'AFFECTED', '#FFFFFF'],
  ok: s(GREEN, 'OK'),
  // presence / duty
  online: s(GREEN, 'Online'),
  away: s(AMBER, 'Away'),
  offline: s(GREY, 'Offline'),
  on_duty: s(GREEN, 'On Duty'),
  on_break: s(AMBER, 'On Break'),
  off_duty: s(GREY, 'Off Duty'),
  in_consultation: s(BLUE, 'In Consultation'),
  emergency: s(RED, 'Emergency'),
  // post-op availability
  YES: ['bg-[#047857] text-white border-[#047857]', 'YES', '#FFFFFF'],
  NO: ['bg-[#DC2626] text-white border-[#DC2626]', 'NO', '#FFFFFF'],
  PREDICTED_FREE: ['bg-[#B45309] text-white border-[#B45309]', 'PREDICTED FREE', '#FFFFFF'],
  'N/A': s(GREY, 'N/A'),
  // recommendation risk / status
  low: s(GREEN, 'Low risk'),
  medium: s(AMBER, 'Medium risk'),
  high: s(RED, 'High risk'),
  pending: s(AMBER, 'Pending'),
  approved: s(GREEN, 'Approved'),
  rejected: s(GREY, 'Rejected'),
  applied: ['bg-royal-500 text-white border-royal-500', 'Applied', '#FFFFFF'],
  // patient status
  admitted: s(BLUE, 'Admitted'),
  critical: s(RED, 'Critical'),
  waiting: s(AMBER, 'Waiting'),
  in_recovery: s(GREEN, 'In Recovery'),
  in_surgery: s(PURPLE, 'In Surgery'),
  discharged: s(GREY, 'Discharged'),
  // tasks / requests / schedule
  done: s(GREEN, 'Done'),
  completed: s(GREEN, 'Completed'),
  in_progress: s(BLUE, 'In Progress'),
  scheduled: s(BLUE, 'Scheduled'),
  addressed: s(GREEN, 'Addressed'),
  sent: s(BLUE, 'Sent'),
  urgent: s(RED, 'Urgent'),
  skipped: s(GREY, 'Skipped'),
};

export function StatusPill({ status, label, size = 'sm', dot = true, className = '' }) {
  const [cls, defaultLabel, dotColor] = STYLES[status] || [GREY[0], String(status || '—').replace(/_/g, ' '), GREY[1]];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap',
        size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[11px]',
        cls,
        className
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} aria-hidden="true" />}
      {label || defaultLabel}
    </span>
  );
}

export default StatusPill;
