/**
 * @file BedCell.jsx
 * Interactive bed cell component with micro-animation pulse on live update and hover tooltip.
 */

import React from 'react';
import clsx from 'clsx';
import Tooltip from '../ui/Tooltip.jsx';
import { BED_STATUS } from '../../utils/constants.js';

const STATUS_CELL_BG = {
  [BED_STATUS.AVAILABLE]:
    'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25',
  [BED_STATUS.OCCUPIED]:
    'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25',
  [BED_STATUS.CLEANING]:
    'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25',
  [BED_STATUS.MAINTENANCE]:
    'bg-slate-500/15 border-slate-500/40 text-slate-600 dark:text-slate-400 hover:bg-slate-500/25',
  [BED_STATUS.RESERVED]:
    'bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/25',
};

export function BedCell({ bed, onClick = null }) {
  const tooltipContent = (
    <div className="flex flex-col gap-1 text-[11px] p-0.5">
      <div className="font-bold flex items-center justify-between gap-3">
        <span>{bed.bedNumber} ({bed.department})</span>
        <span className="capitalize text-slate-300">{bed.status}</span>
      </div>
      {bed.patientName && (
        <div className="text-slate-200">
          Patient: <strong>{bed.patientName}</strong> {bed.patientAcuity && `(Acuity ${bed.patientAcuity})`}
        </div>
      )}
      {bed.expectedReleaseTime && (
        <div className="text-slate-300">
          Expected Release: {new Date(bed.expectedReleaseTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {bed.releaseConfidence && ` (${bed.releaseConfidence}% conf)`}
        </div>
      )}
      {bed.equipmentAttached && bed.equipmentAttached.length > 0 && (
        <div className="text-teal-300">
          Equipment: {bed.equipmentAttached.join(', ')}
        </div>
      )}
    </div>
  );

  return (
    <Tooltip content={tooltipContent} position="top">
      <button
        type="button"
        onClick={() => onClick && onClick(bed)}
        className={clsx(
          'w-12 h-12 rounded-lg border text-xs font-mono font-bold flex flex-col items-center justify-center p-1 transition-all duration-150 cursor-pointer shadow-xs',
          STATUS_CELL_BG[bed.status] || STATUS_CELL_BG[BED_STATUS.AVAILABLE]
        )}
      >
        <span className="text-[10px] tracking-tighter truncate w-full text-center">
          {bed.bedNumber.replace(/[A-Z]+-/, '')}
        </span>
        <span className="w-1.5 h-1.5 rounded-full mt-0.5 bg-current" />
      </button>
    </Tooltip>
  );
}

export default BedCell;
