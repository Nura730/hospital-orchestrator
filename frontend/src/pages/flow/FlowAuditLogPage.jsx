/**
 * @file FlowAuditLogPage.jsx
 * /admin/flow/audit: every flow event with who / when / what, filterable by type, CSV export.
 */

import React, { useState } from 'react';
import { ScrollText, ChevronDown } from 'lucide-react';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import StatusPill from '../../components/domain/StatusPill.jsx';
import { SectionHeader, FlowSkeleton, FlowEmpty, FlowError } from '../../components/domain/FlowUi.jsx';
import flowApi from '../../api/flowApi.js';
import { useFlowPolling } from '../../hooks/useFlowPolling.js';
import { dateTime, exportCsv } from '../../utils/flowFormat.js';

function summarize(e) {
  const p = e.payload || {};
  const r = e.result || {};
  if (e.error) return e.error;
  if (e.eventType === 'DISCHARGE_SIGNED') return `${r.alias || p.patientId} discharged · ${r.bedId || ''} → cleaning`;
  if (e.eventType === 'CLEANING_DONE') return `${p.bedId} ready${r.recommendation ? ` · suggested: ${r.recommendation.title}` : ''}`;
  if (e.eventType === 'OT_COMPLETE') return `${r.caseNumber || p.caseId} complete${r.postOpBedId ? ` · post-op ${r.postOpBedId}` : ''}`;
  if (e.eventType === 'PATIENT_DETERIORATED') return `${r.alias || p.patientId} → acuity ${r.acuity ?? p.newAcuity}`;
  if (e.eventType === 'AMBULANCE_INCOMING') return `ETA ${p.eta} min, acuity ${p.acuity}${r.bedId ? ` · ${r.bedId} ${r.bedMode}` : ''}`;
  return Object.keys(p).length ? JSON.stringify(p).slice(0, 120) : '—';
}

export default function FlowAuditLogPage() {
  const [type, setType] = useState('');
  const [open, setOpen] = useState(null);
  const q = useFlowPolling(() => flowApi.getAudit({ type: type || undefined, limit: 200 }), { intervalMs: 30000, deps: [type] });
  const events = q.data?.events || [];

  return (
    <div className="flow-page">
      <FlowPageHeader title="Flow Audit Log" subtitle="Every event that changed hospital state: who, when, what" crumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Flow Intelligence' }, { label: 'Audit Log' }]} />
      <section className="flow-card-pad">
        <SectionHeader
          title="Events"
          subtitle={`${events.length} shown`}
          icon={ScrollText}
          actions={
            <>
              <label className="sr-only" htmlFor="audit-type">
                Event type
              </label>
              <select id="audit-type" className="flow-input !w-auto !py-1.5" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">All event types</option>
                {(q.data?.types || []).map((t) => (
                  <option key={t.event_type} value={t.event_type}>
                    {t.event_type} ({t.n})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="flow-btn-secondary"
                onClick={() =>
                  exportCsv('flow_audit', [
                    { key: 'createdAt', label: 'When' },
                    { key: 'eventType', label: 'Event' },
                    { key: 'user', label: 'Who' },
                    { key: 'userType', label: 'Role' },
                    { key: 'processed', label: 'Processed' },
                    { key: 'payload', label: 'Payload' },
                    { key: 'result', label: 'Result' },
                  ], events)
                }
                disabled={!events.length}
              >
                Export CSV
              </button>
            </>
          }
        />
        {q.error && !q.data && <FlowError message={q.error} onRetry={q.refresh} />}
        {q.loading && !q.data ? (
          <FlowSkeleton lines={8} height="h-8" />
        ) : events.length === 0 ? (
          <FlowEmpty title="No events yet" message="Events appear as soon as anyone acts." />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="flow-table w-full min-w-[860px]">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Event</th>
                  <th scope="col">Who</th>
                  <th scope="col">What</th>
                  <th scope="col">Status</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <React.Fragment key={e.id}>
                    <tr>
                      <td className="tabular-nums text-ink-500">{dateTime(e.createdAt)}</td>
                      <td className="font-mono text-[11px] font-bold text-royal-700">{e.eventType}</td>
                      <td>
                        {e.user} <span className="text-[10px] text-ink-500">({e.userType})</span>
                      </td>
                      <td className="!whitespace-normal max-w-[420px]">{summarize(e)}</td>
                      <td>{e.error ? <StatusPill status="rejected" label="Failed" size="xs" /> : <StatusPill status="approved" label="Processed" size="xs" />}</td>
                      <td>
                        <button type="button" className="flow-btn-ghost !p-1" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id} aria-label="Show event details">
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    {open === e.id && (
                      <tr>
                        <td colSpan={6}>
                          <pre className="text-[11px] bg-[#0B1220] text-[#D5E2F5] rounded-xl p-3 overflow-auto max-h-60 whitespace-pre-wrap">{JSON.stringify({ payload: e.payload, result: e.result }, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
