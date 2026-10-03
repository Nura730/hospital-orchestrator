/**
 * @file BedCell.jsx
 * 48 x 48 bed cell for grid views: tiny bed ID + status color, hover tooltip. Null-safe for beds
 * without a patient or release time.
 */

import React from 'react';
import clsx from 'clsx';
import Tooltip from '../ui/Tooltip.jsx';
import { BED_STATUS } from '../../utils/constants.js';

const STATUS_CELL = {
  [BED_STATUS.AVAILABLE]: 'bg-green-500/20 border-green-500 text-fg-ok',
  [BED_STATUS.OCCUPIED]: 'bg-royal-500/10 border-royal-500 text-fg-info',
  [BED_STATUS.CLEANING]: 'bg-amber-500/20 border-amber-500 text-fg-warn',
  [BED_STATUS.MAINTENANCE]: 'bg-gray-500/20 border-gray-500 text-ink-500',
  [BED_STATUS.RESERVED]: 'bg-purple-500/20 border-purple-500 text-fg-violet',
};

export function BedCell({ bed, onBedClick = null, onClick = null }) {
  if (!bed) return null;
  const handler = onBedClick || onClick;
  const patient = bed.patient || null;
  const alias = patient?.alias || bed.patientAlias || bed.patientName || null;
  const releaseTime = bed.expected_release_time || bed.expectedReleaseTime || null;
  const id = bed.bedNumber || bed.id || '—';
  const status = bed.status || BED_STATUS.AVAILABLE;

  const tooltipContent = (
    <div className="flex flex-col gap-0.5 text-[11px]">
      <span className="font-semibold">
        {id} · <span className="capitalize">{status}</span>
      </span>
      {alias && <span>Patient: {alias}</span>}
      {releaseTime && <span>Release: {new Date(releaseTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
    </div>
  );

  return (
    <Tooltip content={tooltipContent} position="top">
      <button
        type="button"
        onClick={() => {
          if (handler && typeof handler === 'function') handler(bed);
        }}
        aria-label={`${id}, ${status}${alias ? `, ${alias}` : ''}`}
        className={clsx('w-12 h-12 rounded-lg border font-mono font-semibold flex items-center justify-center p-1 transition-transform hover:scale-105', STATUS_CELL[status] || STATUS_CELL[BED_STATUS.AVAILABLE])}
      >
        <span className="text-[9px] tracking-tight truncate w-full text-center">{String(id)}</span>
      </button>
    </Tooltip>
  );
}

export default BedCell;
