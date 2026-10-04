/**
 * @file OtFlowImpactPage.jsx
 * /ot/flow/impact: ICU capacity impact (top) and upcoming OT cases against post-op beds (full width).
 */

import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import React from 'react';
import clsx from 'clsx';
import { CheckCircle2, AlertTriangle, XCircle, BedDouble, HeartPulse, ShieldAlert } from 'lucide-react';
import AiReportButton from '../../components/domain/AiReportButton.jsx';
import StatusPill from '../../components/domain/StatusPill.jsx';
import { FlowError, FlowSkeleton } from '../../components/domain/FlowUi.jsx';
import { StatTile, MiniEmpty } from '../../components/domain/CareUi.jsx';
import flowApi from '../../api/flowApi.js';
import { useFlowPolling } from '../../hooks/useFlowPolling.js';
import { clock } from '../../utils/flowFormat.js';

const BED = {
  YES: [CheckCircle2, 'Confirmed', 'text-fg-ok'],
  PREDICTED_FREE: [AlertTriangle, 'Not confirmed', 'text-fg-warn'],
  NO: [XCircle, 'None available', 'text-fg-bad'],
  'N/A': [CheckCircle2, 'Not needed', 'text-ink-500'],
};

export default function OtFlowImpactPage() {
  const q = useFlowPolling(() => flowApi.getOtImpact(), { intervalMs: 60000, refreshOn: ['ot.caseCompleted', 'bed.updated', 'flow.analysisComplete'] });
  const d = q.data;

  const o = d?.overflow;
  const shortage = o?.shortageRisk;
  const unconfirmed = (d?.upcoming || []).filter((c) => c.postOpRequired && c.availability !== 'YES').length;

  return (
    <div className="space-y-4">
      <FlowPageHeader
        title="OT Flow Impact"
        subtitle={d ? `${d.inProgress.length} in surgery, ${d.upcoming.length} upcoming, ${unconfirmed} without a confirmed post-op bed` : 'Loading…'}
        showHealth={false}
        actions={<AiReportButton scope="ot" variant="secondary" />}
      />

      {q.error && !d && <FlowError message={q.error} onRetry={q.refresh} />}
      {!d && !q.error && <FlowSkeleton lines={10} />}

      {d && (
        <>
          <section className="space-y-2" aria-label="Capacity impact">
            <h2 className="label-xs">Capacity impact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatTile icon={HeartPulse} value={o.icuDemand} label="ICU beds needed from OT" tone="violet" />
              <StatTile icon={BedDouble} value={o.icuAvailable} label="ICU beds available" tone={o.icuAvailable ? 'ok' : 'bad'} />
              <StatTile icon={ShieldAlert} value={shortage ? 'SHORTAGE' : 'OK'} label="Risk" tone={shortage ? 'bad' : 'ok'} />
            </div>
          </section>
          <section>
            <h2 className="label-xs mb-2">Upcoming cases vs beds</h2>
            {!d.upcoming.length ? (
              <div className="flow-card">
                <MiniEmpty text="No upcoming cases" />
              </div>
            ) : (
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Theatre impact table">
                <table className="mo-table">
                  <thead>
                    <tr>
                      <th scope="col">Case</th>
                      <th scope="col">Procedure</th>
                      <th scope="col">Start</th>
                      <th scope="col">Post-op bed</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.upcoming.map((c) => {
                      const [Icon, label, tone] = BED[c.availability] || BED['N/A'];
                      return (
                        <tr key={c.caseId}>
                          <td>
                            <span className="font-mono font-semibold">{c.caseNumber}</span>
                            <span className="block text-xs text-ink-500">
                              {c.room}, {c.alias}
                            </span>
                          </td>
                          <td className="max-w-[220px] truncate">{c.procedure}</td>
                          <td className="tabular-nums">{clock(c.scheduledStart)}</td>
                          <td>
                            <span className={clsx('inline-flex items-center gap-1.5 font-semibold', tone)}>
                              <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {label}
                              <span className="font-normal text-ink-500">({c.postOpType === 'icu' ? 'ICU' : 'Post-op'})</span>
                            </span>
                          </td>
                          <td>
                            <StatusPill status={c.urgency === 'emergency' ? 'urgent' : c.status} label={c.urgency === 'emergency' ? 'Emergency' : undefined} size="xs" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
