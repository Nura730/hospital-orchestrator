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
import { RequestSteps, RequestHistory } from '../../components/domain/RequestThread.jsx';
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
const REQUEST_STYLE = Object.fromEntries(REQUEST_OPTIONS.map(([k, , Icon, c]) => [k, { Icon, color: c }]));
// Status label colours: text shade passes AA on its tint
const REQ_STATUS = {
  new: ['Sent', '#92400E', '#F59E0B'],
  acknowledged: ['Seen', '#014BAA', '#014BAA'],
  in_progress: ['In progress', '#6D28D9', '#8B5CF6'],
  scheduled: ['Scheduled', '#014BAA', '#014BAA'],
  done: ['Resolved', '#046C4E', '#10B981'],
  declined: ['Declined', '#B91C1C', '#EF4444'],
};
const OPEN_STATUSES = ['new', 'acknowledged', 'in_progress', 'scheduled'];
const initials = (name = '') =>
  name
    .replace(/^(Dr\.|Nurse)\s+/, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

function RequestCard({ r, doctorName, expanded, onToggle }) {
  const style = REQUEST_STYLE[r.type] || { Icon: MessageSquare, color: '#014BAA' };
  const [label, text, tint] = REQ_STATUS[r.status] || REQ_STATUS.new;
  const last = r.history?.[r.history.length - 1];
  const handler = r.routedTo?.name || 'Care team';
  const doctorInformed = r.routedTo?.role && r.routedTo.role !== 'doctor';
  const { Icon } = style;
  return (
    <article className="flow-card overflow-hidden">
      <div className="p-4 space-y-4">
        <header className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${style.color}1A`, color: style.color }}>
            <Icon className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-ink-900">{r.typeLabel}</h3>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ color: text, backgroundColor: `${tint}1F` }}>
                {label}
              </span>
            </div>
            <p className="text-xs text-ink-500 mt-0.5">Sent {timeAgo(r.createdAt)}, at {clock(r.createdAt)}</p>
          </div>
        </header>

        <blockquote className="rounded-lg bg-sunken px-3.5 py-2.5 text-sm text-ink-900 border-l-[3px]" style={{ borderLeftColor: style.color }}>
          {r.note || 'No message'}
        </blockquote>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="inline-flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-royal-500/10 text-royal-500 text-xs font-bold flex items-center justify-center" aria-hidden="true">
              {initials(handler)}
            </span>
            <span className="text-ink-500">
              Handled by <b className="text-ink-900">{handler}</b>
            </span>
          </span>
          {doctorInformed && <span className="text-ink-500">Your doctor, {doctorName}, is kept informed</span>}
        </div>

        <RequestSteps status={r.status} history={r.history} />

        {r.response && (
          <div className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/5 px-3.5 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-fg-ok">Reply from {last?.by || handler}</p>
            <p className="text-sm text-ink-900 mt-1">{r.response}</p>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-cream-200 bg-sunken/50 px-4 py-2.5">
        {last ? (
          <p className="text-sm text-ink-900 min-w-0">
            <span className="text-ink-500">Latest:</span> {last.text}
            <span className="text-ink-500">
              {last.text.includes(last.by) ? '' : `, ${last.by}`}, {timeAgo(last.at)}
            </span>
          </p>
        ) : (
          <span />
        )}
        <button type="button" className="text-sm font-semibold text-royal-500 hover:underline shrink-0" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? 'Hide history' : `History (${r.history?.length || 0})`}
        </button>
      </footer>
      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-cream-200">
          <RequestHistory history={r.history} />
        </div>
      )}
    </article>
  );
}

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
            <p className="text-[11px] text-ink-500">{l}</p>
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
            <p className="text-xs text-ink-500">{p.doctor.specialty || 'Attending doctor'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 py-2 border-t border-cream-200">
          <Avatar name={p.nurse?.name || 'Nurse'} color="#BE185D" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-900">{p.nurse?.name || 'Ward nurse'}</p>
            <p className="text-xs text-ink-500">Your nurse{p.nurse ? ` · ${p.nurse.shift}` : ''}</p>
          </div>
        </div>
        <div className="mt-2 rounded-lg bg-royal-500/10 px-3 py-2.5 flex items-center gap-2.5">
          <Clock3 className="w-4 h-4 text-royal-500 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[11px] text-ink-500">Next scheduled</p>
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

function RequestsTab({ requests, profile, onSent }) {
  const [type, setType] = useState(REQUEST_OPTIONS[0][0]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [show, setShow] = useState('open');
  // Ask the hospital where this type really goes (same routing rules the request will follow)
  const routeQ = useFlowPolling(() => careApi.previewPortalRoute(type), { deps: [type], toastOnError: false });
  // Only trust an answer for the type that is selected now (a click can arrive before the previous answer)
  const route = routeQ.data?.type === type ? routeQ.data : null;
  const goesTo = () => route?.name || 'the right team';
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await careApi.submitPortalRequest({ type, message: message.trim() });
      toast.success(`Sent to ${goesTo()}. You can follow it below.`);
      setMessage('');
      onSent();
    } catch (err) {
      toast.error(errorText(err, 'Could not send request'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-4 items-start">
      <form onSubmit={submit} className="flow-card p-5 space-y-4">
        <h2 className="text-base font-bold text-ink-900">New request</h2>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Request type">
          {REQUEST_OPTIONS.map(([k, l, Icon, c]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={type === k}
              onClick={() => setType(k)}
              className={clsx('flex flex-col items-start gap-1.5 rounded-xl border-2 px-3 py-3 text-left transition-colors', type === k ? 'text-ink-900' : 'border-cream-200 text-ink-900 hover:bg-sunken')}
              style={type === k ? { borderColor: c, backgroundColor: `${c}12` } : undefined}
            >
              <Icon className="w-5 h-5" style={{ color: c }} aria-hidden="true" />
              <span className="text-sm font-semibold">{l}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-500 min-h-[2.5rem]" aria-live="polite">
          Goes to <b className="text-ink-900">{route ? route.name : '…'}</b>
          {route?.doctorInformed && (
            <>
              . Your doctor, <b className="text-ink-900">{route.doctorName}</b>, is kept informed.
            </>
          )}
        </p>
        <label className="block">
          <span className="flex justify-between text-xs font-semibold text-ink-900 mb-1">
            Message <span className="font-normal text-ink-500 tabular-nums">{message.length}/{MAX}</span>
          </span>
          <textarea className="flow-input !text-sm min-h-[110px]" maxLength={MAX} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" required />
        </label>
        <button type="submit" className="flow-btn-primary w-full !py-2.5 !text-sm" disabled={busy}>
          <Send className="w-4 h-4" aria-hidden="true" /> Send request
        </button>
      </form>
      <section className="space-y-3" aria-label="My requests">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-ink-900">My requests</h2>
          <div className="inline-flex rounded-lg border border-cream-200 bg-cream-50 p-0.5" role="group" aria-label="Show requests">
            {[
              ['open', `Open (${requests.filter((r) => OPEN_STATUSES.includes(r.status)).length})`],
              ['closed', `Closed (${requests.filter((r) => !OPEN_STATUSES.includes(r.status)).length})`],
            ].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setShow(k)} aria-pressed={show === k} className={clsx('px-3 py-1.5 rounded-md text-sm font-semibold', show === k ? 'bg-royal-500 text-white' : 'text-ink-500 hover:text-ink-900')}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {(() => {
          const list = requests.filter((r) => (show === 'open' ? OPEN_STATUSES.includes(r.status) : !OPEN_STATUSES.includes(r.status)));
          if (!list.length) {
            return (
              <div className="flow-card">
                <MiniEmpty text={show === 'open' ? 'No open requests. Send one on the left whenever you need help.' : 'No closed requests yet'} />
              </div>
            );
          }
          return list.map((r) => <RequestCard key={r.id} r={r} doctorName={profile.doctor.name} expanded={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} />);
        })()}
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
      {tab === 'requests' && <RequestsTab requests={d.requests} profile={d.profile} onSent={() => q.refresh({ silent: true })} />}
      {tab === 'help' && <HelpTab data={d} />}
    </div>
  );
}
