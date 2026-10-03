/**
 * @file PatientJourneyPage.jsx
 * /admin/patient-journey/:patientId (and /patient-journey/:patientId for doctors and OT managers):
 * the full journey of one patient as a horizontal step flow, Registration to Discharge. When the patient
 * needs OT, the OT step expands with live doctor availability and an "Assign Doctor" action.
 * Below: a chronological event log. Without an id, shows a patient picker.
 */

import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ArrowRight, ArrowLeft, CheckCircle2, Clock3, ClipboardList, MinusCircle, Search, UserPlus, Route } from 'lucide-react';
import StatusPill from '../../components/domain/StatusPill.jsx';
import DoctorAvailability from '../../components/domain/DoctorAvailability.jsx';
import { FlowModal, FlowError, FlowSkeleton } from '../../components/domain/FlowUi.jsx';
import { AcuityBadge, AcuityDot, EventIcon, MiniEmpty } from '../../components/domain/CareUi.jsx';
import careApi from '../../api/careApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { clock, dateTime, shortDate } from '../../utils/flowFormat.js';

const STEP_STYLE = {
  done: [CheckCircle2, '#046C4E', 'Done'],
  in_progress: [Clock3, '#014BAA', 'In Progress'],
  pending: [ClipboardList, '#5B6B80', 'Pending'],
  skipped: [MinusCircle, '#5B6B80', 'Skipped'],
};

function duration(min) {
  if (min == null) return null;
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return h < 48 ? `${h.toFixed(h < 10 ? 1 : 0)} h` : `${Math.round(h / 24)} days`;
}

function Picker({ base }) {
  const [search, setSearch] = useState('');
  const q = useFlowPolling(() => careApi.listPatients(), { intervalMs: 60000 });
  const rows = (q.data || []).filter((p) => !search || `${p.alias} ${p.bedId} ${p.doctorName} ${p.diagnosis}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-4">
      <FlowPageHeader
        title="Patient Journey"
        subtitle="Pick a patient to track their journey"
        showHealth={false}
        actions={
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input className="flow-input !pl-8" placeholder="Search patient, bed, doctor" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search patients" />
          </div>
        }
      />
      {q.error && !q.data && <FlowError message={q.error} onRetry={q.refresh} />}
      {!q.data && !q.error && <FlowSkeleton lines={8} />}
      {q.data && (
        <div className="table-wrap">
          <table className="mo-table">
            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col">Bed</th>
                <th scope="col">Days</th>
                <th scope="col">Doctor</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">
                  Journey
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.patientId}>
                  <td>
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <AcuityDot level={p.acuity} /> {p.alias}
                    </span>
                  </td>
                  <td className="font-mono">{p.bedId || '—'}</td>
                  <td>Day {p.daysAdmitted}</td>
                  <td>{p.doctorName}</td>
                  <td>
                    <StatusPill status={p.status} size="xs" />
                  </td>
                  <td className="text-right">
                    <Link to={`${base}/${p.patientId}`} className="flow-btn-secondary !py-1">
                      <Route className="w-3.5 h-3.5" aria-hidden="true" /> Track Patient
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScheduleOtModal({ doctor, profile, onClose, onDone }) {
  const soon = new Date(Date.now() + 2 * 3600000);
  const [room, setRoom] = useState('4');
  const [time, setTime] = useState(`${String(soon.getHours()).padStart(2, '0')}:00`);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const [h, m] = time.split(':').map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    if (start.getTime() < Date.now()) start.setDate(start.getDate() + 1);
    setBusy(true);
    try {
      await careApi.assignOtDoctor(profile.patientId, doctor.id, { roomId: room, start: start.toISOString() });
      toast.success(`${doctor.name} assigned to ${profile.alias}`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorText(e, 'Could not schedule OT'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <FlowModal
      open
      onClose={onClose}
      size="sm"
      title="Schedule OT"
      subtitle={`${profile.alias} · ${profile.otPending?.procedure || 'Procedure'} · ${doctor.name}`}
      footer={
        <>
          <button type="button" className="flow-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="flow-btn-primary" onClick={submit} disabled={busy}>
            Confirm
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label-xs block mb-1">Room</span>
          <select className="flow-input" value={room} onChange={(e) => setRoom(e.target.value)}>
            {[1, 2, 3, 4].map((r) => (
              <option key={r} value={r}>
                OT-{r}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label-xs block mb-1">Start time</span>
          <input type="time" className="flow-input" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
    </FlowModal>
  );
}

function Journey({ patientId, backTo }) {
  const role = useAuthStore((s) => s.role);
  const [assigning, setAssigning] = useState(null);
  const q = useFlowPolling(() => careApi.getJourney(patientId), { intervalMs: 60000, deps: [patientId], refreshOn: ['doctor.statusChanged', 'ot.caseCompleted', 'patient.updated'] });
  const d = q.data;
  const canAssign = role === 'admin' || role === 'ot_manager' || role === 'doctor';

  if (q.error && !d) return <FlowError message={q.error} onRetry={q.refresh} />;
  if (!d) return <FlowSkeleton lines={12} />;
  const p = d.profile;

  return (
    <div className="space-y-4">
      <Link to={backTo} className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900">
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back
      </Link>

      <header className="flow-card px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-base font-bold text-ink-900">{p.name ? `${p.name} · ${p.alias}` : p.alias}</h1>
        <span className="text-xs text-ink-500">
          {p.age} y · {p.gender} · Blood {p.bloodGroup}
        </span>
        <StatusPill status={p.status} />
        <AcuityBadge level={p.acuity} />
        <span className="text-xs text-ink-500">
          Admitted {shortDate(p.admittedAt)} · <b className="text-ink-900">Day {p.daysAdmitted}</b>
        </span>
        <span className="text-xs text-ink-500 sm:ml-auto">
          {p.doctor.name}
          {p.bed ? ` · ${p.bed.id}` : ''}
        </span>
      </header>

      <section className="flow-card p-4">
        <h2 className="label-xs mb-3">Journey</h2>
        <ol className="flex flex-col lg:flex-row lg:items-stretch gap-1 lg:gap-0">
          {d.steps.map((s, i) => {
            const [Icon, color, label] = STEP_STYLE[s.status] || STEP_STYLE.pending;
            const current = s.status === 'in_progress';
            return (
              <React.Fragment key={s.key}>
                <li
                  className={clsx('rounded-xl border-2 px-2.5 py-2.5 lg:flex-1 lg:min-w-0 bg-cream-50', current && 'animate-pulse-glow', s.status === 'skipped' && 'border-dashed bg-sunken')}
                  style={{ borderColor: current ? '#014BAA' : s.status === 'done' ? '#10B98166' : 'rgb(var(--cream-200))' }}
                >
                  <p className="text-xs font-bold text-ink-900 truncate">{s.label}</p>
                  <p className="inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5" style={{ color }}>
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {label}
                  </p>
                  {s.durationMin != null && s.status === 'done' && <p className="text-[10px] text-ink-500 mt-0.5">{duration(s.durationMin)}</p>}
                  {s.at && <p className="text-[10px] text-ink-500">{dateTime(s.at)}</p>}
                  {s.by && <p className="text-[10px] text-ink-500 truncate" title={s.by}>{s.by}</p>}
                  {s.detail && <p className="text-[10px] text-fg-violet truncate" title={s.detail}>{s.detail}</p>}
                </li>
                {i < d.steps.length - 1 && (
                  <span className="flex items-center justify-center lg:px-0.5 lg:w-4 shrink-0 text-ink-500/60" aria-hidden="true">
                    <ArrowRight className="hidden lg:block w-3.5 h-3.5" />
                    <ArrowRight className="lg:hidden w-4 h-4 rotate-90" />
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </ol>

        {d.needsOt && (
          <div className="mt-4 rounded-xl border border-[#014BAA]/40 bg-[#014BAA]/5 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-ink-900">OT needed: {d.ot?.procedure}</h3>
              <span className="text-[11px] text-ink-500">requested {clock(d.ot?.requestedAt)}</span>
            </div>
            <DoctorAvailability doctors={d.doctors} onAssign={canAssign ? setAssigning : undefined} assignLabel="Assign to patient" />
          </div>
        )}
        {d.ot && !d.needsOt && (
          <p className="mt-3 text-xs text-ink-900">
            <UserPlus className="inline w-3.5 h-3.5 mr-1 text-fg-violet" aria-hidden="true" />
            OT scheduled with <b>{d.ot.surgeon}</b> in {d.ot.room} at {clock(d.ot.start)}
          </p>
        )}
      </section>

      <section>
        <h2 className="label-xs mb-2">Detail log</h2>
        {!d.log.length ? (
          <MiniEmpty text="No events" />
        ) : (
          <div className="table-wrap">
            <table className="mo-table">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Event</th>
                  <th scope="col">Who</th>
                  <th scope="col">Duration</th>
                </tr>
              </thead>
              <tbody>
                {d.log.map((e, i) => {
                  const next = d.log[i + 1];
                  const mins = next ? Math.round((new Date(next.at) - new Date(e.at)) / 60000) : null;
                  return (
                    <tr key={`${e.at}-${i}`}>
                      <td className="tabular-nums text-ink-500">{dateTime(e.at)}</td>
                      <td>
                        <span className="inline-flex items-center gap-2">
                          <EventIcon type={e.type} /> {e.description}
                        </span>
                      </td>
                      <td>{e.by || '—'}</td>
                      <td className="text-ink-500">{mins != null ? duration(mins) : 'Ongoing'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {assigning && <ScheduleOtModal doctor={assigning} profile={p} onClose={() => setAssigning(null)} onDone={() => q.refresh({ silent: true })} />}
    </div>
  );
}

export default function PatientJourneyPage() {
  const { patientId } = useParams();
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === 'admin';
  const base = isAdmin ? '/admin/patient-journey' : '/patient-journey';
  const backTo = useMemo(() => (isAdmin ? '/admin/patient-journey' : role === 'ot_manager' ? '/ot/dashboard' : '/doctor/dashboard'), [isAdmin, role]);

  if (!patientId) {
    return isAdmin ? <Picker base={base} /> : <Navigate to={backTo} replace />;
  }
  return <Journey patientId={patientId} backTo={backTo} />;
}
