/**
 * @file OtFlowImpactPage.jsx
 * /ot/flow/impact
 * Numbers: surgeries in progress holding post-op beds, predicted ICU demand from OT in 3h.
 * Upcoming cases with post-op bed required/available (YES / NO / PREDICTED FREE) + risk warning.
 * Overflow card ("ICU demand 3 | available 2 | SHORTAGE RISK") + "Defer non-urgent case".
 * "Case Complete" fires OT_COMPLETE. AI report (scope "ot").
 */

import React, { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Scissors, AlertOctagon, CheckCircle2, Clock, PauseCircle } from 'lucide-react';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import FlowKpiCard from '../../components/domain/FlowKpiCard.jsx';
import StatusPill from '../../components/domain/StatusPill.jsx';
import AmbulanceIncomingAlert from '../../components/domain/AmbulanceIncomingAlert.jsx';
import AiReportButton from '../../components/domain/AiReportButton.jsx';
import { SectionHeader, FlowSkeleton, FlowEmpty, FlowError } from '../../components/domain/FlowUi.jsx';
import flowApi from '../../api/flowApi.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { clock, timeUntil } from '../../utils/flowFormat.js';

export function CaseCompleteButton({ caseItem, onDone, className = '' }) {
  const [busy, setBusy] = useState(false);
  const complete = async () => {
    setBusy(true);
    try {
      const r = await flowApi.postEvent('OT_COMPLETE', { caseId: caseItem.caseId });
      toast.success(`${caseItem.caseNumber} complete · room → cleaning${r?.result?.postOpBedId ? ` · post-op bed ${r.result.postOpBedId}` : ''}`);
      onDone?.();
    } catch (e) {
      toast.error(errorText(e, 'Could not complete case'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className={clsx('flow-btn-primary !py-1 !px-2', className)} onClick={complete} disabled={busy}>
      <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> {busy ? 'Saving…' : 'Case Complete'}
    </button>
  );
}

export default function OtFlowImpactPage() {
  const impact = useFlowPolling(() => flowApi.getOtImpact(), { intervalMs: 60000, refreshOn: ['ot.caseCompleted', 'bed.updated', 'flow.analysisComplete'] });
  const numbers = useFlowPolling(() => flowApi.getDashboardNumbers('ot'), { intervalMs: 60000, refreshOn: ['ot.caseCompleted'] });
  const [deferring, setDeferring] = useState(null);
  const d = impact.data;

  const refresh = () => {
    impact.refresh({ silent: true });
    numbers.refresh({ silent: true });
  };

  const defer = async (c) => {
    setDeferring(c ? c.caseId : 'any');
    const target = c || (d?.upcoming || []).find((x) => x.urgency === 'elective' && x.availability !== 'YES') || (d?.upcoming || []).find((x) => x.urgency === 'elective');
    if (!target) {
      toast('No elective case to defer');
      setDeferring(null);
      return;
    }
    try {
      await flowApi.createRecommendationBatch(
        [{ type: 'defer_ot', text: `Defer ${target.caseNumber} (${target.procedure})`, impact: `Frees one ${target.postOpType === 'icu' ? 'ICU' : 'post-op'} bed`, why: target.risk || 'Post-op capacity is constrained', relatedType: 'ot_case', relatedId: target.caseId }],
        { autoApprove: false, source: 'ot_flow_impact' }
      );
      toast.success(`Deferral of ${target.caseNumber} submitted for approval`);
    } catch (e) {
      toast.error(errorText(e, 'Could not submit deferral'));
    } finally {
      setDeferring(null);
    }
  };

  return (
    <div className="flow-page">
      <FlowPageHeader
        title="OT Flow Impact"
        subtitle="How theatre activity drives post-op and ICU bed demand"
        crumbs={[{ label: 'OT', to: '/ot/dashboard' }, { label: 'Flow Impact' }]}
        actions={<AiReportButton scope="ot" />}
      />
      <AmbulanceIncomingAlert />
      {impact.error && !d && <FlowError message={impact.error} onRetry={impact.refresh} />}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5" aria-label="OT numbers">
        {(numbers.data?.kpis || Array.from({ length: 5 }).map(() => null)).map((k, i) => (
          <FlowKpiCard key={k ? k.key : i} kpi={k} loading={!k} series={numbers.data?.series} />
        ))}
      </section>

      {d && (
        <section
          role={d.overflow.shortageRisk ? 'alert' : 'status'}
          className={clsx('rounded-2xl border-2 p-4 mb-5 flex flex-wrap items-center gap-4', d.overflow.shortageRisk ? 'border-[#D64545] bg-[#D64545]/5' : 'border-[#1FA971]/50 bg-[#1FA971]/5')}
        >
          {d.overflow.shortageRisk ? <AlertOctagon className="w-8 h-8 text-[#D64545]" aria-hidden="true" /> : <CheckCircle2 className="w-8 h-8 text-[#1FA971]" aria-hidden="true" />}
          <div className="flex-1 min-w-[220px]">
            <p className="text-[11px] uppercase font-bold tracking-wide text-ink-500">ICU overflow risk (next 3h)</p>
            <p className={clsx('text-xl font-extrabold tabular-nums', d.overflow.shortageRisk ? 'text-[#B02E2E]' : 'text-[#13784F]')}>
              ICU demand {d.overflow.icuDemand} | available {d.overflow.icuAvailable}
              {d.overflow.shortageRisk && ' | SHORTAGE RISK'}
            </p>
          </div>
          <button type="button" className="flow-btn-danger" onClick={() => defer(null)} disabled={!!deferring}>
            <PauseCircle className="w-3.5 h-3.5" aria-hidden="true" /> {deferring === 'any' ? 'Submitting…' : 'Defer non-urgent case'}
          </button>
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="flow-card-pad" aria-label="In progress">
          <SectionHeader title="In progress" subtitle={d ? `${d.holdingPostOpBeds} holding post-op beds` : ''} icon={Scissors} />
          {impact.loading && !d ? (
            <FlowSkeleton lines={3} height="h-14" />
          ) : !d?.inProgress.length ? (
            <FlowEmpty title="No surgeries running" message="Theatres are idle." />
          ) : (
            <ul className="space-y-2">
              {d.inProgress.map((c) => (
                <li key={c.caseId} className="rounded-xl border border-cream-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-royal-900">
                      {c.caseNumber} · {c.room}
                    </span>
                    <StatusPill status={c.postOpType === 'icu' ? 'critical' : 'reserved'} label={c.postOpType === 'icu' ? 'ICU after' : 'PACU after'} size="xs" />
                  </div>
                  <p className="text-[11px] text-ink-500 mt-0.5">
                    {c.procedure} · {c.alias}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-ink-500 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" aria-hidden="true" /> ends {clock(c.expectedEnd)} ({timeUntil(c.expectedEnd)})
                    </span>
                    <CaseCompleteButton caseItem={c} onDone={refresh} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="xl:col-span-2 flow-card-pad" aria-label="Upcoming cases">
          <SectionHeader title="Upcoming cases (12h)" subtitle="Post-op bed check per case" icon={Clock} />
          {impact.loading && !d ? (
            <FlowSkeleton lines={5} height="h-9" />
          ) : !d?.upcoming.length ? (
            <FlowEmpty title="No upcoming cases" message="Nothing scheduled in the next 12 hours." />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="flow-table w-full min-w-[820px]">
                <thead>
                  <tr>
                    <th scope="col">Start</th>
                    <th scope="col">Case</th>
                    <th scope="col">Urgency</th>
                    <th scope="col">Post-op bed</th>
                    <th scope="col">Available</th>
                    <th scope="col">Risk</th>
                    <th scope="col" className="!text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {d.upcoming.map((c) => (
                    <tr key={c.caseId} className={c.availability === 'NO' ? '!bg-[#D64545]/5' : ''}>
                      <td className="tabular-nums font-semibold">{clock(c.scheduledStart)}</td>
                      <td>
                        <div className="font-bold text-royal-900">{c.caseNumber}</div>
                        <div className="text-[10px] text-ink-500">
                          {c.procedure} · {c.room} · {c.surgeon}
                        </div>
                      </td>
                      <td>
                        <StatusPill status={c.urgency === 'elective' ? 'admitted' : 'critical'} label={c.urgency} size="xs" />
                      </td>
                      <td className="text-ink-500">{c.postOpRequired ? (c.postOpType === 'icu' ? 'ICU' : 'PACU') : 'Not required'}</td>
                      <td>
                        <StatusPill status={c.availability} dot={false} size="xs" />
                      </td>
                      <td className="!whitespace-normal text-[11px] text-[#8A5200] max-w-[240px]">{c.risk || '—'}</td>
                      <td className="!text-right">
                        {c.urgency === 'elective' && c.availability !== 'YES' && (
                          <button type="button" className="flow-btn-secondary !py-1 !px-2" onClick={() => defer(c)} disabled={!!deferring}>
                            {deferring === c.caseId ? '…' : 'Defer'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
