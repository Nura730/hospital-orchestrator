/**
 * @file HousekeepingBoardPage.jsx
 * /admin/flow/housekeeping: dirty beds (oldest first) with one-tap "Cleaning Done" (CLEANING_DONE event)
 * and recently cleaned beds.
 */

import React, { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import { SectionHeader, FlowSkeleton, FlowEmpty, FlowError } from '../../components/domain/FlowUi.jsx';
import flowApi from '../../api/flowApi.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';

export default function HousekeepingBoardPage() {
  const q = useFlowPolling(() => flowApi.getHousekeeping(), { intervalMs: 30000, refreshOn: ['bed.updated'] });
  const [busy, setBusy] = useState(null);
  const d = q.data;

  const done = async (bedId) => {
    setBusy(bedId);
    try {
      const r = await flowApi.postEvent('CLEANING_DONE', { bedId });
      toast.success(`${bedId} is ready`);
      if (r?.result?.recommendation) toast(`Next: ${r.result.recommendation.title}`);
      q.refresh({ silent: true });
    } catch (e) {
      toast.error(errorText(e, 'Could not update bed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flow-page">
      <FlowPageHeader title="Housekeeping Board" subtitle="Turn dirty beds into ready beds: one tap per bed" crumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Flow Intelligence' }, { label: 'Housekeeping' }]} />
      {q.error && !d && <FlowError message={q.error} onRetry={q.refresh} />}
      {d && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            ['Dirty beds', d.counts.dirty, '#F59E0B'],
            ['Overdue (> 45 min)', d.counts.overdue, '#EF4444'],
            ['Cleaned last 4h', d.counts.cleanedLast4h, '#10B981'],
            ['Available now', d.counts.available, '#014BAA'],
          ].map(([l, v, c]) => (
            <div key={l} className="flow-card px-4 py-3 border-t-4" style={{ borderTopColor: c }}>
              <div className="text-xs uppercase font-semibold text-ink-500">{l}</div>
              <div className="text-3xl font-extrabold tabular-nums text-royal-900">{v}</div>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="flow-card-pad">
          <SectionHeader title="Waiting for cleaning" subtitle="Oldest first" icon={Sparkles} />
          {q.loading && !d ? (
            <FlowSkeleton lines={4} height="h-14" />
          ) : !d?.cleaning.length ? (
            <FlowEmpty icon={CheckCircle2} title="All clean" message="No beds are waiting for housekeeping." />
          ) : (
            <ul className="space-y-2">
              {d.cleaning.map((b) => (
                <li key={b.id} className={clsx('flex items-center gap-3 rounded-xl border-2 p-3', b.waitingMinutes > 45 ? 'border-[#EF4444]/50 bg-[#EF4444]/5' : 'border-[#F59E0B]/50 bg-[#F59E0B]/5')}>
                  <span className="font-mono font-extrabold text-sm text-royal-900 w-16">{b.id}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs truncate">
                      {b.ward} · {b.zone}
                    </span>
                    <span className={clsx('block text-xs font-semibold', b.waitingMinutes > 45 ? 'text-fg-bad' : 'text-fg-warn')}>
                      {b.waitingMinutes > 45 && <AlertTriangle className="inline w-3 h-3 mr-0.5" aria-hidden="true" />}
                      waiting {b.waitingMinutes} min
                    </span>
                  </span>
                  <button type="button" className="flow-btn-primary !py-2.5 !px-4" onClick={() => done(b.id)} disabled={busy === b.id}>
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> {busy === b.id ? 'Saving…' : 'Cleaning Done'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="flow-card-pad">
          <SectionHeader title="Ready (cleaned in the last 4h)" icon={CheckCircle2} />
          {!d?.ready.length ? (
            <FlowEmpty title="Nothing cleaned recently" message="Beds marked clean appear here." />
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {d.ready.map((b) => (
                <li key={b.id} className="rounded-xl bg-[#10B981]/10 border border-[#10B981]/40 px-3 py-2">
                  <div className="font-mono font-bold text-xs text-fg-ok">{b.id}</div>
                  <div className="text-[11px] text-ink-500">{b.cleanedMinutesAgo} min ago</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
