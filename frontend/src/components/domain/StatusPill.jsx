/**
 * @file StatusPill.jsx
 * One pill for every status vocabulary in the flow module: bed status, severity, root cause/cascade,
 * doctor presence, post-op bed availability and recommendation risk/status.
 */

import React from 'react';
import clsx from 'clsx';

const STYLES = {
  // bed / room status
  available: ['bg-[#1FA971]/10 text-[#13784F] border-[#1FA971]/40', 'Available', '#1FA971'],
  occupied: ['bg-[#D64545]/10 text-[#B02E2E] border-[#D64545]/40', 'Occupied', '#D64545'],
  cleaning: ['bg-[#F2A93B]/15 text-[#8A5200] border-[#F2A93B]/50', 'Cleaning', '#F2A93B'],
  reserved: ['bg-[#2BA8E0]/10 text-[#136E96] border-[#2BA8E0]/40', 'Reserved', '#2BA8E0'],
  blocked: ['bg-[#6B7280]/10 text-[#4B5260] border-[#6B7280]/40', 'Blocked', '#6B7280'],
  // severity
  HIGH: ['bg-[#D64545]/10 text-[#B02E2E] border-[#D64545]/40', 'High', '#D64545'],
  MEDIUM: ['bg-[#F2A93B]/15 text-[#8A5200] border-[#F2A93B]/50', 'Medium', '#F2A93B'],
  LOW: ['bg-[#1FA971]/10 text-[#13784F] border-[#1FA971]/40', 'Low', '#1FA971'],
  root: ['bg-[#D64545] text-white border-[#D64545]', 'ROOT CAUSE', '#fff'],
  cascade: ['bg-[#F28C28] text-white border-[#F28C28]', 'CASCADE', '#fff'],
  ok: ['bg-[#1FA971]/10 text-[#13784F] border-[#1FA971]/40', 'OK', '#1FA971'],
  // presence
  online: ['bg-[#1FA971]/10 text-[#13784F] border-[#1FA971]/40', 'Online', '#1FA971'],
  away: ['bg-[#F2A93B]/15 text-[#8A5200] border-[#F2A93B]/50', 'Away', '#F2A93B'],
  offline: ['bg-[#6B7280]/10 text-[#4B5260] border-[#6B7280]/40', 'Offline', '#6B7280'],
  // post-op availability
  YES: ['bg-[#1FA971] text-white border-[#1FA971]', 'YES', '#fff'],
  NO: ['bg-[#D64545] text-white border-[#D64545]', 'NO', '#fff'],
  PREDICTED_FREE: ['bg-[#F2A93B] text-[#3D2600] border-[#F2A93B]', 'PREDICTED FREE', '#3D2600'],
  'N/A': ['bg-cream-200 text-ink-500 border-cream-200', 'N/A', '#5B6B80'],
  // recommendation risk / status
  low: ['bg-[#1FA971]/10 text-[#13784F] border-[#1FA971]/40', 'Low risk', '#1FA971'],
  medium: ['bg-[#F2A93B]/15 text-[#8A5200] border-[#F2A93B]/50', 'Medium risk', '#F2A93B'],
  high: ['bg-[#D64545]/10 text-[#B02E2E] border-[#D64545]/40', 'High risk', '#D64545'],
  pending: ['bg-royal-100 text-royal-700 border-royal-500/30', 'Pending', '#014BAA'],
  approved: ['bg-[#1FA971]/10 text-[#13784F] border-[#1FA971]/40', 'Approved', '#1FA971'],
  rejected: ['bg-[#6B7280]/10 text-[#4B5260] border-[#6B7280]/40', 'Rejected', '#6B7280'],
  applied: ['bg-royal-500 text-white border-royal-500', 'Applied', '#fff'],
  // patient status
  admitted: ['bg-royal-100 text-royal-700 border-royal-500/30', 'Admitted', '#014BAA'],
  critical: ['bg-[#D64545]/10 text-[#B02E2E] border-[#D64545]/40', 'Critical', '#D64545'],
  waiting: ['bg-[#F2A93B]/15 text-[#8A5200] border-[#F2A93B]/50', 'Waiting', '#F2A93B'],
  in_recovery: ['bg-[#2BA8E0]/10 text-[#136E96] border-[#2BA8E0]/40', 'In recovery', '#2BA8E0'],
  in_surgery: ['bg-[#6D28D9]/10 text-[#5B21B6] border-[#6D28D9]/30', 'In surgery', '#6D28D9'],
  discharged: ['bg-[#6B7280]/10 text-[#4B5260] border-[#6B7280]/40', 'Discharged', '#6B7280'],
};

export function StatusPill({ status, label, size = 'sm', dot = true, className = '' }) {
  const [cls, defaultLabel, dotColor] = STYLES[status] || ['bg-cream-200 text-ink-500 border-cream-200', String(status || '—'), '#5B6B80'];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap',
        size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]',
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
