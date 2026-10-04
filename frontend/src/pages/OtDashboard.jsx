/**
 * @file OtDashboard.jsx
 * /ot/dashboard: OT Command Center. Compact header with one-line status, 4 stat tiles, a 2x2 grid of room
 * cards (ready / in surgery / cleaning, each with its own actions), doctor availability (who is free and
 * what busy doctors are doing) and a compact Gantt of today's cases. Refreshes every 60 seconds.
 */

import FlowPageHeader from '../components/domain/FlowPageHeader.jsx';
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { DoorOpen, Activity, Sparkles, ClipboardList, Play, CheckCircle2, Timer, Wrench, ChevronDown } from 'lucide-react';
import StatusPill from '../components/domain/StatusPill.jsx';
import DoctorAvailability from '../components/domain/DoctorAvailability.jsx';
import LiveDot from '../components/ui/LiveDot.jsx';
import { FlowModal, FlowError, FlowSkeleton } from '../components/domain/FlowUi.jsx';
import { StatTile, ProgressLine, PanelTitle } from '../components/domain/CareUi.jsx';
import careApi from '../api/careApi.js';
import { useFlowPolling, errorText } from '../hooks/useFlowPolling.js';
import { clock } from '../utils/flowFormat.js';
import { RequestPath } from '../components/domain/RequestThread.jsx';

const STATE_PILL = { available: ['available', 'Ready'], in_surgery: ['in_surgery', 'Surgery'], cleaning: ['cleaning', 'Cleaning'], maintenance: ['maintenance', 'Maintenance'] };
const CASE_COLORS = { in_progress: '#8B5CF6', scheduled: '#014BAA', completed: '#10B981' };

function RoomCard({ room, onAction, busy }) {
  const [pill, label] = STATE_PILL[room.state] || STATE_PILL.available;
  const c = room.case;
  return (
    <section className={clsx('flow-card p-4 flex flex-col min-h-[200px]', room.state === 'in_surgery' && 'border-[#8B5CF6]/40')}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-ink-900">{room.name}</h3>
        <StatusPill status={pill} label={label} />
      </div>

      {room.state === 'in_surgery' && c && (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-ink-500">Patient</dt>
            <dd className="font-semibold text-ink-900">{c.alias}</dd>
            <dt className="text-ink-500">Procedure</dt>
            <dd className="text-ink-900 truncate">{c.procedure}</dd>
            <dt className="text-ink-500">Surgeon</dt>
            <dd className="text-ink-900">{c.surgeon}</dd>
            <dt className="text-ink-500">Started</dt>
            <dd className="text-ink-900 tabular-nums">{clock(c.startedAt)}</dd>
            <dt className="text-ink-500">Expected end</dt>
            <dd className={clsx('tabular-nums', c.overrun ? 'text-fg-bad font-semibold' : 'text-ink-900')}>
              {clock(c.expectedEnd)}
              {c.overrun ? ' · overrun' : ''}
            </dd>
          </dl>
          <div className="mt-3 flex items-center gap-2">
            <ProgressLine value={c.progress} color="#8B5CF6" label="Surgery progress" />
            <span className="text-xs font-semibold tabular-nums text-ink-500 w-9 text-right">{c.progress}%</span>
          </div>
          <div className="mt-auto pt-3 flex gap-2">
            <button type="button" className="flow-btn-success flex-1" disabled={busy} onClick={() => onAction('complete', room)}>
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Mark Complete
            </button>
            <button type="button" className="flow-btn-secondary" disabled={busy} onClick={() => onAction('delay', room)}>
              <Timer className="w-3.5 h-3.5" aria-hidden="true" /> Delay 30m
            </button>
          </div>
        </>
      )}

      {room.state === 'available' && (
        <>
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-0.5 py-2">
            {room.nextCase ? (
              <>
                <p className="text-xs text-ink-500">Next case</p>
                <p className="text-lg font-bold tabular-nums text-ink-900">{clock(room.nextCase.start)}</p>
                <p className="text-xs text-ink-900">
                  {room.nextCase.alias} with {room.nextCase.surgeon}
                </p>
                <p className="text-xs text-ink-500 truncate max-w-full">{room.nextCase.procedure}</p>
              </>
            ) : (
              <p className="text-xs text-ink-500">No case booked</p>
            )}
          </div>
          <button type="button" className="flow-btn-primary w-full" disabled={busy} onClick={() => onAction('assign', room)}>
            <Play className="w-3.5 h-3.5" aria-hidden="true" /> {room.nextCase ? 'Start Next Case' : 'Assign Case'}
          </button>
        </>
      )}

      {room.state === 'cleaning' && (
        <>
          <dl className="flex-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs content-center">
            <dt className="text-ink-500">Cleaning since</dt>
            <dd className="tabular-nums text-ink-900">{clock(room.cleaningSince)}</dd>
            <dt className="text-ink-500">Expected ready</dt>
            <dd className="tabular-nums text-ink-900">{clock(room.readyAt)}</dd>
          </dl>
          <button type="button" className="flow-btn-primary w-full mt-3" disabled={busy} onClick={() => onAction('ready', room)}>
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Mark Ready
          </button>
        </>
      )}

      {room.state === 'maintenance' && (
        <div className="flex-1 flex items-center justify-center gap-2 text-xs text-ink-500">
          <Wrench className="w-4 h-4" aria-hidden="true" /> Out of service
        </div>
      )}
    </section>
  );
}

const CASE_LABEL = { in_progress: 'In surgery', scheduled: 'Scheduled', completed: 'Completed' };

function MiniGantt({ rooms, cases, expanded }) {
  const { start, end } = useMemo(() => {
    const times = cases.flatMap((c) => [new Date(c.start).getTime(), new Date(c.end).getTime()]);
    const s = new Date(Math.min(Date.now(), ...times));
    s.setMinutes(0, 0, 0);
    const e = new Date(Math.max(Date.now() + 3600000, ...times));
    e.setMinutes(60, 0, 0);
    return { start: s.getTime(), end: e.getTime() };
  }, [cases]);
  const span = end - start;
  const hours = Array.from({ length: Math.round(span / 3600000) + 1 }, (_, i) => start + i * 3600000);
  const pct = (t) => ((t - start) / span) * 100;
  const nowPct = pct(Date.now());
  const rowH = expanded ? 44 : 30;
  const grid = (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {hours.map((h, i) => (
        <span key={h} className="absolute top-0 bottom-0 w-px bg-cream-200" style={{ left: `${(i / (hours.length - 1)) * 100}%` }} />
      ))}
    </div>
  );
  return (
    <div className="space-y-2">
      <div className="grid gap-x-3" style={{ gridTemplateColumns: '56px minmax(0, 1fr)' }}>
        <span />
        <div className="relative h-5 text-xs text-ink-500 tabular-nums">
          {hours.map((h, i) => {
            const first = i === 0;
            const last = i === hours.length - 1;
            return (
              <span key={h} className="absolute top-0" style={{ left: `${(i / (hours.length - 1)) * 100}%`, transform: first ? 'none' : last ? 'translateX(-100%)' : 'translateX(-50%)' }}>
                {clock(h)}
              </span>
            );
          })}
        </div>
        {rooms.map((r) => (
          <React.Fragment key={r.roomId}>
            <span className="text-sm font-semibold text-ink-900 self-center">{r.name}</span>
            <div className="relative rounded-md bg-sunken my-1" style={{ height: rowH }}>
              {grid}
              {cases
                .filter((c) => c.roomId === r.roomId)
                .map((c) => {
                  const left = Math.max(0, pct(new Date(c.start).getTime()));
                  const width = Math.max(1.5, pct(new Date(c.end).getTime()) - left);
                  return (
                    <span
                      key={c.id}
                      className="absolute top-1 bottom-1 rounded-md overflow-hidden px-1.5 text-xs font-semibold leading-tight text-white flex items-center whitespace-nowrap"
                      style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%`, backgroundColor: CASE_COLORS[c.status] || '#94A3B8' }}
                      title={`${c.caseNumber}: ${c.procedure}, ${c.surgeon}, ${clock(c.start)} to ${clock(c.end)} (${CASE_LABEL[c.status] || c.status})`}
                    >
                      <span className="truncate">{expanded ? `${c.alias}: ${c.procedure}` : c.alias}</span>
                    </span>
                  );
                })}
              {nowPct >= 0 && nowPct <= 100 && <span className="absolute -top-1 -bottom-1 w-0.5 bg-[#DC2626] z-10" style={{ left: `${nowPct}%` }} aria-hidden="true" />}
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 pl-[68px] text-xs text-ink-500">
        {Object.entries(CASE_LABEL).map(([k, l]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: CASE_COLORS[k] }} aria-hidden="true" /> {l}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="w-0.5 h-3 bg-[#DC2626]" aria-hidden="true" /> Now
        </span>
      </div>
    </div>
  );
}

/** Theatre requests waiting for a booking: who asked, the path it took, and who hears back. */
function WaitingRequests() {
  const q = useFlowPolling(() => careApi.listOtRequests(), { intervalMs: 60000, toastOnError: false });
  const waiting = (q.data || []).filter((o) => o.status === 'pending');
  return (
    <section className="flow-card p-4" aria-label="Requests waiting">
      <PanelTitle
        action={
          <Link to="/ot/requests" className="text-sm font-semibold text-royal-500 hover:underline">
            Open OT Requests
          </Link>
        }
      >
        Requests waiting ({waiting.length})
      </PanelTitle>
      {!waiting.length && <p className="text-sm text-ink-500 py-4 text-center">No requests waiting. Every request is booked.</p>}
      <ul className="divide-y divide-cream-200">
        {waiting.map((o) => (
          <li key={o.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm font-bold text-ink-900">
                {o.procedure} <span className="font-normal text-ink-500">for {o.alias}{o.bedId ? ` in ${o.bedId}` : ''}</span>
              </p>
              <RequestPath o={o} compact />
            </div>
            <span className={clsx('rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide', o.urgency === 'emergency' ? 'bg-[#DC2626]/10 text-fg-bad' : o.urgency === 'urgent' ? 'bg-[#F59E0B]/15 text-fg-warn' : 'bg-sunken text-ink-500')}>{o.urgency}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AssignSurgeonModal({ doctor, cases, onClose, onDone }) {
  const options = cases.filter((c) => c.status === 'scheduled');
  const [caseId, setCaseId] = useState(options[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await careApi.assignSurgeon(caseId, doctor.id);
      toast.success(`${doctor.name} assigned`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorText(e, 'Could not assign'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <FlowModal
      open
      onClose={onClose}
      size="sm"
      title={`Assign ${doctor.name}`}
      subtitle={doctor.specialty}
      footer={
        <>
          <button type="button" className="flow-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="flow-btn-primary" onClick={submit} disabled={busy || !caseId}>
            Assign
          </button>
        </>
      }
    >
      {!options.length ? (
        <p className="text-xs text-ink-500">No scheduled cases to assign.</p>
      ) : (
        <label className="block">
          <span className="label-xs block mb-1">Scheduled case</span>
          <select className="flow-input" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {clock(c.start)} · {c.room} · {c.procedure} ({c.surgeon})
              </option>
            ))}
          </select>
        </label>
      )}
    </FlowModal>
  );
}

export default function OtDashboard() {
  const [busy, setBusy] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const q = useFlowPolling(() => careApi.getOtBoard(), { intervalMs: 60000, refreshOn: ['ot.caseCompleted', 'ot.roomUpdated', 'doctor.statusChanged'] });
  const d = q.data;
  const refresh = () => q.refresh({ silent: true });

  const act = async (kind, room) => {
    setBusy(room.roomId);
    try {
      if (kind === 'complete') {
        await careApi.completeCase(room.case.id, room.roomId);
        toast.success(`${room.case.caseNumber} completed · ${room.name} to cleaning`);
      } else if (kind === 'delay') {
        await careApi.delayCase(room.case.id, 30);
        toast.success(`${room.case.caseNumber} delayed 30 min`);
      } else if (kind === 'ready') {
        await careApi.markRoomReady(room.roomId);
        toast.success(`${room.name} ready`);
      } else if (kind === 'assign') {
        await careApi.assignCase(room.roomId, room.nextCase?.id);
        toast.success(`Case started in ${room.name}`);
      }
      refresh();
    } catch (e) {
      toast.error(errorText(e, 'Action failed'));
    } finally {
      setBusy(null);
    }
  };

  if (q.error && !d) return <FlowError message={q.error} onRetry={q.refresh} />;
  if (!d) return <FlowSkeleton lines={12} />;

  const count = (s) => d.rooms.filter((r) => r.state === s).length;
  const today = d.cases.length;

  return (
    <div className="space-y-4">
      <FlowPageHeader
        title="OT Command Center"
        subtitle={`${new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · ${count('in_surgery')} in surgery · ${count('available')} available · ${count('cleaning')} cleaning · ${today} cases today`}
        showHealth={false}
        actions={<LiveDot />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={DoorOpen} value={count('available')} label="Rooms available" tone="ok" />
        <StatTile icon={Activity} value={count('in_surgery')} label="In surgery" tone="violet" />
        <StatTile icon={Sparkles} value={count('cleaning')} label="Cleaning" tone="warn" />
        <StatTile icon={ClipboardList} value={today} label="Cases today" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {d.rooms.map((r) => (
          <RoomCard key={r.roomId} room={r} busy={busy === r.roomId} onAction={act} />
        ))}
      </div>

      <WaitingRequests />

      <section className="flow-card p-4">
        <PanelTitle>Doctors Available for OT</PanelTitle>
        <DoctorAvailability doctors={d.doctors} onAssign={setAssigning} />
      </section>

      <section className="flow-card p-4">
        <PanelTitle
          action={
            <button type="button" className="text-xs font-semibold text-royal-500 hover:underline inline-flex items-center gap-1" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Compact view' : 'View Full Timeline'} <ChevronDown className={clsx('w-3 h-3 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
            </button>
          }
        >
          Today
        </PanelTitle>
        <MiniGantt rooms={d.rooms} cases={d.cases} expanded={expanded} />
      </section>

      {assigning && <AssignSurgeonModal doctor={assigning} cases={d.cases} onClose={() => setAssigning(null)} onDone={refresh} />}
    </div>
  );
}
