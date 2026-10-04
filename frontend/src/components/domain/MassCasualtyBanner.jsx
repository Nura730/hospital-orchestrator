/**
 * @file MassCasualtyBanner.jsx
 * Red banner on every page, for every role, while mass-casualty mode is active: when it started, what
 * was done automatically, and the capacity runway (which department fills first and when, ticking down).
 * Live across tabs. Renders nothing when the mode is off or not available (real backend).
 */

import React, { useEffect, useState } from 'react';
import { Siren } from 'lucide-react';
import flowApi from '../../api/flowApi.js';
import { useFlowPolling } from '../../hooks/useFlowPolling.js';
import { firstToFill, formatRunway } from '../../utils/runway.js';
import { clock } from '../../utils/flowFormat.js';

export function MassCasualtyBanner() {
  const mciQ = useFlowPolling(() => flowApi.getMci(), { intervalMs: 30000, toastOnError: false, refreshOn: ['flow.mci'] });
  const active = Boolean(mciQ.data?.active);
  const bnQ = useFlowPolling(() => (active ? flowApi.getBottlenecks() : Promise.resolve(null)), { deps: [active], intervalMs: 30000, toastOnError: false });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [active]);

  if (!active) return null;
  const m = mciQ.data;
  // Beds are the constraint in a major incident; busy theatres are shown on the Bottleneck Map
  const first = firstToFill(bnQ.data?.bottlenecks || [], ['OT']);
  // Count down from when the forecast was made
  const elapsedH = bnQ.data?.analyzedAt ? Math.max(0, (now - new Date(bnQ.data.analyzedAt).getTime()) / 3600000) : 0;
  const left = first ? Math.max(0, first.hours - elapsedH) : null;

  return (
    <div role="alert" className="mb-4 rounded-2xl bg-[#B91C1C] text-white px-5 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
      <span className="flex items-center gap-3 min-w-0">
        <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0 animate-pulse">
          <Siren className="w-5 h-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-base font-bold tracking-wide">Mass casualty mode</span>
          <span className="block text-sm text-white/90">
            Active since {clock(m.startedAt)}. {m.casualties || 0} casualties admitted, {m.postponed?.length || 0} elective cases moved to tomorrow, {m.nudged || 0} discharges flagged.
          </span>
        </span>
      </span>
      <span className="ml-auto text-right">
        <span className="block text-xs uppercase tracking-wider text-white/80">Capacity runway</span>
        <span className="block text-lg font-bold tabular-nums">{first ? `${first.department}: ${formatRunway(left)}` : 'No ward fills within 12 h'}</span>
      </span>
    </div>
  );
}

export default MassCasualtyBanner;
