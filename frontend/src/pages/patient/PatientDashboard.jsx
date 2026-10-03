/**
 * @file PatientDashboard.jsx
 * Patient portal: the signed-in patient sees only their own information. Header card, 4 stat tiles and
 * tabs My Status, My Treatment, Reports, Requests (each also a route under /patient/*), plus Help.
 * No clinical values are shown.
 */

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  CalendarDays,
  ClipboardList,
  FlaskConical,
  Stethoscope,
  HeartPulse,
  Route,
  FileText,
  MessageSquare,
  BellRing,
  Pill,
  UtensilsCrossed,
  HelpCircle,
  Download,
  Send,
  Phone,
  LifeBuoy,
  Eye,
  Clock3,
} from 'lucide-react';
import StatusPill from '../../components/domain/StatusPill.jsx';
import PatientReportSheet, { printReport } from '../../components/domain/PatientReportSheet.jsx';
import { JourneyDays } from '../../components/domain/PatientDetailPopup.jsx';
import { FlowModal, FlowError, FlowSkeleton } from '../../components/domain/FlowUi.jsx';
import { StatTile, TabBar, AcuityDots, Avatar, Field, TimelineList, MiniEmpty, PanelTitle } from '../../components/domain/CareUi.jsx';
import careApi from '../../api/careApi.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { clock, shortDate, timeAgo } from '../../utils/flowFormat.js';

const ROUTE_TAB = { '/patient/dashboard': 'status', '/patient/treatment': 'treatment', '/patient/reports': 'reports', '/patient/requests': 'requests', '/patient/help': 'help' };
const TAB_ROUTE = Object.fromEntries(Object.entries(ROUTE_TAB).map(([k, v]) => [v, k]));

const STATUS_LABEL = { admitted: 'Admitted', in_surgery: 'In Surgery', in_recovery: 'In Recovery', discharged: 'Discharged', waiting: 'Waiting for bed' };

const REQUEST_OPTIONS = [
  ['nurse_assistance', 'Nurse Assistance', BellRing, '#EC4899'],
  ['medication_query', 'Medication Query', Pill, '#8B5CF6'],
  ['dietary', 'Dietary Request', UtensilsCrossed, '#F59E0B'],
  ['general_query', 'General Query', HelpCircle, '#014BAA'],
];
const MAX = 200;

function HeaderCard({ p, name }) {
  return (
    <section className="flow-card p-4 flex flex-col md:flex-row md:items-center gap-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Avatar name={name} color="#047857" size="lg" />
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-ink-900">{name}</h1>
          <p className="text-xs text-ink-500">
            ID {p.alias} · Blood {p.bloodGroup} · Admitted {shortDate(p.admittedAt)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <StatusPill status={p.status} label={STATUS_LABEL[p.status]} size="lg" />
        {[
          ['Ward', p.bed?.ward],
          ['Bed', p.bed?.id],
          ['Floor', p.bed?.floor ? `Floor ${p.bed.floor}` : null],
        ].map(([l, v]) => (
          <div key={l}>
            <p className="text-[10px] text-ink-500">{l}</p>
            <p className="text-xs font-semibold text-ink-900">{v || '—'}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusTab({ data }) {
  const p = data.profile;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <section className="flow-card p-4">
        <PanelTitle>Current condition</PanelTitle>
        <Field label="Acuity level">
          <span className="inline-flex items-center gap-2">
            <AcuityDots level={p.acuity} /> <span className="text-ink-500">Level {p.acuity}</span>
          </span>
        </Field>
        <Field label="Diagnosis">{p.diagnosis}</Field>
        <div className="flex items-center gap-2.5 py-2 border-t border-cream-200 mt-1">
          <Avatar name={p.doctor.name} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-900">{p.doctor.name}</p>
            <p className="text-[11px] text-ink-500">{p.doctor.specialty || 'Attending doctor'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 py-2 border-t border-cream-200">
          <Avatar name={p.nurse?.name || 'Nurse'} color="#BE185D" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-900">{p.nurse?.name || 'Ward nurse'}</p>
            <p className="text-[11px] text-ink-500">Your nurse{p.nurse ? ` · ${p.nurse.shift}` : ''}</p>
          </div>
        </div>
        <div className="mt-2 rounded-lg bg-royal-500/10 px-3 py-2.5 flex items-center gap-2.5">
          <Clock3 className="w-4 h-4 text-royal-500 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] text-ink-500">Next scheduled</p>
            <p className="text-xs font-semibold text-ink-900">{data.nextEvent ? `${data.nextEvent.label} · ${clock(data.nextEvent.at)}` : 'Nothing else today'}</p>
          </div>
        </div>
      </section>
      <section className="flow-card p-4">
        <PanelTitle count={data.schedule.length}>Today</PanelTitle>
        <TimelineList items={data.schedule} emptyText="Nothing scheduled today" />
      </section>
    </div>
  );
}

function ReportsTab({ reports }) {
  const [open, setOpen] = useState(null);
  if (!reports.length) return <MiniEmpty text="No reports shared yet" icon={FileText} />;
  return (
    <>
      <div className="table-wrap">
        <table className="mo-table">
          <thead>
            <tr>
              <th scope="col">Report</th>
              <th scope="col">Date</th>
              <th scope="col">Doctor</th>
              <th scope="col" className="text-right">
                Download
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold">{r.title}</td>
                <td>{shortDate(r.sharedAt || r.createdAt)}</td>
                <td>{r.doctorName}</td>
                <td className="text-right">
                  <button type="button" className="flow-btn-secondary !py-1" onClick={() => setOpen(r)}>
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" /> View / PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <FlowModal
          open
          onClose={() => setOpen(null)}
          title={open.title}
          size="lg"
          footer={
            <button type="button" className="flow-btn-primary" onClick={printReport}>
              <Download className="w-3.5 h-3.5" aria-hidden="true" /> Download PDF
            </button>
          }
        >
          <PatientReportSheet report={open} />
        </FlowModal>
      )}
    </>
  );
}

function RequestsTab({ requests, onSent }) {
  const [type, setType] = useState(REQUEST_OPTIONS[0][0]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await careApi.submitPortalRequest({ type, message: message.trim() });
      toast.success('Request sent to your care team');
      setMessage('');
      onSent();
    } catch (err) {
      toast.error(errorText(err, 'Could not send request'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <form onSubmit={submit} className="flow-card p-4 space-y-3">
        <PanelTitle>New request</PanelTitle>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Request type">
          {REQUEST_OPTIONS.map(([k, l, Icon, c]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={type === k}
              onClick={() => setType(k)}
              className={clsx('flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition-colors', type === k ? 'text-ink-900' : 'border-cream-200 text-ink-500 hover:bg-sunken')}
              style={type === k ? { borderColor: c, backgroundColor: `${c}1A` } : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" style={{ color: c }} aria-hidden="true" /> {l}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="label-xs flex justify-between mb-1">
            Message <span className="normal-case tracking-normal font-normal tabular-nums">{message.length}/{MAX}</span>
          </span>
          <textarea className="flow-input min-h-[90px]" maxLength={MAX} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" required />
        </label>
        <button type="submit" className="flow-btn-primary w-full" disabled={busy}>
          <Send className="w-3.5 h-3.5" aria-hidden="true" /> Submit
        </button>
      </form>
      <section className="flow-card p-4">
        <PanelTitle count={requests.length}>My requests</PanelTitle>
        {!requests.length && <MiniEmpty text="No requests yet" />}
        <ul>
          {requests.map((r) => (
            <li key={r.id} className="flex items-start gap-3 py-2.5 border-b border-cream-200 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink-900">{r.typeLabel}</p>
                <p className="text-[11px] text-ink-500">{r.note || 'No message'}</p>
                <p className="text-[10px] text-ink-500 mt-0.5">{timeAgo(r.createdAt)}</p>
              </div>
              <StatusPill status={r.status} size="xs" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function HelpTab({ data }) {
  const p = data.profile;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {[
        [BellRing, 'Need a nurse now?', 'Press the call bell by your bed, or send a Nurse Assistance request.', '#EC4899'],
        [Phone, 'Ward desk', `${p.bed?.ward || 'Your ward'} · extension 2${p.bed?.floor || '0'}14`, '#014BAA'],
        [LifeBuoy, 'Emergency', 'Dial 108 or ask any staff member. Help is available 24 hours.', '#EF4444'],
      ].map(([Icon, t, body, c]) => (
        <section key={t} className="flow-card p-4">
          <Icon className="w-5 h-5 mb-2" style={{ color: c }} aria-hidden="true" />
          <h3 className="text-sm font-semibold text-ink-900">{t}</h3>
          <p className="text-xs text-ink-500 mt-1">{body}</p>
        </section>
      ))}
    </div>
  );
}

export default function PatientDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = ROUTE_TAB[location.pathname] || 'status';
  const q = useFlowPolling(() => careApi.getPortal(), { intervalMs: 60000, refreshOn: ['patient.updated'] });
  const d = q.data;

  if (q.error && !d) return <FlowError message={q.error} onRetry={q.refresh} />;
  if (!d) return <FlowSkeleton lines={12} />;

  const tabs = [
    { id: 'status', label: 'My Status', icon: HeartPulse },
    { id: 'treatment', label: 'My Treatment', icon: Route },
    { id: 'reports', label: 'Reports', icon: FileText, count: d.reports.length },
    { id: 'requests', label: 'Requests', icon: MessageSquare },
  ];

  return (
    <div className="space-y-4 max-w-6xl">
      <HeaderCard p={d.profile} name={d.name} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={CalendarDays} value={d.stats.daysAdmitted} label="Days admitted" />
        <StatTile icon={ClipboardList} value={d.stats.proceduresToday} label="Today's procedures" tone="violet" />
        <StatTile icon={FlaskConical} value={d.stats.pendingTests} label="Pending tests" tone={d.stats.pendingTests ? 'warn' : 'ok'} />
        <StatTile icon={Stethoscope} value={<span className="text-sm">{d.stats.doctorName}</span>} label="Your doctor" tone="ok" />
      </div>

      {tab !== 'help' && <TabBar tabs={tabs} active={tab} onChange={(t) => navigate(TAB_ROUTE[t])} />}
      {tab === 'status' && <StatusTab data={d} />}
      {tab === 'treatment' && <JourneyDays profile={d.profile} journey={d.journey} />}
      {tab === 'reports' && <ReportsTab reports={d.reports} />}
      {tab === 'requests' && <RequestsTab requests={d.requests} onSent={() => q.refresh({ silent: true })} />}
      {tab === 'help' && <HelpTab data={d} />}
    </div>
  );
}
