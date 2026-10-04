/**
 * @file DoctorRequestsPage.jsx
 * /doctor/requests: requests routed to this doctor, plus every request from this doctor's own patients
 * that a nurse or the admin team handles (shown with who is handling it, view only).
 * Left: inbox. Right: the request, who it is from and who answers, its progress, and actions: mark as seen,
 * reply and resolve, send to the theatre team (OT request) or decline. Live in every open tab.
 */

import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Inbox, Eye, Send, Scissors, XCircle, CheckCircle2, BedDouble, MessageSquareText, ArrowRight, UserRound } from 'lucide-react';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import StatusPill from '../../components/domain/StatusPill.jsx';
import PatientDetailPopup from '../../components/domain/PatientDetailPopup.jsx';
import { RequestSteps, RequestHistory, REQUEST_STATUS_LABEL } from '../../components/domain/RequestThread.jsx';
import { FlowError, FlowSkeleton } from '../../components/domain/FlowUi.jsx';
import { AcuityBadge, MiniEmpty } from '../../components/domain/CareUi.jsx';
import careApi from '../../api/careApi.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { timeAgo } from '../../utils/flowFormat.js';

const OPEN = ['new', 'acknowledged', 'in_progress', 'scheduled'];
const ROLE_NAME = { doctor: 'Doctor', nurse: 'Nurse', admin: 'Admin team' };

/** From who, to who: "Patient PF020 -> You" or "Patient PF020 -> Nurse Priya Sharma (you are kept informed)". */
function Route({ r }) {
  const from = r.source === 'patient' ? `Patient ${r.alias}` : r.createdBy;
  const to = r.canAct ? 'You' : r.routedTo?.name || 'Staff';
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-sunken px-2.5 py-1 font-semibold text-ink-900">
        <UserRound className="w-4 h-4 text-ink-500" aria-hidden="true" /> {from}
      </span>
      <ArrowRight className="w-4 h-4 text-ink-500" aria-label="sent to" />
      <span className={clsx('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold', r.canAct ? 'bg-royal-500/10 text-royal-500' : 'bg-sunken text-ink-900')}>
        {to}
        {!r.canAct && r.routedTo?.role && <span className="font-normal text-ink-500">({ROLE_NAME[r.routedTo.role] || r.routedTo.role})</span>}
      </span>
      {!r.canAct && <span className="text-ink-500">You are kept informed</span>}
    </div>
  );
}
const PRIORITY_COLOR = { urgent: '#DC2626', high: '#B45309', medium: '#014BAA', low: '#475569' };
const STATUS_TONE = { new: 'pending', acknowledged: 'in_progress', in_progress: 'in_progress', scheduled: 'scheduled', done: 'done', declined: 'rejected' };

function nextHalfHour(offsetMin = 60) {
  const d = new Date(Date.now() + offsetMin * 60000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SendToOt({ request, onDone }) {
  const [form, setForm] = useState({ procedure: '', urgency: 'urgent', start: nextHalfHour(90), duration: 90, notes: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await careApi.escalateToOt(request.id, request.patientId, { procedure: form.procedure.trim(), urgency: form.urgency, preferredStart: new Date(form.start).toISOString(), durationMin: Number(form.duration), notes: form.notes }, request.routedTo.name);
      toast.success('Sent to the theatre team. They will book a surgeon and theatre.');
      onDone();
    } catch (err) {
      toast.error(errorText(err, 'Could not send to OT'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="rounded-xl border border-[#6D28D9]/30 bg-[#8B5CF6]/5 p-4 space-y-3">
      <p className="text-sm font-semibold text-ink-900 flex items-center gap-2">
        <Scissors className="w-4 h-4 text-fg-violet" aria-hidden="true" /> Request a theatre slot
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold text-ink-900">Procedure</span>
          <input className="flow-input mt-1 !text-sm" required maxLength={80} value={form.procedure} onChange={(e) => setForm({ ...form, procedure: e.target.value })} placeholder="e.g. Laparoscopic cholecystectomy" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-900">Urgency</span>
          <select className="flow-input mt-1 !text-sm" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
            <option value="emergency">Emergency</option>
            <option value="urgent">Urgent</option>
            <option value="elective">Elective</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-900">Expected duration (min)</span>
          <input type="number" min={15} max={480} step={15} className="flow-input mt-1 !text-sm" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold text-ink-900">Preferred start</span>
          <input type="datetime-local" className="flow-input mt-1 !text-sm" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
        </label>
      </div>
      <button type="submit" className="flow-btn w-full !py-2.5 !text-sm text-white bg-[#6D28D9] hover:bg-[#5B21B6]" disabled={busy}>
        <Send className="w-4 h-4" aria-hidden="true" /> {busy ? 'Sending…' : 'Send to OT'}
      </button>
    </form>
  );
}

function Detail({ r, onOpenPatient, onChanged }) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(null);
  const [showOt, setShowOt] = useState(false);
  const open = OPEN.includes(r.status);
  const by = r.routedTo?.name || 'Doctor';

  useEffect(() => {
    setReply('');
    setShowOt(false);
  }, [r.id]);

  const act = async (kind) => {
    setBusy(kind);
    try {
      if (kind === 'seen') await careApi.updateRequest(r.id, { status: 'acknowledged', by });
      if (kind === 'resolve') await careApi.updateRequest(r.id, { status: 'done', response: reply.trim() || null, by });
      if (kind === 'decline') await careApi.updateRequest(r.id, { status: 'declined', response: reply.trim() || 'Not needed at this time', by });
      toast.success(kind === 'seen' ? 'Marked as seen. The patient can see that.' : kind === 'resolve' ? 'Resolved and the reply was sent' : 'Declined');
      setReply('');
      onChanged();
    } catch (e) {
      toast.error(errorText(e, 'Could not update the request'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{r.source === 'patient' ? 'From patient' : `From ${r.createdBy}`}</p>
          <h2 className="text-xl font-bold text-ink-900 mt-0.5">{r.typeLabel}</h2>
        </div>
        <button type="button" onClick={() => onOpenPatient(r.patientId)} className="flex items-center gap-3 rounded-xl border border-cream-200 px-3 py-2 hover:bg-sunken text-left">
          <BedDouble className="w-5 h-5 text-royal-500" aria-hidden="true" />
          <span>
            <span className="block text-sm font-bold text-ink-900">{r.alias}</span>
            <span className="block text-xs text-ink-500">{r.bedId || 'No bed'}</span>
          </span>
          {r.acuity && <AcuityBadge level={r.acuity} size="xs" />}
        </button>
      </div>

      <Route r={r} />

      <blockquote className="rounded-xl bg-sunken px-4 py-3 text-base text-ink-900 border-l-4 border-royal-500">
        <MessageSquareText className="inline w-4 h-4 mr-2 text-ink-500 align-[-2px]" aria-hidden="true" />
        {r.note || 'No message'}
      </blockquote>

      <RequestSteps status={r.status} history={r.history} />

      {r.response && (
        <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/5 px-4 py-3">
          <p className="text-xs font-semibold text-fg-ok uppercase tracking-wider">{r.canAct ? 'Your reply' : `Reply from ${r.routedTo?.name || 'staff'}`}</p>
          <p className="text-sm text-ink-900 mt-1">{r.response}</p>
        </div>
      )}

      {r.otRequest && (
        <div className="rounded-xl border border-[#6D28D9]/30 bg-[#8B5CF6]/5 px-4 py-3 text-sm text-ink-900">
          <p className="font-semibold">Theatre request: {r.otRequest.procedure}</p>
          <p className="text-ink-500 mt-0.5">
            {r.otRequest.status === 'pending' ? 'Waiting for the theatre team to book a surgeon and room' : r.otRequest.status === 'scheduled' ? `Booked with ${r.otRequest.surgeon} in OT-${r.otRequest.roomId}` : `Status: ${r.otRequest.status.replace('_', ' ')}`}
          </p>
        </div>
      )}

      {open && !r.canAct && (
        <p className="rounded-xl border border-cream-200 px-4 py-3 text-sm text-ink-500">
          {r.routedTo?.name || 'The care team'} is handling this. You will be notified at every step.
        </p>
      )}

      {open && r.canAct && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {r.status === 'new' && (
              <button type="button" className="flow-btn-secondary !py-2 !text-sm" disabled={!!busy} onClick={() => act('seen')}>
                <Eye className="w-4 h-4" aria-hidden="true" /> Mark as seen
              </button>
            )}
            {!r.otRequest && (
              <button type="button" className={clsx('flow-btn-secondary !py-2 !text-sm', showOt && '!border-[#6D28D9] !text-fg-violet')} onClick={() => setShowOt((v) => !v)} aria-expanded={showOt}>
                <Scissors className="w-4 h-4" aria-hidden="true" /> Send to OT
              </button>
            )}
          </div>
          {showOt && <SendToOt request={r} onDone={() => { setShowOt(false); onChanged(); }} />}
          <label className="block">
            <span className="text-xs font-semibold text-ink-900">Reply</span>
            <textarea className="flow-input mt-1 !text-sm min-h-[90px]" maxLength={300} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={r.source === 'patient' ? 'Your answer goes straight to the patient' : 'Note for the team'} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="flow-btn-success !py-2 !text-sm" disabled={!!busy} onClick={() => act('resolve')}>
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> {reply.trim() ? 'Reply and resolve' : 'Resolve'}
            </button>
            <button type="button" className="flow-btn-ghost !py-2 !text-sm" disabled={!!busy} onClick={() => act('decline')}>
              <XCircle className="w-4 h-4" aria-hidden="true" /> Decline
            </button>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3">History</h3>
        <RequestHistory history={r.history} />
      </div>
    </div>
  );
}

export default function DoctorRequestsPage() {
  const [view, setView] = useState('open');
  const [selected, setSelected] = useState(null);
  const [popup, setPopup] = useState(null);
  const q = useFlowPolling(() => careApi.listRequests('doctor'), { intervalMs: 60000 });
  const all = useMemo(() => q.data || [], [q.data]);
  const list = all.filter((r) => (view === 'open' ? OPEN.includes(r.status) : true));
  const current = all.find((r) => r.id === selected) || list[0] || null;
  const openCount = all.filter((r) => OPEN.includes(r.status)).length;

  return (
    <div>
      <FlowPageHeader
        title="Requests"
        subtitle="Requests for you to answer, and every request from your patients that the nurses or admin team handle"
        showHealth={false}
        actions={
          <div className="inline-flex rounded-lg border border-cream-200 bg-cream-50 p-0.5" role="group" aria-label="Show">
            {[
              ['open', `Open (${openCount})`],
              ['all', `All (${all.length})`],
            ].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k} className={clsx('px-3 py-1.5 rounded-md text-sm font-semibold', view === k ? 'bg-royal-500 text-white' : 'text-ink-500 hover:text-ink-900')}>
                {l}
              </button>
            ))}
          </div>
        }
      />
      {q.error && !q.data && <FlowError message={q.error} onRetry={q.refresh} />}
      {!q.data && !q.error && <FlowSkeleton lines={8} />}
      {q.data && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-4 items-start">
          <section className="flow-card overflow-hidden" aria-label="Inbox">
            {!list.length && <MiniEmpty text={view === 'open' ? 'No open requests. You are all caught up.' : 'No requests yet'} icon={Inbox} />}
            <ul>
              {list.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.id)}
                    aria-current={current?.id === r.id}
                    className={clsx('w-full text-left flex gap-3 px-4 py-3.5 border-b border-cream-200 transition-colors', current?.id === r.id ? 'bg-royal-500/5' : 'hover:bg-sunken')}
                  >
                    <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLOR[r.priority] || PRIORITY_COLOR.medium }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={clsx('text-sm truncate', r.status === 'new' ? 'font-bold text-ink-900' : 'font-semibold text-ink-900')}>{r.typeLabel}</span>
                        <span className="text-xs text-ink-500 shrink-0">{timeAgo(r.createdAt)}</span>
                      </span>
                      <span className="block text-sm text-ink-500 truncate mt-0.5">{r.note || 'No message'}</span>
                      <span className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-semibold text-ink-900">{r.alias}</span>
                        <span className="text-xs text-ink-500 truncate">{r.canAct ? (r.source === 'patient' ? 'Patient' : r.createdBy) : `${r.routedTo?.name || 'Staff'} handling`}</span>
                        <StatusPill status={STATUS_TONE[r.status]} label={REQUEST_STATUS_LABEL[r.status]} size="xs" className="ml-auto" />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="flow-card p-5 lg:sticky lg:top-0">{current ? <Detail r={current} onOpenPatient={setPopup} onChanged={() => q.refresh({ silent: true })} /> : <MiniEmpty text="Select a request" icon={Inbox} />}</section>
        </div>
      )}
      {popup && <PatientDetailPopup patientId={popup} onClose={() => setPopup(null)} />}
    </div>
  );
}
