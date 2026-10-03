/**
 * @file BedTile.jsx
 * 48 x 48 bed cell: tiny bed ID + status color, hover tooltip (ID, patient alias, status).
 * OT rooms render as a wider tile with the procedure name. Keyboard accessible.
 */

import React from 'react';
import clsx from 'clsx';
import { BED_STATUS_LABELS } from '../../utils/flowFormat.js';

export const CELL_STYLES = {
  available: 'bg-green-500/20 border-green-500 text-fg-ok',
  occupied: 'bg-royal-500/10 border-royal-500 text-fg-info',
  cleaning: 'bg-amber-500/20 border-amber-500 text-fg-warn',
  blocked: 'bg-gray-500/20 border-gray-500 text-ink-500',
  maintenance: 'bg-gray-500/20 border-gray-500 text-ink-500',
  reserved: 'bg-purple-500/20 border-purple-500 text-fg-violet',
};

export function BedTile({ tile, onSelect, dimmed = false, highlighted = false }) {
  if (!tile) return null;
  const isRoom = tile.kind === 'ot_room';
  const status = tile.status || 'available';
  const label = BED_STATUS_LABELS[status] || status;
  const alias = tile.patientAlias || null;
  const tip = `${tile.id} · ${label}${alias ? ` · ${alias}` : ''}`;

  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        onClick={() => {
          if (onSelect && typeof onSelect === 'function') onSelect(tile);
        }}
        aria-label={tip}
        className={clsx(
          'relative flex flex-col items-center justify-center rounded-lg border font-mono font-semibold transition-transform',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-500 focus-visible:ring-offset-1 focus-visible:ring-offset-cream-50 hover:scale-105',
          isRoom ? 'h-12 min-w-[96px] px-2 text-[11px]' : 'h-12 w-12 text-[10px]',
          CELL_STYLES[status] || CELL_STYLES.blocked,
          dimmed && 'opacity-25',
          highlighted && 'ring-2 ring-royal-500 ring-offset-1 ring-offset-cream-50'
        )}
      >
        {tile.pulse && Date.now() - tile.pulse < 4000 && <span className="absolute inset-0 rounded-lg border border-current animate-ping" aria-hidden="true" />}
        <span className="leading-tight text-center tracking-tight">{isRoom ? tile.name || tile.id : tile.id}</span>
        {isRoom && tile.procedure && <span className="text-[9px] font-normal opacity-80 truncate max-w-[88px]">{tile.procedure}</span>}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 hidden group-hover:block group-focus-within:block whitespace-nowrap rounded-md border border-cream-200 bg-cream-50 px-2 py-1 text-[11px] font-medium text-ink-900"
      >
        <b>{tile.id}</b> · {label}
        {alias ? ` · ${alias}` : ''}
      </span>
    </span>
  );
}

export default BedTile;
