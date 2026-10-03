/**
 * @file OtDashboard.jsx
 * /ot/dashboard: OT Command Center. Compact header with one-line status, 4 stat tiles, a 2x2 grid of room
 * cards (ready / in surgery / cleaning, each with its own actions), doctor availability (who is free and
 * what busy doctors are doing) and a compact Gantt of today's cases. Refreshes every 60 seconds.
 */

import FlowPageHeader from '../components/domain/FlowPageHeader.jsx';
import React, { useMemo, useState } from 'react';
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
            <span className="text-[11px] font-semibold tabular-nums text-ink-500 w-9 text-right">{c.progress}%</span>
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
                <p className="text-[11px] text-ink-500">Next case</p>
                <p className="text-lg font-bold tabular-nums text-ink-900">{clock(room.nextCase.start)}</p>
                <p className="text-xs text-ink-900">{room.nextCase.surgeon}</p>
                <p className="text-[11px] text-ink-500 truncate max-w-full">{room.nextCase.procedure}</p>
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
  const nowPct = ((Date.now() - start) / span) * 100;
  const rowH = expanded ? 'h-9' : 'h-6';
  return (
    <div className="relative">
      <div className="ml-12 relative h-4 text-[9px] text-ink-500">
        {hours.map((h, i) => (
          <span key={h} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${(i / (hours.length - 1)) * 100}%` }}>
            {clock(h)}
          </span>
        ))}
      </div>
      <div className="space-y-1.5 mt-1">
        {rooms.map((r) => (
          <div key={r.roomId} className="flex items-center gap-2">
            <span className="w-10 text-[10px] font-semibold text-ink-500">{r.name}</span>
            <div className={clsx('relative flex-1 rounded bg-sunken', rowH)}>
              {cases
                .filter((c) => c.roomId === r.roomId)
                .map((c) => {
                  const left = ((new Date(c.start).getTime() - start) / span) * 100;
                  const width = ((new Date(c.end).getTime() - new Date(c.start).getTime()) / span) * 100;
                  return (
                    <span
                      key={c.id}
                      className="absolute top-0.5 bottom-0.5 rounded overflow-hidden px-1 text-[9px] leading-[1.6] text-white"
                      style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(1, width)}%`, backgroundColor: CASE_COLORS[c.status] || '#94A3B8' }}
                      title={`${c.caseNumber} · ${c.procedure} · ${c.surgeon} · ${clock(c.start)}-${clock(c.end)} · ${c.status.replace('_', ' ')}`}
                    >
                      {expanded ? c.procedure : ''}
                    </span>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      {nowPct >= 0 && nowPct <= 100 && <span className="absolute top-4 bottom-0 w-px bg-[#EF4444]" style={{ left: `calc(3rem + (100% - 3rem) * ${nowPct / 100})` }} aria-hidden="true" />}
    </div>
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

      <section className="flow-card p-4">
        <PanelTitle>Doctors Available for OT</PanelTitle>
        <DoctorAvailability doctors={d.doctors} onAssign={setAssigning} />
      </section>

      <section className="flow-card p-4">
        <PanelTitle
          action={
            <button type="button" className="text-[11px] font-semibold text-royal-500 hover:underline inline-flex items-center gap-1" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Compact view' : 'View Full Timeline'} <ChevronDown className={clsx('w-3 h-3 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
            </button>
          }
        >
          Today
        </PanelTitle>
        <div className={expanded ? '' : 'max-h-[150px] overflow-hidden'}>
          <MiniGantt rooms={d.rooms} cases={d.cases} expanded={expanded} />
        </div>
      </section>

      {assigning && <AssignSurgeonModal doctor={assigning} cases={d.cases} onClose={() => setAssigning(null)} onDone={refresh} />}
    </div>
  );
}
