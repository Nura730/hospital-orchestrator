/**
 * @file BedTile.jsx
 * Neon-style square tile on the dark schematic: ID + status color. Keyboard accessible.
 */

import React from 'react';
import clsx from 'clsx';
import { BED_STATUS_COLORS, BED_STATUS_LABELS } from '../../utils/flowFormat.js';

export function BedTile({ tile, onSelect, dimmed = false, highlighted = false, size = 'md' }) {
  const color = BED_STATUS_COLORS[tile.status] || BED_STATUS_COLORS.blocked;
  const isRoom = tile.kind === 'ot_room';
  return (
    <button
      type="button"
      onClick={() => onSelect?.(tile)}
      title={`${tile.id}: ${BED_STATUS_LABELS[tile.status] || tile.status}${tile.patientAlias ? ` (${tile.patientAlias})` : ''}`}
      aria-label={`${tile.id}, ${BED_STATUS_LABELS[tile.status] || tile.status}${tile.patientAlias ? `, patient ${tile.patientAlias}` : ''}`}
      className={clsx(
        'relative flex flex-col items-center justify-center rounded-lg border font-mono font-bold transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#012A63]',
        'hover:scale-105 hover:z-10',
        isRoom ? 'h-14 min-w-[84px] px-2 text-[10px]' : size === 'sm' ? 'h-10 w-[58px] text-[9px]' : 'h-12 w-[66px] text-[10px]',
        dimmed && 'opacity-25',
        highlighted && 'ring-2 ring-[#FFE9A8] ring-offset-2 ring-offset-[#012A63]'
      )}
      style={{
        color,
        borderColor: color,
        backgroundColor: `${color}26`,
        boxShadow: `0 0 10px ${color}55, inset 0 0 8px ${color}33`,
      }}
    >
      {tile.pulse && Date.now() - tile.pulse < 4000 && (
        <span className="absolute inset-0 rounded-lg animate-ping" style={{ border: `1px solid ${color}` }} aria-hidden="true" />
      )}
      <span className="leading-tight text-center">{tile.id}</span>
      {tile.acuity && <span className="text-[8px] font-semibold opacity-90 mt-0.5">A{tile.acuity}</span>}
      {isRoom && tile.procedure && <span className="text-[8px] font-normal opacity-80 truncate max-w-[78px]">{tile.procedure}</span>}
    </button>
  );
}

export default BedTile;
