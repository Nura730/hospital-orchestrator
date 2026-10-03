/**
 * @file DoctorDashboard.jsx
 * /doctor/dashboard (+ /doctor/schedule, /doctor/patients, /doctor/ot-cases, /doctor/calendar,
 * /doctor/notifications, each opening its tab): one-line header with quick status, 4 stat tiles, Today's Board (admitted today,
 * discharges, my beds) and tabs: Today's Schedule, My Patients, OT Cases, Calendar, Notifications.
 * Clicking any patient opens PatientDetailPopup.
 */

import FlowPageHeader from '../components/domain/FlowPageHeader.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  Hospital,
  Scissors,
  LogOut,
  ClipboardList,
  CalendarDays,
  Users,
  Bell,
  Clock3,
  CheckCircle2,
  Eye,
  FileText,
  Activity,
  Plus,
  ChevronDown,
  Route,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import StatusPill from '../components/domain/StatusPill.jsx';
import PatientDetailPopup from '../components/domain/PatientDetailPopup.jsx';
import DoctorCalendar from '../components/domain/DoctorCalendar.jsx';
import NotificationsList from '../components/domain/NotificationsList.jsx';
import { FlowModal, FlowError, FlowSkeleton } from '../components/domain/FlowUi.jsx';
import { StatTile, TabBar, AcuityDot, AcuityBadge, MiniEmpty, PanelTitle, EventIcon, IcuRiskBadge } from '../components/domain/CareUi.jsx';
import careApi from '../api/careApi.js';
import flowApi from '../api/flowApi.js';
import { useAuthStore } from '../store/authStore.js';
import { useFlowPolling, errorText } from '../hooks/useFlowPolling.js';
import { clock, displayName, EVENT_COLORS } from '../utils/flowFormat.js';

const ROUTE_TAB = {
  '/doctor/dashboard': 'schedule',
  '/doctor/schedule': 'schedule',
  '/doctor/patients': 'patients',
  '/doctor/ot-cases': 'ot',
  '/doctor/calendar': 'calendar',
  '/doctor/notifications': 'notifications',
};
const TAB_ROUTE = { schedule: '/doctor/schedule', patients: '/doctor/patients', ot: '/doctor/ot-cases', calendar: '/doctor/calendar', notifications: '/doctor/notifications' };

// [value (backend DOCTOR_STATUS), label, color, what other teams now see]
const STATUS_BUTTONS = [
  ['available', 'Available', '#047857', 'OT and admin can assign you'],
  ['in_surgery', 'In Surgery', '#6D28D9', 'OT and admin now see you as in surgery'],
  ['on_break', 'Break', '#B45309', 'OT and admin see you as on break'],
  ['off_duty', 'Off Duty', '#475569', 'You are hidden from OT assignment'],
];
const STATUS_PILL = { available: 'online', in_surgery: 'in_surgery', on_break: 'on_break', break: 'on_break', off_duty: 'off_duty', in_consultation: 'in_consultation', emergency: 'emergency' };
const BED_STATE = {
  occupied: ['#014BAA', 'Occupied'],
  critical: ['#B91C1C', 'Critical'],
  available: ['#047857', 'Available'],
  cleaning: ['#B45309', 'Cleaning'],
};

/* ── Small modals ───────────────────────────────────────────────── */

function UpdateStatusModal({ patient, onClose, onSaved, by }) {
  const [acuity, setAcuity] = useState(patient.acuity);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await careApi.updatePatientStatus(patient.patientId, { acuity: Number(acuity), note: note.trim() }, by);
      toast.success(`${patient.alias} updated`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errorText(e, 'Could not update'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <FlowModal
      open
      onClose={onClose}
      size="sm"
      title={`Update status · ${patient.alias}`}
      footer={
        <>
          <button type="button" className="flow-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="flow-btn-primary" onClick={save} disabled={busy}>
            Save
          </button>
        </>
      }
    >
      <label className="block mb-3">
        <span className="label-xs block mb-1">Acuity (1 = most critical)</span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((a) => (
            <button key={a} type="button" onClick={() => setAcuity(a)} aria-pressed={acuity === a} className={clsx('flex-1 py-2 rounded-lg border text-xs font-bold', acuity === a ? 'bg-royal-500 border-royal-500 text-white' : 'border-cream-200 text-ink-900 hover:bg-sunken')}>
              {a}
            </button>
          ))}
        </div>
      </label>
      <label className="block">
        <span className="label-xs block mb-1">Note</span>
        <textarea className="flow-input min-h-[70px]" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Progress note (no clinical values)" />
      </label>
    </FlowModal>
  );
}

function RequestOtModal({ patients, initial, onClose, onSaved, by }) {
  const [patientId, setPatientId] = useState(initial || patients[0]?.patientId || '');
  const [procedure, setProcedure] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await careApi.requestOt(patientId, procedure.trim(), by);
      toast.success('OT slot requested');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorText(err, 'Could not request OT'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <FlowModal open onClose={onClose} size="sm" title="Request OT slot">
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="label-xs block mb-1">Patient</span>
          <select className="flow-input" value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
            {patients.map((p) => (
              <option key={p.patientId} value={p.patientId}>
                {p.alias} · {p.bedId}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label-xs block mb-1">Procedure</span>
          <input className="flow-input" required maxLength={80} value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="e.g. Laparoscopic appendectomy" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="flow-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="flow-btn-primary" disabled={busy || !patientId}>
            <Scissors className="w-3.5 h-3.5" aria-hidden="true" /> Request
          </button>
        </div>
      </form>
    </FlowModal>
  );
}

function OtCaseModal({ c, onClose }) {
  const rows = [
    ['Case', c.caseNumber],
    ['Patient', c.alias],
    ['Procedure', c.procedure],
    ['Room', c.room],
    ['Surgeon', c.surgeon],
    ['Urgency', c.urgency],
    ['Time', `${clock(c.start)} - ${clock(c.end)}`],
    ['Post-op ward', c.postOpWard],
  ];
  return (
    <FlowModal open onClose={onClose} size="sm" title={`OT case ${c.caseNumber}`} subtitle={c.procedure}>
      <div className="mb-2">
        <StatusPill status={c.status} />
      </div>
      {rows.map(([l, v]) => (
        <div key={l} className="flex justify-between gap-3 py-1.5 border-b border-cream-200 last:border-0 text-xs">
          <span className="text-ink-500">{l}</span>
          <span className="font-medium text-ink-900 text-right capitalize">{v || '—'}</span>
        </div>
      ))}
    </FlowModal>
  );
}

/* ── Today's board ──────────────────────────────────────────────── */

function TodayBoard({ data, onOpen, onDischarge, busyId }) {
  const [allBeds, setAllBeds] = useState(false);
  const beds = allBeds ? data.bedStatus : data.bedStatus.slice(0, 6);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <section className="flow-card p-3.5">
        <PanelTitle count={data.admittedToday.length}>Admitted today</PanelTitle>
        {!data.admittedToday.length && <MiniEmpty text="No admissions today" />}
        <ul className="space-y-1">
          {data.admittedToday.map((p) => (
            <li key={p.patientId} className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-sunken">
              <AcuityDot level={p.acuity} />
              <button type="button" onClick={() => onOpen(p.patientId)} className="min-w-0 flex-1 text-left">
                <span className="block text-xs font-semibold text-ink-900">
                  {p.alias} <span className="font-normal text-ink-500">· {p.bedId}</span>
                </span>
                <span className="block text-[11px] text-ink-500 truncate">{p.diagnosis}</span>
              </button>
              <button type="button" className="flow-btn-secondary !py-1 !px-2" onClick={() => onOpen(p.patientId)}>
                <Eye className="w-3.5 h-3.5" aria-hidden="true" /> View
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flow-card p-3.5">
        <PanelTitle count={data.discharges.length}>Discharges</PanelTitle>
        {!data.discharges.length && <MiniEmpty text="No discharges today" />}
        <ul className="space-y-1">
          {data.discharges.map((d) => (
            <li key={d.patientId} className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-sunken">
              {d.done ? <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" aria-hidden="true" /> : <Clock3 className="w-4 h-4 text-[#F59E0B] shrink-0" aria-hidden="true" />}
              <button type="button" onClick={() => onOpen(d.patientId)} className="min-w-0 flex-1 text-left">
                <span className="block text-xs font-semibold text-ink-900">{d.alias}</span>
                <span className="block text-[11px] text-ink-500">{d.done ? `Discharged ${clock(d.at)}` : `Due today · readiness ${d.readiness}`}</span>
              </button>
              {!d.done && (
                <button type="button" className="flow-btn-primary !py-1 !px-2" disabled={busyId === d.patientId} onClick={() => onDischarge(d)}>
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" /> {busyId === d.patientId ? '…' : 'Discharge'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flow-card p-3.5">
        <PanelTitle count={data.bedStatus.length}>My beds</PanelTitle>
        <ul className="space-y-1">
          {beds.map((b) => {
            const [color, label] = BED_STATE[b.state] || BED_STATE.occupied;
            return (
              <li key={b.bedId}>
                <button type="button" disabled={!b.patientId} onClick={() => b.patientId && onOpen(b.patientId)} className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-sunken disabled:hover:bg-transparent">
                  <span className="w-9 h-7 rounded-md border text-[9px] font-mono font-semibold flex items-center justify-center" style={{ borderColor: color, backgroundColor: `${color}26`, color }}>
                    {b.bedId.split('-')[1]}
                  </span>
                  <span className="text-xs font-semibold text-ink-900 w-14">{b.bedId}</span>
                  <span className="text-[11px] flex-1 truncate" style={{ color }}>
                    {label}
                    {b.alias ? <span className="text-ink-500"> · {b.alias}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {data.bedStatus.length > 6 && (
          <button type="button" className="flow-btn-ghost w-full mt-1 !py-1.5" onClick={() => setAllBeds((v) => !v)}>
            {allBeds ? 'Show less' : 'View All Beds'} <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', allBeds && 'rotate-180')} aria-hidden="true" />
          </button>
        )}
      </section>
    </div>
  );
}

/* ── Tabs ───────────────────────────────────────────────────────── */

function ScheduleTab({ events }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  if (!events.length) return <MiniEmpty text="Nothing scheduled today" />;
  const nowIdx = events.findIndex((e) => new Date(e.end).getTime() > now);
  const items = [];
  events.forEach((e, i) => {
    if (i === nowIdx) items.push({ marker: true });
    items.push(e);
  });
  if (nowIdx === -1) items.push({ marker: true });

  return (
    <section className="flow-card p-4">
      <ol className="relative border-l border-cream-200 ml-2">
        {items.map((e, i) => {
          if (e.marker) {
            return (
              <li key="now" className="relative pl-5 py-1.5" aria-label="Current time">
                <span className="absolute -left-[6px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-royal-500 animate-pulse-glow" />
                <span className="text-[11px] font-semibold text-royal-500">Now · {clock(now)}</span>
              </li>
            );
          }
          const past = new Date(e.end).getTime() <= now;
          const color = EVENT_COLORS[e.type] || '#014BAA';
          return (
            <li key={e.id || i} className={clsx('relative pl-5 py-2', past && 'opacity-55')}>
              <span className="absolute -left-[5px] top-3.5 w-2.5 h-2.5 rounded-full border-2 border-cream-50" style={{ backgroundColor: past ? '#94A3B8' : color }} aria-hidden="true" />
              <div className="flex items-start gap-3">
                <span className="text-xs font-semibold tabular-nums text-ink-500 w-11 shrink-0">{clock(e.start)}</span>
                {past ? <CheckCircle2 className="w-4 h-4 text-ink-500 shrink-0" aria-label="Done" /> : <EventIcon type={e.type} className="w-4 h-4 shrink-0" />}
                <span className="min-w-0">
                  <span className={clsx('block text-xs font-semibold', past ? 'text-ink-500' : 'text-ink-900')}>{e.title}</span>
                  {e.location && <span className="block text-[11px] text-ink-500">{e.location}</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PatientsTab({ patients, onOpen, onReport, onUpdate, onRequestOt, onTrack }) {
  if (!patients.length) return <MiniEmpty text="No active patients" />;
  return (
    <div className="table-wrap">
      <table className="mo-table">
        <thead>
          <tr>
            <th scope="col">Bed</th>
            <th scope="col">Patient</th>
            <th scope="col">Days Admitted</th>
            <th scope="col">Acuity</th>
            <th scope="col" title="ICU need predicted by the trained model">ICU risk</th>
            <th scope="col">Status</th>
            <th scope="col" className="text-right">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => (
            <tr key={p.patientId} onClick={() => onOpen(p.patientId)} className="cursor-pointer">
              <td className="font-mono font-semibold">{p.bedId}</td>
              <td>
                <span className="font-semibold">{p.alias}</span>
                <span className="block text-[11px] text-ink-500 truncate max-w-[220px]">{p.diagnosis}</span>
              </td>
              <td className="tabular-nums">Day {p.daysAdmitted}</td>
              <td>
                <AcuityBadge level={p.acuity} size="xs" />
              </td>
              <td>{p.bedId?.startsWith('ICU') ? <span className="text-[11px] text-ink-500">In ICU</span> : <IcuRiskBadge risk={p.icuRisk} size="xs" />}</td>
              <td>
                <StatusPill status={p.acuity <= 2 && p.status === 'admitted' ? 'critical' : p.status} size="xs" />
                {p.otPending && <span className="ml-1 text-[10px] text-fg-violet font-semibold">OT requested</span>}
              </td>
              <td className="text-right" onClick={(e) => e.stopPropagation()}>
                <div className="inline-flex gap-1">
                  <button type="button" className="flow-btn-ghost !px-2 !py-1" onClick={() => onReport(p.patientId)} title="View Report">
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" /> <span className="hidden xl:inline">Report</span>
                  </button>
                  <button type="button" className="flow-btn-ghost !px-2 !py-1" onClick={() => onUpdate(p)} title="Update Status">
                    <Activity className="w-3.5 h-3.5" aria-hidden="true" /> <span className="hidden xl:inline">Status</span>
                  </button>
                  <button type="button" className="flow-btn-ghost !px-2 !py-1" onClick={() => onRequestOt(p.patientId)} title="Request OT">
                    <Scissors className="w-3.5 h-3.5" aria-hidden="true" /> <span className="hidden xl:inline">OT</span>
                  </button>
                  <button type="button" className="flow-btn-ghost !px-2 !py-1" onClick={() => onTrack(p.patientId)} title="Track Patient">
                    <Route className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OtCasesTab({ onRequest }) {
  const q = useFlowPolling(() => careApi.getOtBoard(), { intervalMs: 60000, refreshOn: ['ot.caseCompleted'] });
  const [open, setOpen] = useState(null);
  const cases = q.data?.cases || [];
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" className="flow-btn-primary" onClick={onRequest}>
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Request OT Slot
        </button>
      </div>
      {q.loading && !q.data && <FlowSkeleton lines={5} />}
      {q.data && (
        <div className="table-wrap">
          <table className="mo-table">
            <thead>
              <tr>
                <th scope="col">Case #</th>
                <th scope="col">Patient</th>
                <th scope="col">Procedure</th>
                <th scope="col">Room</th>
                <th scope="col">Time</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="cursor-pointer" onClick={() => setOpen(c)}>
                  <td className="font-mono">{c.caseNumber}</td>
                  <td className="font-semibold">{c.alias}</td>
                  <td className="max-w-[240px] truncate">{c.procedure}</td>
                  <td>{c.room}</td>
                  <td className="tabular-nums">{clock(c.start)}</td>
                  <td>
                    <StatusPill status={c.status} size="xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <OtCaseModal c={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────── */

export default function DoctorDashboard() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const tab = ROUTE_TAB[location.pathname] || 'schedule';
  // The overview (stat tiles + Today's Board) shows on /doctor/dashboard; sidebar sections open directly
  const isOverview = location.pathname === '/doctor/dashboard';
  const setTab = (t) => navigate(TAB_ROUTE[t]);
  const [popup, setPopup] = useState(null); // { id, tab }
  const [updating, setUpdating] = useState(null);
  const [otFor, setOtFor] = useState(undefined);
  const [busyId, setBusyId] = useState(null);
  const q = useFlowPolling(() => careApi.getDoctorDashboard(), { intervalMs: 30000, refreshOn: ['patient.updated', 'bed.updated', 'flow.analysisComplete'] });
  const d = q.data;
  const me = displayName(user);

  // Optimistic: the button and badge change on click; the save runs in the background
  const [pendingStatus, setPendingStatus] = useState(null);
  const setStatus = async (status) => {
    const current = pendingStatus || d?.doctor.status;
    if (status === current) return;
    const [, label, , note] = STATUS_BUTTONS.find(([k]) => k === status);
    setPendingStatus(status);
    try {
      await careApi.setDoctorStatus(status);
      toast.success(`Status: ${label}. ${note}.`, { id: 'doctor-status' });
      await q.refresh({ silent: true });
    } catch (e) {
      toast.error(errorText(e, 'Could not change status'), { id: 'doctor-status' });
    } finally {
      setPendingStatus(null);
    }
  };

  const discharge = async (row) => {
    setBusyId(row.patientId);
    try {
      await flowApi.postEvent('DISCHARGE_SIGNED', { patientId: row.patientId });
      toast.success(`Discharge signed for ${row.alias}`);
      q.refresh({ silent: true });
    } catch (e) {
      toast.error(errorText(e, 'Could not sign discharge'));
    } finally {
      setBusyId(null);
    }
  };

  const tabs = useMemo(
    () => [
      { id: 'schedule', label: "Today's Schedule", icon: Clock3 },
      { id: 'patients', label: 'My Patients', icon: Users, count: d?.patients.length },
      { id: 'ot', label: 'OT Cases', icon: Scissors },
      { id: 'calendar', label: 'Calendar', icon: CalendarDays },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
    [d]
  );

  if (q.error && !d) return <FlowError message={q.error} onRetry={q.refresh} />;
  if (!d) return <FlowSkeleton lines={12} />;

  const doc = d.doctor;
  const myStatus = pendingStatus || (doc.status === 'break' ? 'on_break' : doc.status);
  return (
    <div className="space-y-4">
      {/* Header */}
      <FlowPageHeader
        title={doc.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill status={STATUS_PILL[myStatus] || 'online'} label={STATUS_BUTTONS.find(([k]) => k === myStatus)?.[1] || 'Available'} size="xs" />
            <span>
              {doc.specialty} · Shift ends {doc.shiftEnd}
            </span>
          </span>
        }
        showHealth={false}
        actions={
          <div className="inline-flex flex-wrap rounded-lg border border-cream-200 bg-cream-50 p-0.5" role="group" aria-label="Set my status">
            {STATUS_BUTTONS.map(([k, l, c]) => (
              <button
                key={k}
                type="button"
                onClick={() => setStatus(k)}
                aria-pressed={myStatus === k}
                disabled={Boolean(pendingStatus)}
                className={clsx('px-3 py-1.5 rounded-md text-xs font-semibold disabled:cursor-wait', myStatus === k ? 'text-white' : 'text-ink-500 hover:text-ink-900 hover:bg-sunken')}
                style={myStatus === k ? { backgroundColor: c } : undefined}
              >
                {l}
              </button>
            ))}
          </div>
        }
      />

      {isOverview && (
        <>
      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Hospital} value={d.stats.patientsToday} label="Patients today" />
        <StatTile icon={Scissors} value={`${d.stats.surgeriesScheduled} / ${d.stats.surgeriesDone}`} label="Surgeries scheduled / done" tone="violet" />
        <StatTile icon={LogOut} value={d.stats.dischargesToday} label="Discharges today" tone="ok" />
        <StatTile icon={ClipboardList} value={d.stats.pendingTasks} label="Pending tasks" tone={d.stats.pendingTasks ? 'warn' : 'default'} />
      </div>

      <TodayBoard data={d} onOpen={(id) => setPopup({ id, tab: 'overview' })} onDischarge={discharge} busyId={busyId} />
        </>
      )}

      <div>
        <TabBar tabs={tabs} active={tab} onChange={setTab} className="mb-3" />
        {tab === 'schedule' && <ScheduleTab events={d.schedule} />}
        {tab === 'patients' && (
          <PatientsTab
            patients={d.patients}
            onOpen={(id) => setPopup({ id, tab: 'overview' })}
            onReport={(id) => setPopup({ id, tab: 'report' })}
            onUpdate={setUpdating}
            onRequestOt={(id) => setOtFor(id)}
            onTrack={(id) => navigate(`/patient-journey/${id}`)}
          />
        )}
        {tab === 'ot' && <OtCasesTab onRequest={() => setOtFor(null)} />}
        {tab === 'calendar' && <DoctorCalendar />}
        {tab === 'notifications' && <NotificationsList source="flow" />}
      </div>

      {popup && <PatientDetailPopup patientId={popup.id} initialTab={popup.tab} onClose={() => setPopup(null)} onChanged={() => q.refresh({ silent: true })} />}
      {updating && <UpdateStatusModal patient={updating} by={me} onClose={() => setUpdating(null)} onSaved={() => q.refresh({ silent: true })} />}
      {otFor !== undefined && <RequestOtModal patients={d.patients} initial={otFor} by={me} onClose={() => setOtFor(undefined)} onSaved={() => q.refresh({ silent: true })} />}
    </div>
  );
}
