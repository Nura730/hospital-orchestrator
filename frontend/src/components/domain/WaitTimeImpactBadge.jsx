/**
 * @file WaitTimeImpactBadge.jsx
 * "94 min to 38 min, down 60%"
 */

import React from 'react';
import clsx from 'clsx';
import { TrendingDown, TrendingUp } from 'lucide-react';

export function WaitTimeImpactBadge({ before, after, size = 'md', className = '' }) {
  if (before == null || after == null) {
    return <span className="text-xs text-ink-500">No simulation yet</span>;
  }
  const pct = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
  const down = pct >= 0;
  const Icon = down ? TrendingDown : TrendingUp;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-xl border font-semibold',
        down ? 'bg-[#1FA971]/10 border-[#1FA971]/40 text-[#13784F]' : 'bg-[#D64545]/10 border-[#D64545]/40 text-[#B02E2E]',
        size === 'lg' ? 'px-4 py-2 text-base' : 'px-3 py-1 text-xs',
        className
      )}
    >
      <Icon className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} aria-hidden="true" />
      <span className="tabular-nums">
        <span className="text-[#B02E2E]">{before} min</span> to <span className="text-[#13784F]">{after} min</span>, {down ? 'down' : 'up'} {Math.abs(pct)}%
      </span>
    </span>
  );
}

export default WaitTimeImpactBadge;
