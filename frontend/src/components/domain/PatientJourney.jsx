/**
 * @file PatientJourney.jsx
 * Plain-language patient journey strip (Emergency → Radiology → Ward → HDU → ICU → OT) in traffic-light
 * colors, plus the shared vocabulary used by the Command Center and the Bottleneck Map.
 * Arrow thickness = how full the step is; red arrow = the next step is overloaded.
 */

import React from 'react';
import clsx from 'clsx';
import { ArrowRight, ArrowDown } from 'lucide-react';

export const STATUS = {
  HIGH: { word: 'Overloaded', color: '#EF4444', soft: 'bg-[#EF4444]/10', text: 'text-fg-bad', border: 'border-[#EF4444]' },
  MEDIUM: { word: 'Getting busy', color: '#F59E0B', soft: 'bg-[#F59E0B]/15', text: 'text-fg-warn', border: 'border-[#F59E0B]' },
  LOW: { word: 'Running smoothly', color: '#10B981', soft: 'bg-[#10B981]/10', text: 'text-fg-ok', border: 'border-[#10B981]' },
};

export const FRIENDLY_NAME = {
  Emergency: 'Emergency (ED)',
  Radiology: 'Radiology (scans)',
  'General Ward': 'General Ward',
  HDU: 'High Dependency (HDU)',
  ICU: 'Intensive Care (ICU)',
  OT: 'Operating Theatres',
};

export const SHORT_NAME = { Emergency: 'Emergency', Radiology: 'Radiology', 'General Ward': 'Ward', HDU: 'HDU', ICU: 'ICU', OT: 'Theatres' };

export const pct = (v) => Math.round((v || 0) * 100);

/**
 * @param {{ list: object[], title?: string, subtitle?: string, compact?: boolean, showLegend?: boolean }} props
 * Each item needs: department, utilization (0-1), predicted {2}, severity, rootCause, isCascade.
 */
export function PatientJourney({ list = [], title = 'The patient journey', subtitle = 'Patients usually move left to right. A jam in one step slows every step after it.', compact = false, showLegend = true, bare = false }) {
  const body = (
    <>
      {title && <h3 className="text-sm font-bold text-royal-900">{title}</h3>}
      {subtitle && <p className="text-xs text-ink-500 mb-4">{subtitle}</p>}
      <ol className="flex flex-col md:flex-row md:items-stretch gap-1 pt-2">
        {list.map((b, i) => {
          const s = STATUS[b.severity] || STATUS.LOW;
          const next = list[i + 1];
          const nextOverloaded = next && next.severity === 'HIGH';
          const thickness = Math.max(2, Math.min(8, Math.round((b.utilization || 0) * 8)));
          const now = pct(b.utilization);
          const later = pct(b.predicted?.[2] ?? b.predicted2h ?? b.utilization);
          return (
            <li key={b.department} className="flex flex-col md:flex-row md:items-center flex-1 min-w-0">
              <div className={clsx('flex-1 rounded-xl border-2 px-2 py-3 text-center relative', s.border, s.soft, b.rootCause && 'ring-4 ring-[#EF4444]/25')}>
                {(b.rootCause || b.isCascade) && (
                  <span className={clsx('absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-extrabold text-white', b.rootCause ? 'bg-[#EF4444]' : 'bg-[#F97316]')}>
                    {b.rootCause ? 'PROBLEM STARTS HERE' : 'KNOCK-ON EFFECT'}
                  </span>
                )}
                <div className="text-xs font-bold text-royal-900 mt-1">{SHORT_NAME[b.department] || b.department}</div>
                <div className={clsx('font-extrabold tabular-nums', compact ? 'text-xl' : 'text-2xl', s.text)}>{now}%</div>
                <div className={clsx('text-[10px] font-semibold', s.text)}>{s.word}</div>
                {!compact && (
                  <div className="text-[10px] text-ink-500 mt-0.5 tabular-nums">
                    in 2h: <b className={later > now ? 'text-fg-bad' : later < now ? 'text-fg-ok' : 'text-ink-900'}>{later}%</b>
                  </div>
                )}
              </div>
              {next && (
                <div className="flex md:flex-row flex-col items-center justify-center md:px-1 py-1" aria-hidden="true">
                  <div className="hidden md:block rounded-full" style={{ width: 12, height: thickness, backgroundColor: nextOverloaded ? '#EF4444' : '#94A3B8' }} />
                  <ArrowRight className={clsx('hidden md:block w-4 h-4 -ml-1', nextOverloaded ? 'text-[#EF4444]' : 'text-[#94A3B8]')} />
                  <ArrowDown className={clsx('md:hidden w-4 h-4', nextOverloaded ? 'text-[#EF4444]' : 'text-[#94A3B8]')} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {showLegend && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 text-[11px] text-ink-500" aria-label="Legend">
          {Object.values(STATUS).map((s) => (
            <span key={s.word} className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" /> {s.word}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-1.5 rounded-full bg-[#EF4444]" aria-hidden="true" /> Red arrow: next step overloaded
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-1 rounded-full bg-[#94A3B8]" aria-hidden="true" /> Thicker arrow: fuller step
          </span>
        </div>
      )}
    </>
  );
  if (bare) return <div aria-label="Patient journey">{body}</div>;
  return (
    <section className="flow-card-pad" aria-label="Patient journey">
      {body}
    </section>
  );
}

export default PatientJourney;
