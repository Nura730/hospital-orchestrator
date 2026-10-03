/**
 * @file NurseDashboard.jsx
 * Nurse workspace: header with duty status, 4 stat tiles and tabs My Shift, My Patients, Tasks, Bed Board.
 * Each tab also has its own route (/nurse/dashboard, /nurse/patients, /nurse/tasks, /nurse/beds) and
 * /nurse/notifications shows the notification list. Clicking a patient or occupied bed opens PatientDetailPopup.
 */

import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  Users,
  ListChecks,
  Sparkles,
  Timer,
  CalendarClock,
  BedDouble,
  NotebookPen,
  BellRing,
  Check,
  Plus,
  Play,
  AlertTriangle,
  Pill,
} from 'lucide-react';
import StatusPill from '../../components/domain/StatusPill.jsx';
import PatientDetailPopup from '../../components/domain/PatientDetailPopup.jsx';
import BedInfoPanel from '../../components/domain/BedInfoPanel.jsx';
import NotificationsList from '../../components/domain/NotificationsList.jsx';
import { FlowModal, FlowError, FlowSkeleton } from '../../components/domain/FlowUi.jsx';
import { StatTile, TabBar, AcuityDot, AcuityBadge, MiniEmpty, PanelTitle, EventIcon } from '../../components/domain/CareUi.jsx';
import careApi, { TASK_TYPES } from '../../api/careApi.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { clock, timeAgo, timeUntil } from '../../utils/flowFormat.js';

const ROUTE_TAB = { '/nurse/dashboard': 'shift', '/nurse/patients': 'patients', '/nurse/tasks': 'tasks', '/nurse/beds': 'beds', '/nurse/notifications': 'notifications' };
const TAB_ROUTE = Object.fromEntries(Object.entries(ROUTE_TAB).map(([k, v]) => [v, k]));
const DUTY = [
  ['on_duty', 'On Duty', '#047857'],
  ['on_break', 'On Break', '#B45309'],
  ['off_duty', 'Off Duty', '#475569'],
];
const BED_COLORS = { available: '#10B981', occupied: '#014BAA', cleaning: '#F59E0B', reserved: '#8B5CF6', blocked: '#6B7280' };
/* Readable (AA) text shade for each status */
const BED_TEXT = { available: '#046C4E', occupied: '#014BAA', cleaning: '#92400E', reserved: '#6D28D9', blocked: '#374151' };

function minutesOf(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/* ── My Shift ───────────────────────────────────────────────────── */

function ShiftTab({ d, onOpen }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  const mins = now.getHours() * 60 + now.getMinutes();
  const attention = d.patients.filter((p) => p.acuity <= 2);
  const pending = d.tasks.filter((t) => t.status !== 'done');
  const meds = pending.filter((t) => t.type === 'medication').length;
  const clean = d.beds.filter((b) => b.status === 'cleaning').length;
  const urgent = pending.filter((t) => t.priority === 'urgent' || new Date(t.dueAt).getTime() < Date.now()).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <section className="flow-card p-4">
        <PanelTitle>Today&apos;s allocation</PanelTitle>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            ['Ward', d.allocation.ward],
            ['Beds', d.allocation.bedRange],
            ['Time', d.allocation.time],
          ].map(([l, v]) => (
            <div key={l} className="rounded-lg bg-sunken px-3 py-2 min-w-0">
              <p className="text-[10px] text-ink-500">{l}</p>
              <p className="text-xs font-semibold text-ink-900 leading-snug">{v}</p>
            </div>
          ))}
        </div>
        <PanelTitle>Shift timeline</PanelTitle>
        <ol className="space-y-1">
          {d.shiftPlan.map((s) => {
            const current = mins >= minutesOf(s.start) && mins < minutesOf(s.end);
            const past = mins >= minutesOf(s.end);
            return (
              <li key={s.start} className={clsx('flex items-center gap-3 rounded-lg px-3 py-2 border-l-2', current ? 'border-royal-500 bg-royal-500/10' : 'border-transparent', past && 'opacity-55')}>
                <span className="text-[11px] font-semibold tabular-nums text-ink-500 w-24 shrink-0">
                  {s.start} - {s.end}
                </span>
                <span className={clsx('text-xs', current ? 'font-semibold text-ink-900' : 'text-ink-900')}>{s.label}</span>
                {current && <span className="ml-auto text-[10px] font-semibold text-royal-500">Now</span>}
                {past && <Check className="ml-auto w-3.5 h-3.5 text-ink-500" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon={AlertTriangle} value={attention.length} label="Need attention (acuity 1-2)" tone={attention.length ? 'bad' : 'ok'} />
          <StatTile icon={Pill} value={meds} label="Pending medication rounds" tone="violet" />
          <StatTile icon={Sparkles} value={clean} label="Beds needing cleaning" tone={clean ? 'warn' : 'ok'} />
          <StatTile icon={BellRing} value={urgent} label="Urgent tasks" tone={urgent ? 'bad' : 'ok'} />
        </div>
        <div className="flow-card p-4">
          <PanelTitle count={attention.length}>Patients requiring attention</PanelTitle>
          {!attention.length && <MiniEmpty text="No critical patients" />}
          <ul className="space-y-1">
            {attention.map((p) => (
              <li key={p.patientId}>
                <button type="button" onClick={() => onOpen(p.patientId)} className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-sunken">
                  <AcuityDot level={p.acuity} />
                  <span className="text-xs font-semibold text-ink-900 w-14">{p.bedId}</span>
                  <span className="text-xs text-ink-900">{p.alias}</span>
                  <span className="ml-auto text-[11px] text-ink-500 truncate">{p.nextTask ? `${p.nextTask.title} ${clock(p.nextTask.dueAt)}` : 'No pending task'}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

/* ── My Patients ────────────────────────────────────────────────── */

function NoteModal({ patient, mode, onClose, onDone }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const isAlert = mode === 'alert';
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isAlert) await careApi.alertDoctor(patient.patientId, text.trim(), 'Nurse Priya Sharma');
      else await careApi.addNote(patient.patientId, text.trim(), 'Nurse Priya Sharma');
      toast.success(isAlert ? 'Doctor alerted' : 'Note added');
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorText(err, 'Could not save'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <FlowModal open onClose={onClose} size="sm" title={`${isAlert ? 'Alert doctor' : 'Add note'} · ${patient.alias}`}>
      <form onSubmit={submit} className="space-y-3">
        <textarea className="flow-input min-h-[90px]" required={!isAlert} maxLength={200} value={text} onChange={(e) => setText(e.target.value)} placeholder={isAlert ? 'What should the doctor know?' : 'Nursing note'} />
        <div className="flex justify-end gap-2">
          <button type="button" className="flow-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={isAlert ? 'flow-btn-danger' : 'flow-btn-primary'} disabled={busy}>
            {isAlert ? <BellRing className="w-3.5 h-3.5" aria-hidden="true" /> : <NotebookPen className="w-3.5 h-3.5" aria-hidden="true" />} {isAlert ? 'Send alert' : 'Save note'}
          </button>
        </div>
      </form>
    </FlowModal>
  );
}

function PatientsTab({ d, onOpen, onRefresh }) {
  const [modal, setModal] = useState(null);
  const markDone = async (p) => {
    if (!p.nextTask) return;
    try {
      await careApi.updateTask(p.nextTask.id, 'done');
      toast.success(`${p.nextTask.title} done for ${p.alias}`);
      onRefresh();
    } catch (e) {
      toast.error(errorText(e, 'Could not update task'));
    }
  };
  if (!d.patients.length) return <MiniEmpty text="No patients assigned" />;
  return (
    <>
      <div className="table-wrap">
        <table className="mo-table">
          <thead>
            <tr>
              <th scope="col">Bed</th>
              <th scope="col">Patient</th>
              <th scope="col">Acuity</th>
              <th scope="col">Status</th>
              <th scope="col">Last vitals</th>
              <th scope="col">Next task</th>
              <th scope="col">Alert</th>
              <th scope="col" className="text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {d.patients.map((p) => (
              <tr key={p.patientId} onClick={() => onOpen(p.patientId)} className={clsx('cursor-pointer', p.acuity <= 2 && '!bg-[#EF4444]/10 hover:!bg-[#EF4444]/15')}>
                <td className="font-mono font-semibold">{p.bedId}</td>
                <td className="font-semibold">{p.alias}</td>
                <td>
                  <AcuityBadge level={p.acuity} size="xs" />
                </td>
                <td>
                  <StatusPill status={p.acuity <= 2 && p.status === 'admitted' ? 'critical' : p.status} size="xs" />
                </td>
                <td className="text-ink-500">{timeAgo(p.lastVitalsAt)}</td>
                <td>{p.nextTask ? `${p.nextTask.title} · ${clock(p.nextTask.dueAt)}` : '—'}</td>
                <td>{p.alert ? <span className="text-fg-bad font-semibold">{p.alert}</span> : <span className="text-ink-500">—</span>}</td>
                <td className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex gap-1">
                    <button type="button" className="flow-btn-ghost !px-2 !py-1" onClick={() => setModal({ p, mode: 'note' })} title="Add note">
                      <NotebookPen className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" className="flow-btn-ghost !px-2 !py-1 hover:!text-fg-bad" onClick={() => setModal({ p, mode: 'alert' })} title="Alert doctor">
                      <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" className="flow-btn-ghost !px-2 !py-1 hover:!text-fg-ok" onClick={() => markDone(p)} disabled={!p.nextTask} title="Mark next task done">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <NoteModal patient={modal.p} mode={modal.mode} onClose={() => setModal(null)} onDone={onRefresh} />}
    </>
  );
}

/* ── Tasks ──────────────────────────────────────────────────────── */

function AddTaskModal({ d, onClose, onDone }) {
  const soon = new Date(Date.now() + 30 * 60000);
  const [form, setForm] = useState({ type: 'vitals', patientId: d.patients[0]?.patientId || '', time: `${String(soon.getHours()).padStart(2, '0')}:${String(soon.getMinutes()).padStart(2, '0')}`, notes: '', urgent: false });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const [h, m] = form.time.split(':').map(Number);
    const due = new Date();
    due.setHours(h, m, 0, 0);
    const bed = form.type === 'clean_bed' ? d.beds.find((b) => b.status === 'cleaning')?.bedId : undefined;
    setBusy(true);
    try {
      await careApi.addTask({ type: form.type, patientId: form.type === 'clean_bed' ? null : form.patientId, bedId: bed, dueAt: due.toISOString(), notes: form.notes.trim(), priority: form.urgent ? 'urgent' : 'normal' });
      toast.success('Task added');
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorText(err, 'Could not add task'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <FlowModal open onClose={onClose} size="sm" title="Add task">
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="label-xs block mb-1">Type</span>
          <select className="flow-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {Object.entries(TASK_TYPES).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {form.type !== 'clean_bed' && (
          <label className="block">
            <span className="label-xs block mb-1">Patient</span>
            <select className="flow-input" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
              {d.patients.map((p) => (
                <option key={p.patientId} value={p.patientId}>
                  {p.bedId} · {p.alias}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-2 items-end">
          <label className="block">
            <span className="label-xs block mb-1">Time</span>
            <input type="time" className="flow-input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-ink-900 pb-2">
            <input type="checkbox" checked={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.checked })} className="accent-[#EF4444]" /> Urgent
          </label>
        </div>
        <label className="block">
          <span className="label-xs block mb-1">Notes</span>
          <input className="flow-input" maxLength={120} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="flow-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="flow-btn-primary" disabled={busy}>
            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add task
          </button>
        </div>
      </form>
    </FlowModal>
  );
}

function TaskCard({ t, onStatus }) {
  const overdue = t.status !== 'done' && new Date(t.dueAt).getTime() < Date.now();
  const where = [t.alias, t.bedId].filter(Boolean).join(' · ');
  return (
    <li className={clsx('flow-card p-3', t.status === 'done' && '!bg-sunken')}>
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-lg bg-sunken flex items-center justify-center shrink-0">
          <EventIcon type={t.type} className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink-900 truncate">{t.title}</p>
          {where && <p className="text-[11px] text-ink-500 truncate">{where}</p>}
          {t.notes && <p className="text-[11px] text-ink-500 truncate">{t.notes}</p>}
        </div>
        <StatusPill status={t.status === 'pending' ? (t.priority === 'urgent' ? 'urgent' : 'pending') : t.status} size="xs" className="shrink-0" />
      </div>
      <div className="flex items-center justify-between gap-2 mt-2.5 pl-11">
        <span className={clsx('text-[11px] tabular-nums', overdue ? 'text-fg-bad font-semibold' : 'text-ink-500')}>
          {t.status === 'done' ? `Done ${clock(t.completedAt)}` : `Due ${clock(t.dueAt)}${overdue ? ' · overdue' : ` · ${timeUntil(t.dueAt)}`}`}
        </span>
        {t.status !== 'done' && (
          <div className="flex gap-1 shrink-0">
            {t.status === 'pending' && (
              <button type="button" className="flow-btn-ghost !px-2 !py-1" onClick={() => onStatus(t, 'in_progress')} title="Start" aria-label="Start task">
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
            <button type="button" className="flow-btn-success !px-2.5 !py-1" onClick={() => onStatus(t, 'done')}>
              <Check className="w-3.5 h-3.5" aria-hidden="true" /> Mark Done
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function TasksTab({ d, onRefresh }) {
  const [adding, setAdding] = useState(false);
  const soon = Date.now() + 60 * 60000;
  const groups = useMemo(() => {
    const open = d.tasks.filter((t) => t.status !== 'done');
    const urgent = open.filter((t) => t.priority === 'urgent' || new Date(t.dueAt).getTime() < Date.now());
    const dueSoon = open.filter((t) => !urgent.includes(t));
    const done = d.tasks.filter((t) => t.status === 'done').sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    return [
      ['Urgent', urgent, '#EF4444'],
      ['Due Soon', dueSoon.filter((t) => new Date(t.dueAt).getTime() <= soon).concat(dueSoon.filter((t) => new Date(t.dueAt).getTime() > soon)), '#F59E0B'],
      ['Completed', done, '#10B981'],
    ];
  }, [d.tasks, soon]);

  const setStatus = async (t, status) => {
    try {
      await careApi.updateTask(t.id, status);
      if (status === 'done') toast.success(`${t.title} done`);
      onRefresh();
    } catch (e) {
      toast.error(errorText(e, 'Could not update task'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" className="flow-btn-primary" onClick={() => setAdding(true)}>
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add Task
        </button>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {groups.map(([label, list, color]) => (
          <section key={label}>
            <h3 className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="label-xs">{label}</span>
              <span className="rounded-full bg-sunken px-1.5 text-[10px] tabular-nums text-ink-900">{list.length}</span>
            </h3>
            {!list.length && <MiniEmpty text={`No ${label.toLowerCase()} tasks`} />}
            <ul className="space-y-2">
              {(label === 'Completed' ? list.slice(0, 12) : list).map((t) => (
                <TaskCard key={t.id} t={t} onStatus={setStatus} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      {adding && <AddTaskModal d={d} onClose={() => setAdding(false)} onDone={onRefresh} />}
    </div>
  );
}

/* ── Bed board ──────────────────────────────────────────────────── */

function BedsTab({ d, onOpen, onBed }) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <PanelTitle count={d.beds.length}>My beds</PanelTitle>
        <div className="flex gap-3 text-[11px] text-ink-500">
          {[
            ['Available', '#10B981'],
            ['Occupied', '#014BAA'],
            ['Cleaning', '#F59E0B'],
          ].map(([l, c]) => (
            <span key={l} className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c }} /> {l}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
        {d.beds.map((b) => {
          const color = BED_COLORS[b.status] || BED_COLORS.blocked;
          return (
            <button
              key={b.bedId}
              type="button"
              onClick={() => (b.patientId ? onOpen(b.patientId) : onBed(b))}
              className="rounded-xl border p-3 text-left transition-colors hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-500"
              style={{ borderColor: color, backgroundColor: `${color}12` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-ink-900">{b.bedId}</span>
                {b.acuity && <AcuityDot level={b.acuity} />}
              </div>
              <p className="text-sm font-semibold text-ink-900 mt-1.5 truncate">{b.alias || '—'}</p>
              <p className="text-[11px] font-semibold capitalize" style={{ color: BED_TEXT[b.status] || BED_TEXT.blocked }}>
                {b.status}
              </p>
              <p className="text-[10px] text-ink-900/80 truncate mt-0.5">{b.nextTask ? `${b.nextTask.title} ${clock(b.nextTask.dueAt)}` : 'No task due'}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ── Page ───────────────────────────────────────────────────────── */

export default function NurseDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = ROUTE_TAB[location.pathname] || 'shift';
  const [popup, setPopup] = useState(null);
  const [bed, setBed] = useState(null);
  const q = useFlowPolling(() => careApi.getNurseDashboard(), { intervalMs: 30000, refreshOn: ['bed.updated', 'patient.updated', 'notification.new'] });
  const d = q.data;
  const refresh = () => q.refresh({ silent: true });

  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const setDuty = async (status) => {
    await careApi.setNurseStatus(status);
    refresh();
  };

  if (q.error && !d) return <FlowError message={q.error} onRetry={q.refresh} />;
  if (!d) return <FlowSkeleton lines={12} />;

  const pending = d.tasks.filter((t) => t.status !== 'done').length;
  const clean = d.beds.filter((b) => b.status === 'cleaning').length;
  const startsMin = Math.round((new Date(d.nurse.shiftStartsAt).getTime() - Date.now()) / 60000);
  const notStarted = startsMin > 0;
  const mins = notStarted ? startsMin : Math.max(0, Math.round((new Date(d.nurse.shiftEndsAt).getTime() - Date.now()) / 60000));
  const endsIn = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;

  const tabs = [
    { id: 'shift', label: 'My Shift', icon: CalendarClock },
    { id: 'patients', label: 'My Patients', icon: Users, count: d.patients.length },
    { id: 'tasks', label: 'Tasks', icon: ListChecks, count: pending },
    { id: 'beds', label: 'Bed Board', icon: BedDouble },
  ];

  return (
    <div className="space-y-4">
      <FlowPageHeader
        title={d.nurse.name}
        subtitle={`${d.nurse.department} · ${d.allocation.ward} · Shift ${d.nurse.shift}`}
        showHealth={false}
        actions={
          <div className="inline-flex rounded-lg border border-cream-200 bg-cream-50 p-0.5" role="group" aria-label="Set duty status">
            {DUTY.map(([k, l, c]) => (
              <button key={k} type="button" onClick={() => setDuty(k)} aria-pressed={d.nurse.status === k} className={clsx('px-3 py-1.5 rounded-md text-xs font-semibold', d.nurse.status === k ? 'text-white' : 'text-ink-500 hover:text-ink-900')} style={d.nurse.status === k ? { backgroundColor: c } : undefined}>
                {l}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Users} value={d.patients.length} label="My patients today" onClick={() => navigate('/nurse/patients')} />
        <StatTile icon={ListChecks} value={pending} label="Tasks pending" tone={pending ? 'warn' : 'ok'} onClick={() => navigate('/nurse/tasks')} />
        <StatTile icon={Sparkles} value={clean} label="Beds to clean" tone={clean ? 'warn' : 'ok'} onClick={() => navigate('/nurse/beds')} />
        <StatTile icon={Timer} value={endsIn} label={notStarted ? `Shift starts in (${d.nurse.shift.split(' - ')[0]})` : 'Shift ends in'} />
      </div>

      {tab === 'notifications' ? (
        <NotificationsList source="care" />
      ) : (
        <div>
          <TabBar tabs={tabs} active={tab} onChange={(t) => navigate(TAB_ROUTE[t])} className="mb-3" />
          {tab === 'shift' && <ShiftTab d={d} onOpen={setPopup} />}
          {tab === 'patients' && <PatientsTab d={d} onOpen={setPopup} onRefresh={refresh} />}
          {tab === 'tasks' && <TasksTab d={d} onRefresh={refresh} />}
          {tab === 'beds' && <BedsTab d={d} onOpen={setPopup} onBed={setBed} />}
        </div>
      )}

      {popup && <PatientDetailPopup patientId={popup} onClose={() => setPopup(null)} onChanged={refresh} />}
      {bed && <BedInfoPanel bed={{ ...bed, id: bed.bedId }} onClose={() => setBed(null)} onChanged={refresh} allowActions={false} />}
    </div>
  );
}
