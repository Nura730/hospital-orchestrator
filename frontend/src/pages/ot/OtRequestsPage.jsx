/**
 * @file OtRequestsPage.jsx
 * /ot/requests: the theatre team's request queue. Pick a request, choose a time, and the page shows
 * which surgeons and theatres are free at that time (busy ones show why). Booking creates the OT case,
 * gives the bedside nurse pre-op and transport tasks, and notifies the doctors and the patient.
 */

import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ClipboardList, Siren, CalendarCheck, DoorOpen, Clock3, UserRound, Check, XCircle, Stethoscope, CalendarClock } from 'lucide-react';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import StatusPill from '../../components/domain/StatusPill.jsx';
import { RequestHistory } from '../../components/domain/RequestThread.jsx';
import { FlowError, FlowSkeleton } from '../../components/domain/FlowUi.jsx';
import { StatTile, AcuityBadge, IcuRiskBadge, MiniEmpty, Avatar } from '../../components/domain/CareUi.jsx';
import careApi from '../../api/careApi.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { clock, dateTime, timeAgo } from '../../utils/flowFormat.js';

const URGENCY = {
  emergency: { label: 'Emergency', color: '#B91C1C', bg: 'rgba(239,68,68,0.10)' },
  urgent: { label: 'Urgent', color: '#92400E', bg: 'rgba(245,158,11,0.12)' },
  elective: { label: 'Elective', color: '#014BAA', bg: 'rgba(1,75,170,0.08)' },
};
const STATUS_TONE = { pending: 'pending', scheduled: 'scheduled', in_progress: 'in_surgery', completed: 'completed', declined: 'rejected' };

const pad = (n) => String(n).padStart(2, '0');
function toLocalInput(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function defaultStart(o) {
  if (o.preferredStart && new Date(o.preferredStart).getTime() > Date.now()) return toLocalInput(new Date(o.preferredStart).getTime());
  const d = new Date(Date.now() + (o.urgency === 'emergency' ? 20 : 60) * 60000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return toLocalInput(d.getTime());
}

function UrgencyTag({ urgency }) {
  const u = URGENCY[urgency] || URGENCY.elective;
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold" style={{ color: u.color, backgroundColor: u.bg }}>
      {u.label}
    </span>
  );
}

function Scheduler({ o, onBooked }) {
  const [start, setStart] = useState(() => defaultStart(o));
  const [duration, setDuration] = useState(o.durationMin || 90);
  const [surgeonId, setSurgeonId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const startIso = useMemo(() => new Date(start).toISOString(), [start]);
  const av = useFlowPolling(() => careApi.otAvailability(startIso, duration), { deps: [startIso, duration, o.id], toastOnError: false });

  useEffect(() => {
    setStart(defaultStart(o));
    setDuration(o.durationMin || 90);
    setSurgeonId(null);
    setRoomId(null);
    setReason('');
  }, [o.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drop a choice that became unavailable after the time changed
  useEffect(() => {
    if (!av.data) return;
    if (surgeonId && !av.data.surgeons.find((s) => s.id === surgeonId)?.free) setSurgeonId(null);
    if (roomId && !av.data.rooms.find((r) => r.roomId === roomId)?.free) setRoomId(null);
  }, [av.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const book = async () => {
    setBusy(true);
    try {
      const r = await careApi.scheduleOtRequest(o.id, { surgeonId, roomId, start: startIso, durationMin: Number(duration) }, 'OT Manager');
      toast.success(`Booked: ${r.procedure} at ${clock(r.start)} in OT-${r.roomId} with ${r.surgeon}. Doctor, nurse and patient notified.`, { duration: 5000 });
      onBooked();
    } catch (e) {
      toast.error(errorText(e, 'Could not book'));
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await careApi.declineOtRequest(o.id, reason.trim(), 'OT Manager');
      toast.success('Request declined; the doctor was told');
      onBooked();
    } catch (e) {
      toast.error(errorText(e, 'Could not decline'));
    } finally {
      setBusy(false);
    }
  };

  const surgeons = av.data?.surgeons || [];
  const free = surgeons.filter((s) => s.free);
  const taken = surgeons.filter((s) => !s.free && s.status !== 'off_duty');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="block">
          <span className="text-xs font-semibold text-ink-900">Start time</span>
          <input type="datetime-local" className="flow-input mt-1 !text-sm" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-900">Duration (min)</span>
          <input type="number" min={15} max={480} step={15} className="flow-input mt-1 !text-sm w-32" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </label>
      </div>

      {av.data?.nextFree && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-3">
          <p className="text-sm text-ink-900 flex-1 min-w-[200px]">
            No surgeon and theatre are both free at {clock(startIso)}. The next free slot is <b>{dateTime(av.data.nextFree)}</b>.
          </p>
          <button type="button" className="flow-btn-primary !py-2 !text-sm" onClick={() => setStart(toLocalInput(new Date(av.data.nextFree).getTime()))}>
            <CalendarClock className="w-4 h-4" aria-hidden="true" /> Use {clock(av.data.nextFree)}
          </button>
        </div>
      )}

      <section>
        <h3 className="text-sm font-semibold text-ink-900 mb-2 flex items-center gap-2">
          <UserRound className="w-4 h-4 text-royal-500" aria-hidden="true" /> Surgeons free at {clock(startIso)}
          <span className="text-xs font-normal text-ink-500">{free.length} available</span>
        </h3>
        {!av.data && <FlowSkeleton lines={3} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2" role="radiogroup" aria-label="Surgeon">
          {free.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={surgeonId === s.id}
              onClick={() => setSurgeonId(s.id)}
              className={clsx('flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors', surgeonId === s.id ? 'border-royal-500 bg-royal-500/5' : 'border-cream-200 hover:border-royal-500/40')}
            >
              <Avatar name={s.name} size="sm" color={s.surgical ? '#014BAA' : '#475569'} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-900 truncate">{s.name}</span>
                <span className="block text-xs text-ink-500 truncate">
                  {s.specialty}
                  {s.casesToday ? `, ${s.casesToday} case${s.casesToday > 1 ? 's' : ''} today` : ', no cases today'}
                </span>
              </span>
              {surgeonId === s.id && <Check className="w-5 h-5 text-royal-500 shrink-0" aria-hidden="true" />}
            </button>
          ))}
        </div>
        {taken.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs font-semibold text-ink-500 cursor-pointer select-none">Not available at this time ({taken.length})</summary>
            <ul className="mt-2 space-y-1">
              {taken.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-lg bg-sunken px-3 py-2 text-sm">
                  <span className="font-semibold text-ink-900 w-44 truncate">{s.name}</span>
                  <span className="text-ink-500 truncate">{s.reason}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink-900 mb-2 flex items-center gap-2">
          <DoorOpen className="w-4 h-4 text-royal-500" aria-hidden="true" /> Theatre
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Theatre">
          {(av.data?.rooms || []).map((r) => (
            <button
              key={r.roomId}
              type="button"
              role="radio"
              aria-checked={roomId === r.roomId}
              disabled={!r.free}
              onClick={() => setRoomId(r.roomId)}
              title={r.reason || 'Free'}
              className={clsx('rounded-xl border-2 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed', roomId === r.roomId ? 'border-royal-500 bg-royal-500/5' : r.free ? 'border-cream-200 hover:border-royal-500/40' : 'border-cream-200 bg-sunken')}
            >
              <span className="block text-sm font-bold text-ink-900">{r.name}</span>
              <span className={clsx('block text-xs truncate', r.free ? 'text-fg-ok' : 'text-ink-500')}>{r.free ? 'Free' : r.reason}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="button" className="flow-btn-primary !py-2.5 !px-5 !text-sm" disabled={busy || !surgeonId || !roomId} onClick={book}>
          <CalendarCheck className="w-4 h-4" aria-hidden="true" /> Book surgery
        </button>
        <span className="text-xs text-ink-500">{!surgeonId ? 'Choose a surgeon' : !roomId ? 'Choose a theatre' : 'Doctor, bedside nurse and patient will be notified'}</span>
      </div>
      <div className="flex flex-wrap gap-2 items-end border-t border-cream-200 pt-4">
        <label className="block flex-1 min-w-[200px]">
          <span className="text-xs font-semibold text-ink-900">Decline with a reason</span>
          <input className="flow-input mt-1 !text-sm" maxLength={150} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. No ICU bed for post-op today" />
        </label>
        <button type="button" className="flow-btn-ghost !py-2 !text-sm" disabled={busy} onClick={decline}>
          <XCircle className="w-4 h-4" aria-hidden="true" /> Decline
        </button>
      </div>
    </div>
  );
}

/** Booked or running case: start it, or mark it complete (patient goes to a recovery bed). */
function CaseActions({ o, onChanged }) {
  const [busy, setBusy] = useState(false);
  // Which theatres are free right now (the booked one may still be running an earlier case)
  const nowIso = useMemo(() => new Date().toISOString(), [o.id, o.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = useFlowPolling(() => careApi.otAvailability(nowIso, 30), { deps: [nowIso], toastOnError: false, live: o.status === 'scheduled' });
  const booked = now.data?.rooms.find((r) => r.roomId === o.roomId);
  const freeNow = now.data?.rooms.filter((r) => r.free) || [];
  const startRoom = booked?.free ? o.roomId : freeNow[0]?.roomId;
  const run = async (kind) => {
    setBusy(true);
    try {
      if (kind === 'start') {
        await careApi.assignCase(startRoom, o.caseId);
        toast.success(`Surgery started in OT-${startRoom}. ${o.bedId || 'The ward bed'} was sent to housekeeping.`);
      } else {
        await careApi.completeCase(o.caseId, o.roomId);
        toast.success(`Surgery complete. ${o.alias} moved to a recovery bed; OT-${o.roomId} is being cleaned.`);
      }
      onChanged();
    } catch (e) {
      toast.error(errorText(e, kind === 'start' ? 'Could not start surgery' : 'Could not complete surgery'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-cream-200 px-4 py-3">
      <div className="flex-1 min-w-[200px]">
        <p className="text-sm font-semibold text-ink-900">
          {o.status === 'scheduled' ? `Booked: OT-${o.roomId} at ${clock(o.start)} with ${o.surgeon}` : `In theatre: OT-${o.roomId} with ${o.surgeon}`}
        </p>
        <p className="text-xs text-ink-500 mt-0.5">
          {o.status !== 'scheduled'
            ? 'Completing moves the patient to a recovery bed and notifies the team.'
            : booked && !booked.free
              ? `OT-${o.roomId} is in use (${booked.reason}). ${startRoom ? `OT-${startRoom} is free now.` : 'No theatre is free right now.'}`
              : 'Start when the patient is in theatre. Their ward bed goes to housekeeping.'}
        </p>
      </div>
      {o.status === 'scheduled' ? (
        <button type="button" className="flow-btn-primary !py-2 !text-sm" disabled={busy || !startRoom} onClick={() => run('start')}>
          <Stethoscope className="w-4 h-4" aria-hidden="true" /> {startRoom && startRoom !== o.roomId ? `Start surgery in OT-${startRoom}` : 'Start surgery'}
        </button>
      ) : (
        <button type="button" className="flow-btn-success !py-2 !text-sm" disabled={busy} onClick={() => run('complete')}>
          <Check className="w-4 h-4" aria-hidden="true" /> Mark complete
        </button>
      )}
    </div>
  );
}

function RequestCard({ o }) {
  const facts = [
    ['Patient', `${o.alias}${o.age ? `, ${o.age} y` : ''}`],
    ['Location', o.location || o.bedId || 'Waiting'],
    ['Ward', o.ward || '—'],
    ['Requested by', o.requestedBy?.name],
    ['Requested', `${clock(o.createdAt)} (${timeAgo(o.createdAt)})`],
    ['Preferred time', o.preferredStart ? dateTime(o.preferredStart) : 'As soon as possible'],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <UrgencyTag urgency={o.urgency} />
            <StatusPill status={STATUS_TONE[o.status]} label={o.status.replace('_', ' ')} size="xs" />
          </div>
          <h2 className="text-xl font-bold text-ink-900 mt-2">{o.procedure}</h2>
          {o.diagnosis && <p className="text-sm text-ink-500 mt-0.5">{o.diagnosis}</p>}
        </div>
        <div className="flex items-center gap-2">
          {o.acuity && <AcuityBadge level={o.acuity} />}
          {o.icuRisk && <IcuRiskBadge risk={o.icuRisk} showLabel />}
        </div>
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 rounded-xl bg-sunken px-4 py-3">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs text-ink-500">{k}</dt>
            <dd className="text-sm font-semibold text-ink-900 truncate">{v}</dd>
          </div>
        ))}
      </dl>
      {o.notes && <p className="text-sm text-ink-900 rounded-lg border border-cream-200 px-3 py-2">{o.notes}</p>}
    </div>
  );
}

export default function OtRequestsPage() {
  const [selected, setSelected] = useState(null);
  const q = useFlowPolling(() => careApi.listOtRequests(), { intervalMs: 60000 });
  const all = useMemo(() => q.data || [], [q.data]);
  const pending = all.filter((o) => o.status === 'pending');
  const booked = all.filter((o) => ['scheduled', 'in_progress'].includes(o.status));
  const closed = all.filter((o) => ['completed', 'declined'].includes(o.status));
  const current = all.find((o) => o.id === selected) || pending[0] || booked[0] || null;

  const Item = ({ o }) => (
    <li>
      <button
        type="button"
        onClick={() => setSelected(o.id)}
        aria-current={current?.id === o.id}
        className={clsx('w-full text-left px-4 py-3 border-b border-cream-200 transition-colors', current?.id === o.id ? 'bg-royal-500/5' : 'hover:bg-sunken')}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink-900 truncate">{o.procedure}</span>
          <UrgencyTag urgency={o.urgency} />
        </span>
        <span className="flex items-center justify-between gap-2 mt-1.5 text-xs text-ink-500">
          <span>
            <b className="text-ink-900">{o.alias}</b> {o.bedId || o.location || ''}
          </span>
          <span>{o.status === 'pending' ? `waiting ${timeAgo(o.createdAt).replace(' ago', '')}` : o.start ? `${clock(o.start)} OT-${o.roomId}` : o.status}</span>
        </span>
      </button>
    </li>
  );

  return (
    <div>
      <FlowPageHeader title="OT Requests" subtitle="Book surgeries: choose a time and see which surgeons and theatres are free" showHealth={false} />
      {q.error && !q.data && <FlowError message={q.error} onRetry={q.refresh} />}
      {!q.data && !q.error && <FlowSkeleton lines={8} />}
      {q.data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatTile icon={ClipboardList} value={pending.length} label="Waiting to be booked" tone={pending.length ? 'warn' : 'ok'} />
            <StatTile icon={Siren} value={pending.filter((o) => o.urgency === 'emergency').length} label="Emergencies waiting" tone={pending.some((o) => o.urgency === 'emergency') ? 'bad' : 'ok'} />
            <StatTile icon={CalendarClock} value={booked.length} label="Booked or in theatre" tone="violet" />
            <StatTile icon={Stethoscope} value={closed.filter((o) => o.status === 'completed').length} label="Completed" tone="ok" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-4 items-start">
            <section className="flow-card overflow-hidden" aria-label="Request queue">
              <h3 className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-500 bg-sunken border-b border-cream-200 flex items-center gap-2">
                <Clock3 className="w-3.5 h-3.5" aria-hidden="true" /> Waiting ({pending.length})
              </h3>
              {!pending.length && <MiniEmpty text="Nothing waiting. New requests appear here instantly." icon={ClipboardList} />}
              <ul>{pending.map((o) => <Item key={o.id} o={o} />)}</ul>
              {booked.length > 0 && (
                <>
                  <h3 className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-500 bg-sunken border-y border-cream-200 flex items-center gap-2">
                    <CalendarCheck className="w-3.5 h-3.5" aria-hidden="true" /> Booked ({booked.length})
                  </h3>
                  <ul>{booked.map((o) => <Item key={o.id} o={o} />)}</ul>
                </>
              )}
            </section>
            <section className="flow-card p-5">
              {!current ? (
                <MiniEmpty text="No requests yet" icon={ClipboardList} />
              ) : (
                <div className="space-y-6">
                  <RequestCard o={current} />
                  {current.status === 'pending' ? (
                    <Scheduler o={current} onBooked={() => q.refresh({ silent: true })} />
                  ) : (
                    <div className="space-y-5">
                      {['scheduled', 'in_progress'].includes(current.status) && <CaseActions o={current} onChanged={() => q.refresh({ silent: true })} />}
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3">History</h3>
                        <RequestHistory history={current.history} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
