/**
 * @file BottleneckCascadeMap.jsx
 * The patient-flow pipeline: each department is a ring gauge (occupancy), joined by animated flow lines
 * in the order patients move. The root cause glows, affected departments are marked, and a link turns red
 * with a "blocked" marker when the next department is critical. Horizontal on desktop, vertical on phones.
 */

import React from 'react';
import clsx from 'clsx';
import { TrendingUp, TrendingDown, Minus, Ban } from 'lucide-react';

export function severityOf(util) {
  const pct = util <= 1.5 ? util * 100 : util;
  if (pct > 90) return 'critical';
  if (pct >= 70) return 'warning';
  return 'normal';
}

export const SEVERITY_STYLE = {
  normal: { color: '#10B981', text: '#046C4E', label: 'Normal' },
  warning: { color: '#F59E0B', text: '#92400E', label: 'Warning' },
  critical: { color: '#EF4444', text: '#B91C1C', label: 'Critical' },
};

const R = 46;
const CIRC = 2 * Math.PI * R;

function Ring({ pct, color, glow }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <svg viewBox="0 0 112 112" className="w-[112px] h-[112px]" aria-hidden="true">
      {glow && <circle cx="56" cy="56" r="54" fill="rgba(239,68,68,0.10)" className="animate-pulse" />}
      <circle cx="56" cy="56" r={R} fill="rgb(var(--cream-50))" stroke="rgb(var(--cream-200))" strokeWidth="9" />
      <circle
        cx="56"
        cy="56"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * CIRC} ${CIRC}`}
        transform="rotate(-90 56 56)"
        style={{ transition: 'stroke-dasharray 600ms ease' }}
      />
    </svg>
  );
}

function Node({ d, selected, onSelect }) {
  const pct = Math.round(d.utilization * 100);
  const sev = severityOf(d.utilization);
  const s = SEVERITY_STYLE[sev];
  const next = d.predicted?.[2] != null ? Math.round(d.predicted[2] * 100) : null;
  const delta = next == null ? 0 : next - pct;
  const Trend = delta > 2 ? TrendingUp : delta < -2 ? TrendingDown : Minus;
  const badge = d.rootCause ? ['Root cause', '#DC2626'] : d.isCascade ? ['Affected', '#B45309'] : null;
  return (
    <button
      type="button"
      onClick={() => onSelect(d)}
      aria-pressed={selected}
      aria-label={`${d.department}: ${pct}% occupied, ${s.label}${badge ? `, ${badge[0]}` : ''}`}
      className={clsx(
        'group relative flex flex-col items-center gap-2 rounded-2xl px-3 pt-6 pb-4 w-full lg:w-[150px] shrink-0 transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-500',
        selected ? 'bg-royal-500/5 ring-2 ring-royal-500' : 'hover:bg-sunken'
      )}
    >
      {badge && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white whitespace-nowrap" style={{ backgroundColor: badge[1] }}>
          {badge[0]}
        </span>
      )}
      <span className="relative">
        <Ring pct={pct} color={s.color} glow={d.rootCause} />
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-ink-900 leading-none">{pct}%</span>
          <span className="text-xs font-semibold mt-1" style={{ color: s.text }}>
            {s.label}
          </span>
        </span>
      </span>
      <span className="text-sm font-bold text-ink-900 text-center leading-tight">{d.department}</span>
      <span className="text-xs text-ink-500 tabular-nums">
        {d.occupied}/{d.capacity} {d.department === 'OT' ? 'theatres' : 'beds'}
      </span>
      {next != null && (
        <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-xs font-semibold text-ink-900 tabular-nums">
          <Trend className="w-3.5 h-3.5 text-ink-500" aria-hidden="true" /> {next}% in 2h
        </span>
      )}
    </button>
  );
}

function Link({ blocked }) {
  const color = blocked ? '#EF4444' : 'rgb(var(--cream-200))';
  return (
    <span className="relative flex items-center justify-center shrink-0 h-8 lg:h-auto lg:w-12 lg:self-start lg:mt-[86px]" aria-label={blocked ? 'Flow blocked' : undefined} role={blocked ? 'img' : undefined}>
      <svg className="hidden lg:block w-12 h-3" viewBox="0 0 48 12" aria-hidden="true">
        <line x1="0" y1="6" x2="40" y2="6" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" className="flow-dash" />
        <path d="M38 1 L46 6 L38 11" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg className="lg:hidden w-3 h-8" viewBox="0 0 12 32" aria-hidden="true">
        <line x1="6" y1="0" x2="6" y2="24" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" className="flow-dash" />
        <path d="M1 22 L6 30 L11 22" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {blocked && (
        <span className="absolute -top-3 lg:-top-7 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#DC2626] text-white flex items-center justify-center" title="Flow blocked">
          <Ban className="w-3.5 h-3.5" aria-hidden="true" />
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
    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-center items-center overflow-x-auto py-2">
      {departments.map((d, i) => {
        const next = departments[i + 1];
        const blocked = Boolean(next && severityOf(next.utilization) === 'critical');
        return (
          <React.Fragment key={d.department}>
            <Node d={d} selected={selected === d.department} onSelect={onSelect} />
            {next && <Link blocked={blocked} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default BottleneckCascadeMap;
