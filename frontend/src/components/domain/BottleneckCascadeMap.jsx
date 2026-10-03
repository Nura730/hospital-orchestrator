/**
 * @file BottleneckCascadeMap.jsx
 * The department chain as 140 x 90 nodes: name, utilization (large), predicted gap. Border color is the
 * severity (green < 70%, amber 70-90%, red > 90% with a red tint). Root cause gets a "ROOT CAUSE" badge,
 * downstream departments an "AFFECTED" badge. Arrows turn red with an X where flow is blocked.
 * Horizontal on desktop, vertical on mobile.
 */

import React from 'react';
import clsx from 'clsx';
import { ArrowRight, ArrowDown, X } from 'lucide-react';

export function severityOf(util) {
  const pct = util <= 1.5 ? util * 100 : util;
  if (pct > 90) return 'critical';
  if (pct >= 70) return 'warning';
  return 'normal';
}

export const SEVERITY_STYLE = {
  normal: { color: '#10B981', label: 'Normal' },
  warning: { color: '#F59E0B', label: 'Warning' },
  critical: { color: '#EF4444', label: 'Critical' },
};

function gapText(gap) {
  if (gap == null) return 'No forecast';
  const g = Math.round(gap);
  if (g > 0) return `+${g} short in 2h`;
  if (g < 0) return `${Math.abs(g)} spare in 2h`;
  return 'At capacity in 2h';
}

function Node({ d, selected, onSelect }) {
  const sev = severityOf(d.utilization);
  const { color } = SEVERITY_STYLE[sev];
  const badge = d.rootCause ? ['ROOT CAUSE', '#DC2626'] : d.isCascade ? ['AFFECTED', '#B45309'] : null;
  return (
    <button
      type="button"
      onClick={() => onSelect(d)}
      aria-pressed={selected}
      aria-label={`${d.department}, ${Math.round(d.utilization * 100)} percent${badge ? `, ${badge[0].toLowerCase()}` : ''}`}
      className={clsx('relative w-full lg:w-[140px] h-[90px] shrink-0 rounded-xl border-2 bg-cream-50 px-3 py-2 text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-500', selected && 'ring-2 ring-royal-500 ring-offset-2 ring-offset-cream-100')}
      style={{ borderColor: badge?.[1] === '#B45309' && sev === 'normal' ? '#F59E0B' : color, backgroundColor: sev === 'critical' ? 'rgba(239,68,68,0.08)' : undefined }}
    >
      {badge && (
        <span className="absolute -top-2 right-2 rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-white" style={{ backgroundColor: badge[1] }}>
          {badge[0]}
        </span>
      )}
      <span className="block text-[11px] font-semibold text-ink-500 truncate">{d.department}</span>
      <span className="block text-2xl font-bold tabular-nums text-ink-900 leading-tight">{Math.round(d.utilization * 100)}%</span>
      <span className="block text-[10px] text-ink-500 truncate">{gapText(d.predictedGap)}</span>
    </button>
  );
}

function Arrow({ blocked }) {
  const color = blocked ? '#EF4444' : 'rgb(var(--cream-200))';
  return (
    <span className="relative flex items-center justify-center shrink-0 lg:w-7 h-6 lg:h-auto" role={blocked ? 'img' : undefined} aria-label={blocked ? 'Flow blocked' : undefined}>
      <ArrowRight className="hidden lg:block w-5 h-5" style={{ color }} aria-hidden="true" />
      <ArrowDown className="lg:hidden w-5 h-5" style={{ color }} aria-hidden="true" />
      {blocked && (
        <span className="absolute -top-1.5 lg:-top-3 right-0 lg:right-auto w-3.5 h-3.5 rounded-full bg-[#EF4444] text-white flex items-center justify-center">
          <X className="w-2.5 h-2.5" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

/**
 * @param {{ departments: object[], selected?: string, onSelect: Function }} props
 */
export function BottleneckCascadeMap({ departments = [], selected, onSelect }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-center gap-1 lg:gap-0 overflow-x-auto py-3">
      {departments.map((d, i) => {
        const next = departments[i + 1];
        // Flow is blocked when the next department downstream is critical
        const blocked = Boolean(next && severityOf(next.utilization) === 'critical');
        return (
          <React.Fragment key={d.department}>
            <Node d={d} selected={selected === d.department} onSelect={onSelect} />
            {next && <Arrow blocked={blocked} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default BottleneckCascadeMap;
