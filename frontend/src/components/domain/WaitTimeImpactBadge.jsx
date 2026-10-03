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
        down ? 'bg-[#10B981]/10 border-[#10B981]/40 text-fg-ok' : 'bg-[#EF4444]/10 border-[#EF4444]/40 text-fg-bad',
        size === 'lg' ? 'px-4 py-2 text-base' : 'px-3 py-1 text-xs',
        className
      )}
    >
      <Icon className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} aria-hidden="true" />
      <span className="tabular-nums">
        <span className="text-fg-bad">{before} min</span> to <span className="text-fg-ok">{after} min</span>, {down ? 'down' : 'up'} {Math.abs(pct)}%
      </span>
    </span>
  );
}

export default WaitTimeImpactBadge;
