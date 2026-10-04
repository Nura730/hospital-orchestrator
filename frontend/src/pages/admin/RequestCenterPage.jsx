/**
 * @file RequestCenterPage.jsx
 * /admin/requests: every request in the hospital on one board: New, In progress, Scheduled, Closed.
 * Patient, nurse and admin requests plus theatre (OT) requests, with who each one is waiting on.
 * Live: cards move between columns as doctors, nurses and the theatre team act in their own tabs.
 */

import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Inbox, Stethoscope, Scissors, CheckCircle2, Timer, X, Eye, XCircle } from 'lucide-react';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import { RequestSteps, RequestHistory, REQUEST_STATUS_LABEL } from '../../components/domain/RequestThread.jsx';
import { FlowError, FlowSkeleton } from '../../components/domain/FlowUi.jsx';
import { StatTile, MiniEmpty } from '../../components/domain/CareUi.jsx';
import careApi from '../../api/careApi.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { clock, timeAgo } from '../../utils/flowFormat.js';

const COLUMNS = [
  ['new', 'New', '#DC2626'],
  ['progress', 'In progress', '#B45309'],
  ['scheduled', 'Scheduled', '#014BAA'],
  ['closed', 'Closed', '#047857'],
];
const OT_STATUS_TO_REQ = { pending: 'new', scheduled: 'scheduled', in_progress: 'scheduled', completed: 'done', declined: 'declined' };
const ROLE_LABEL = { doctor: 'Doctor', nurse: 'Nurse', admin: 'Admin', ot_manager: 'Theatre team' };

function columnOf(item) {
  if (item.status === 'new') return 'new';
  if (['acknowledged', 'in_progress'].includes(item.status)) return 'progress';
  if (item.status === 'scheduled') return 'scheduled';
  return 'closed';
}

/** Requests routed to the admin team (bed transfer, equipment, anything without a ward nurse) are answered here. */
function AdminActions({ item, onChanged }) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(null);
  const act = async (kind) => {
    setBusy(kind);
    try {
      const by = 'Admin team';
      if (kind === 'seen') await careApi.updateRequest(item.id, { status: 'acknowledged', by });
      if (kind === 'resolve') await careApi.updateRequest(item.id, { status: 'done', response: reply.trim() || null, by });
      if (kind === 'decline') await careApi.updateRequest(item.id, { status: 'declined', response: reply.trim() || 'Not possible at this time', by });
      toast.success(kind === 'seen' ? 'Marked as seen. The patient and their doctor can see that.' : kind === 'resolve' ? 'Resolved. The patient and their doctor were told.' : 'Declined');
      setReply('');
      onChanged();
    } catch (e) {
      toast.error(errorText(e, 'Could not update the request'));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-3 rounded-xl border border-cream-200 p-4">
      <p className="text-sm font-semibold text-ink-900">Your answer</p>
      {item.status === 'new' && (
        <button type="button" className="flow-btn-secondary !text-sm" disabled={!!busy} onClick={() => act('seen')}>
          <Eye className="w-4 h-4" aria-hidden="true" /> Mark as seen
        </button>
      )}
      <textarea className="flow-input !text-sm min-h-[80px]" maxLength={300} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply sent to the patient and their doctor" aria-label="Reply" />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="flow-btn-success !text-sm" disabled={!!busy} onClick={() => act('resolve')}>
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> {reply.trim() ? 'Reply and resolve' : 'Resolve'}
        </button>
        <button type="button" className="flow-btn-ghost !text-sm" disabled={!!busy} onClick={() => act('decline')}>
          <XCircle className="w-4 h-4" aria-hidden="true" /> Decline
        </button>
      </div>
    </div>
  );
}

function Drawer({ item, onClose, onChanged }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="absolute inset-0 bg-[#0F1117]/40" onClick={onClose} aria-hidden="true" />
      <aside className="relative w-full max-w-md h-full bg-cream-50 border-l border-cream-200 flex flex-col animate-slide-in-right">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-cream-200">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{item.kind === 'ot' ? 'Theatre request' : item.source === 'patient' ? 'Patient request' : 'Staff request'}</p>
            <h2 className="text-lg font-bold text-ink-900 mt-0.5">{item.title}</h2>
            <p className="text-sm text-ink-500">
              {item.alias}
              {item.bedId ? `, ${item.bedId}` : ''}
            </p>
          </div>
          <button type="button" className="flow-btn-ghost !p-1.5" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <RequestSteps status={item.status} />
          {item.note && <p className="rounded-xl bg-sunken px-4 py-3 text-sm text-ink-900">{item.note}</p>}
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-ink-500">Waiting on</dt>
              <dd className="text-sm font-semibold text-ink-900">{item.owner}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Raised</dt>
              <dd className="text-sm font-semibold text-ink-900">
                {clock(item.createdAt)} by {item.createdBy}
              </dd>
            </div>
          </dl>
          {item.canAct && !['done', 'declined'].includes(item.status) && <AdminActions item={item} onChanged={onChanged} />}
          {item.response && (
            <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/5 px-4 py-3">
              <p className="text-xs font-semibold text-fg-ok uppercase tracking-wider">Reply</p>
              <p className="text-sm text-ink-900 mt-1">{item.response}</p>
            </div>
          )}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3">History</h3>
            <RequestHistory history={item.history} />
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function RequestCenterPage() {
  const [openId, setOpenId] = useState(null);
  const reqQ = useFlowPolling(() => careApi.listRequests('admin'), { intervalMs: 60000 });
  const otQ = useFlowPolling(() => careApi.listOtRequests(), { intervalMs: 60000 });

  const items = useMemo(() => {
    const reqs = (reqQ.data || []).map((r) => ({
      id: r.id,
      kind: 'request',
      title: r.typeLabel,
      alias: r.alias,
      bedId: r.bedId,
      note: r.note,
      status: r.status,
      priority: r.priority,
      source: r.source,
      createdBy: r.source === 'patient' ? 'Patient' : r.createdBy,
      createdAt: r.createdAt,
      owner: r.otRequest && ['pending'].includes(r.otRequest.status) ? 'Theatre team' : `${r.routedTo?.name || '—'} (${ROLE_LABEL[r.routedTo?.role] || 'Staff'})`,
      history: r.history,
      ot: Boolean(r.otRequest),
      canAct: Boolean(r.canAct),
      response: r.response,
    }));
    const ots = (otQ.data || [])
      .filter((o) => !o.linkedRequestId)
      .map((o) => ({
        id: o.id,
        kind: 'ot',
        title: `Surgery: ${o.procedure}`,
        alias: o.alias,
        bedId: o.bedId,
        note: o.status === 'pending' ? `${o.urgency} request from ${o.requestedBy?.name}` : o.surgeon ? `Booked with ${o.surgeon}, OT-${o.roomId} at ${clock(o.start)}` : null,
        status: OT_STATUS_TO_REQ[o.status],
        priority: o.urgency === 'emergency' ? 'urgent' : o.urgency === 'urgent' ? 'high' : 'medium',
        source: 'doctor',
        createdBy: o.requestedBy?.name,
        createdAt: o.createdAt,
        owner: o.status === 'pending' ? 'Theatre team' : o.surgeon || 'Theatre team',
        history: o.history,
        ot: true,
      }));
    return [...reqs, ...ots].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [reqQ.data, otQ.data]);

  const loading = !reqQ.data || !otQ.data;
  const error = reqQ.error || otQ.error;
  const open = items.filter((i) => columnOf(i) !== 'closed');
  const today = new Date().setHours(0, 0, 0, 0);
  const current = items.find((i) => i.id === openId);

  return (
    <div>
      <FlowPageHeader title="Request Center" subtitle="Every request in the hospital and who it is waiting on, updated live" showHealth={false} />
      {error && loading && <FlowError message={error} onRetry={() => { reqQ.refresh(); otQ.refresh(); }} />}
      {loading && !error && <FlowSkeleton lines={8} />}
      {!loading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <StatTile icon={Inbox} value={open.length} label="Open requests" tone={open.length ? 'warn' : 'ok'} />
            <StatTile icon={Stethoscope} value={open.filter((i) => / \(Doctor\)$/.test(i.owner)).length} label="Waiting on doctors" />
            <StatTile icon={Scissors} value={open.filter((i) => i.owner === 'Theatre team').length} label="Waiting on theatre team" tone="violet" />
            <StatTile icon={CheckCircle2} value={items.filter((i) => columnOf(i) === 'closed' && new Date(i.history?.at(-1)?.at || i.createdAt).getTime() >= today).length} label="Closed today" tone="ok" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {COLUMNS.map(([key, label, color]) => {
              const col = items.filter((i) => columnOf(i) === key).slice(0, key === 'closed' ? 12 : undefined);
              return (
                <section key={key} className="rounded-xl bg-sunken/70 border border-cream-200 p-3" aria-label={label}>
                  <h2 className="flex items-center gap-2 px-1 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                    <span className="text-sm font-bold text-ink-900">{label}</span>
                    <span className="ml-auto rounded-full bg-cream-50 border border-cream-200 px-2 text-xs font-semibold tabular-nums text-ink-900">{items.filter((i) => columnOf(i) === key).length}</span>
                  </h2>
                  {!col.length && <MiniEmpty text="Nothing here" />}
                  <ul className="space-y-2">
                    {col.map((i) => (
                      <li key={i.id}>
                        <button type="button" onClick={() => setOpenId(i.id)} className="w-full text-left flow-card p-3 hover:border-royal-500/40 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-ink-900 leading-snug">{i.title}</p>
                            {i.ot && <Scissors className="w-4 h-4 text-fg-violet shrink-0 mt-0.5" aria-label="Theatre" />}
                          </div>
                          <p className="text-xs text-ink-500 mt-1">
                            <b className="text-ink-900">{i.alias}</b>
                            {i.bedId ? ` in ${i.bedId}` : ''}
                          </p>
                          <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-cream-200">
                            <span className="text-xs text-ink-500 truncate">{i.owner}</span>
                            <span className="inline-flex items-center gap-1 text-xs text-ink-500 shrink-0">
                              <Timer className="w-3 h-3" aria-hidden="true" /> {timeAgo(i.createdAt)}
                            </span>
                          </div>
                          {key !== 'new' && key !== 'closed' && <p className={clsx('text-xs font-semibold mt-1.5', key === 'scheduled' ? 'text-royal-500' : 'text-fg-warn')}>{REQUEST_STATUS_LABEL[i.status]}</p>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
      {current && <Drawer item={current} onClose={() => setOpenId(null)} onChanged={() => { reqQ.refresh({ silent: true }); otQ.refresh({ silent: true }); }} />}
    </div>
  );
}
