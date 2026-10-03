/**
 * @file BedGrid.jsx
 * Grid display of clinical hospital beds with status filters and quick legend.
 */

import React from 'react';
import BedCell from './BedCell.jsx';

export function BedGrid({ beds = [], onSelectBed = null, columns = 'grid-cols-5 sm:grid-cols-6 md:grid-cols-8' }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Bed Cell Grid */}
      <div className={`grid gap-2 ${columns}`}>
        {beds.map((bed) => (
          <BedCell key={bed.id} bed={bed} onClick={onSelectBed} />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-surface-border text-xs text-surface-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-emerald-500/80" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-rose-500/80" /> Occupied
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-amber-500/80" /> Cleaning
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-slate-500/80" /> Maintenance
        </span>
      </div>
    </div>
  );
}

export default BedGrid;
