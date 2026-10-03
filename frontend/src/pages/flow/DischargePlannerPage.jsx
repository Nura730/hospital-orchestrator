/**
 * @file DischargePlannerPage.jsx
 * /admin/flow/discharge-planner: simple, elegant discharge list.
 *
 *  - Four soft stat cards
 *  - Tabs: Ready · Almost ready · Not yet · All, with search and CSV export
 *  - One clean row per patient (avatar, bed, doctor, readiness, what's left, going home, one action)
 *  - Click a row → side panel with full details, checklist, timeline and actions (selected row is
 *    highlighted soft yellow)
 *  - Beds freeing in the next 4 hours as simple chips with "Book next patient"
 */

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Search, Download, Bell, CheckCircle2, Clock, BedDouble, Sparkles, Home, X, Check, ChevronRight, Stethoscope, UserPlus, CalendarClock } from 'lucide-react';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import PredictionConfidenceBadge from '../../components/domain/PredictionConfidenceBadge.jsx';
import AiReportButton from '../../components/domain/AiReportButton.jsx';
import { FlowSkeleton, FlowEmpty, FlowError, FlowModal } from '../../components/domain/FlowUi.jsx';
import StatusPill from '../../components/domain/StatusPill.jsx';
import flowApi from '../../api/flowApi.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { exportCsv, timeUntil, clock, dateTime } from '../../utils/flowFormat.js';

/* ── Helpers ───────────────────────────────────────────────────────────── */

const GROUPS = {
  ready: { label: 'Ready', color: '#1FA971', pill: 'bg-[#1FA971]/10 text-[#13784F]', dot: 'bg-[#1FA971]' },
  almost: { label: 'Almost ready', color: '#F2A93B', pill: 'bg-[#F2A93B]/15 text-[#8A5200]', dot: 'bg-[#F2A93B]' },
  notyet: { label: 'Not yet', color: '#9AA4B2', pill: 'bg-[#6B7280]/10 text-[#4B5260]', dot: 'bg-[#9AA4B2]' },
};

function groupOf(p) {
  if (p.ready) return 'ready';
  if (p.score >= 40) return 'almost';
  return 'notyet';
}

const FRIENDLY = [
  ['acuity', 'Still being treated'],
  ['imaging', 'Waiting for a scan'],
  ['no expected', 'No discharge time set'],
  ['expected discharge', 'Discharge planned later'],
  ['discharge date', 'Discharge date not set'],
];
function friendly(f) {
  const hit = FRIENDLY.find(([k]) => f.toLowerCase().includes(k));
  return hit ? hit[1] : f;
}

/** One short line: what still needs to happen. */
function whatsLeft(p) {
  if (!p.blockingFactors.length) return { text: 'Nothing left: ready to sign', tone: 'text-[#13784F]' };
  if (p.ready && p.pendingTasks.length) return { text: `Only paperwork: ${p.pendingTasks.join(', ')}`, tone: 'text-[#8A5200]' };
  const first = friendly(p.blockingFactors[0]);
  const more = p.blockingFactors.length - 1;
  return { text: more > 0 ? `${first} +${more} more` : first, tone: 'text-ink-500' };
}

function initialsOf(alias) {
  return (alias || '?').replace(/[^A-Z0-9]/gi, '').slice(-3).toUpperCase();
}

function checklist(p) {
  const blocked = (t) => p.blockingFactors.some((f) => f.toLowerCase().includes(t));
  return [
    { label: 'Clinically stable', done: !blocked('acuity') },
    { label: 'No scan pending', done: !blocked('imaging') },
    { label: 'Going home within 4 hours', done: !blocked('expected discharge') && !blocked('no expected') },
    { label: 'Discharge date set', done: !blocked('discharge date') },
    ...(p.pendingTasks || []).map((t) => ({ label: t, done: false })),
  ];
}

/* ── Pieces ────────────────────────────────────────────────────────────── */

function Stat({ icon: Icon, label, value, hint, color }) {
  return (
    <div className="flow-card px-5 py-4 flex items-center gap-4">
      <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1A`, color }}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold text-royal-900 tabular-nums leading-none">{value}</div>
        <div className="text-xs font-semibold text-ink-900 mt-1">{label}</div>
        {hint && <div className="text-[11px] text-ink-500">{hint}</div>}
      </div>
    </div>
  );
}

function ScoreBadge({ score }) {
  const color = score > 70 ? '#1FA971' : score >= 40 ? '#F2A93B' : '#D64545';
  return (
    <span className="inline-flex items-center gap-1.5" title="Discharge readiness out of 100">
      <span className="relative w-10 h-10" role="img" aria-label={`Readiness ${score} of 100`}>
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="#EFE7E2" strokeWidth="3.5" />
          <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={94.25} strokeDashoffset={94.25 * (1 - score / 100)} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-ink-900 tabular-nums">{score}</span>
      </span>
    </span>
  );
}

/* ── Side panel ────────────────────────────────────────────────────────── */

function PatientPanel({ p, onClose, onNotify, onMarkReady, busy }) {
  const audit = useFlowPolling(() => flowApi.getAudit({ limit: 200 }), { intervalMs: 0, toastOnError: false, deps: [p?.patientId] });

  useEffect(() => {
    if (!p) return undefined;
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [p, onClose]);

  if (!p) return null;
  const g = GROUPS[groupOf(p)];
  const items = checklist(p);
  const events = (audit.data?.events || []).filter((e) => JSON.stringify([e.payload, e.result]).includes(p.patientId)).slice(0, 6);

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-[#0F1B2D]/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label={`Patient ${p.alias}`} className="absolute right-0 top-0 h-full w-full max-w-md bg-cream-50 shadow-modal flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 bg-gradient-to-br from-royal-700 to-royal-500 text-white">
          <div className="flex items-start justify-between">
            <span className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-lg font-extrabold">{initialsOf(p.alias)}</span>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
          <h2 className="text-xl font-extrabold mt-3">{p.alias}</h2>
          <p className="text-sm text-white/85">
            Bed {p.bedId} · {p.ward}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="rounded-full bg-white text-xs font-bold px-3 py-1" style={{ color: g.color }}>
              {g.label}
            </span>
            <span className="text-xs text-white/85">Readiness {p.score}/100</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Details */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            {[
              ['Doctor', p.doctorName || '—'],
              ['Acuity', `Level ${p.acuity}`],
              ['Admitted', dateTime(p.admittedAt)],
              ['Going home', p.expectedDischarge ? `${clock(p.expectedDischarge)} (${timeUntil(p.expectedDischarge)})` : '—'],
              ['Predicted stay', p.los ? `${Math.round(p.los.predictedHours)} hours` : '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-ink-500">{k}</dt>
                <dd className="font-semibold text-ink-900 mt-0.5">{v}</dd>
              </div>
            ))}
            <div>
              <dt className="text-ink-500">Prediction confidence</dt>
              <dd className="mt-0.5">
                <PredictionConfidenceBadge confidence={p.los?.confidence} />
              </dd>
            </div>
          </dl>

          {/* Checklist */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">Before going home</h3>
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.label} className="flex items-center gap-3">
                  <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center shrink-0', i.done ? 'bg-[#1FA971] text-white' : 'border-2 border-cream-200 text-transparent')}>
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                  <span className={clsx('text-sm', i.done ? 'text-ink-500' : 'text-ink-900 font-medium')}>{i.label}</span>
                  <span className="sr-only">{i.done ? 'done' : 'not done'}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Timeline */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">Recent activity</h3>
            {audit.loading ? (
              <FlowSkeleton lines={2} />
            ) : events.length === 0 ? (
              <p className="text-xs text-ink-500">No discharge activity yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3 text-xs">
                    <span className="w-2 h-2 rounded-full bg-royal-500 mt-1.5 shrink-0" aria-hidden="true" />
                    <span>
                      <span className="font-semibold text-ink-900 capitalize">{e.eventType.replace(/_/g, ' ').toLowerCase()}</span>
                      <span className="block text-ink-500">
                        {dateTime(e.createdAt)} · {e.user}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-cream-200 flex gap-2">
          <button type="button" className="flow-btn-primary flex-1 !py-2.5" onClick={() => onNotify(p)} disabled={busy === p.patientId}>
            <Bell className="w-4 h-4" aria-hidden="true" /> Remind doctor
          </button>
          {(p.pendingTasks.length > 0 || !p.ready) && groupOf(p) !== 'notyet' && (
            <button type="button" className="flow-btn-secondary flex-1 !py-2.5" onClick={() => onMarkReady(p)} disabled={busy === p.patientId}>
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Mark ready
            </button>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}

/* ── Book next patient ─────────────────────────────────────────────────── */

function BookModal({ bed, onClose, onDone }) {
  const waiting = useFlowPolling(() => flowApi.getWaitingPatients(), { intervalMs: 0 });
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  if (!bed) return null;
  const save = async () => {
    setBusy(true);
    try {
      await flowApi.preAssignBed(bed.bedId, choice);
      toast.success(`Next patient booked into ${bed.bedId}`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorText(e, 'Could not book the bed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <FlowModal
      open
      onClose={onClose}
      size="sm"
      title={`Who gets ${bed.bedId} next?`}
      subtitle={`Free at about ${clock(bed.expectedFreeAt)} (${timeUntil(bed.expectedFreeAt)})`}
      footer={
        <>
          <button type="button" className="flow-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="flow-btn-primary" disabled={!choice || busy} onClick={save}>
            {busy ? 'Saving…' : 'Book bed'}
          </button>
        </>
      }
    >
      {waiting.loading ? (
        <FlowSkeleton lines={3} />
      ) : (waiting.data || []).length === 0 ? (
        <FlowEmpty title="No one is waiting" message="There is nobody in the queue for this bed." />
      ) : (
        <div className="space-y-2">
          {waiting.data.map((w) => (
            <label key={w.id} className={clsx('flex items-center gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer transition-colors', choice === w.id ? 'border-royal-500 bg-royal-100' : 'border-cream-200 hover:border-royal-500/40')}>
              <input type="radio" name="book" value={w.id} checked={choice === w.id} onChange={() => setChoice(w.id)} className="accent-[#014BAA]" />
              <span className="text-sm font-bold text-royal-900">{w.alias}</span>
              <StatusPill status={w.acuity <= 2 ? 'critical' : 'admitted'} label={`Acuity ${w.acuity}`} size="xs" />
              <span className="text-xs text-ink-500 ml-auto">waiting {w.waiting_minutes ?? '?'} min</span>
            </label>
          ))}
        </div>
      )}
    </FlowModal>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function DischargePlannerPage() {
  const [tab, setTab] = useState('ready');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const [book, setBook] = useState(null);
  const [busy, setBusy] = useState(null);

  const cands = useFlowPolling(() => flowApi.getDischargeCandidates(), { intervalMs: 120000, refreshOn: ['flow.dischargeNudge', 'patient.updated', 'bed.updated'] });
  const freeing = useFlowPolling(() => flowApi.getBedsAboutToFree(4), { intervalMs: 120000, refreshOn: ['bed.updated'] });
  const summary = useFlowPolling(() => flowApi.getStateSummary(), { intervalMs: 60000, refreshOn: ['bed.updated'] });

  const all = cands.data?.candidates || [];
  const counts = useMemo(() => ({ ready: all.filter((p) => groupOf(p) === 'ready').length, almost: all.filter((p) => groupOf(p) === 'almost').length, notyet: all.filter((p) => groupOf(p) === 'notyet').length, all: all.length }), [all]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((p) => (tab === 'all' || groupOf(p) === tab) && (!q || [p.alias, p.bedId, p.ward, p.doctorName].some((v) => (v || '').toLowerCase().includes(q))));
  }, [all, tab, search]);

  // First load: open on "All" when nobody is ready yet, instead of an empty tab
  const [tabChosen, setTabChosen] = useState(false);
  useEffect(() => {
    if (!tabChosen && cands.data) {
      setTabChosen(true);
      if (counts.ready === 0) setTab('all');
    }
  }, [cands.data, counts.ready, tabChosen]);

  const open = all.find((p) => p.patientId === openId) || null;
  const dirty = summary.data?.dirtyBeds ?? 0;
  const expectedToday = all.filter((p) => p.expectedDischarge && new Date(p.expectedDischarge).toDateString() === new Date().toDateString()).length;
  const readyIds = all.filter((p) => p.ready).map((p) => p.patientId);

  const notify = async (ids, key) => {
    setBusy(key);
    try {
      const r = await flowApi.nudgeDischarges(ids);
      toast.success(`${r.nudged} reminder${r.nudged === 1 ? '' : 's'} sent to doctors`);
    } catch (e) {
      toast.error(errorText(e, 'Could not send reminder'));
    } finally {
      setBusy(null);
    }
  };

  const markReady = async (p) => {
    setBusy(p.patientId);
    try {
      await flowApi.markDischargeReady(p.patientId);
      toast.success(`${p.alias} is ready to go home`);
      cands.refresh({ silent: true });
      freeing.refresh({ silent: true });
    } catch (e) {
      toast.error(errorText(e, 'Could not update'));
    } finally {
      setBusy(null);
    }
  };

  const csv = () =>
    exportCsv(
      'discharge_planner',
      [
        { key: 'alias', label: 'Patient' },
        { key: 'bedId', label: 'Bed' },
        { key: 'ward', label: 'Ward' },
        { key: 'doctorName', label: 'Doctor' },
        { key: 'score', label: 'Readiness' },
        { key: 'group', label: 'Status', csv: (r) => GROUPS[groupOf(r)].label },
        { key: 'left', label: "What's left", csv: (r) => r.blockingFactors.join('; ') },
        { key: 'expectedDischarge', label: 'Going home' },
      ],
      rows
    );

  const TABS = [
    ['ready', 'Ready'],
    ['almost', 'Almost ready'],
    ['notyet', 'Not yet'],
    ['all', 'All'],
  ];

  return (
    <div className="flow-page">
      <FlowPageHeader
        title="Discharge Planner"
        subtitle="Who can go home, what's left, and which beds free up next"
        crumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Flow Intelligence' }, { label: 'Discharge Planner' }]}
        actions={
          <>
            <button type="button" className="flow-btn-primary" onClick={() => notify(readyIds, 'all')} disabled={!readyIds.length || busy === 'all'}>
              <Bell className="w-3.5 h-3.5" aria-hidden="true" /> {busy === 'all' ? 'Sending…' : 'Remind all doctors'}
            </button>
            <AiReportButton scope="admin" label="Explain with AI" variant="secondary" />
          </>
        }
      />

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6" aria-label="Summary">
        <Stat icon={Home} label="Ready to go home" value={counts.ready} hint={`of ${counts.all} patients in beds`} color="#1FA971" />
        <Stat icon={CalendarClock} label="Going home today" value={expectedToday} hint="planned discharges" color="#014BAA" />
        <Stat icon={BedDouble} label="Beds that would free" value={counts.ready + dirty} hint="ready patients + cleaning" color="#2BA8E0" />
        <Stat icon={Sparkles} label="Beds being cleaned" value={dirty} hint="waiting for housekeeping" color="#F2A93B" />
      </section>

      {/* List */}
      <section className="flow-card overflow-hidden" aria-label="Patients">
        <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3 border-b border-cream-200">
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Patient groups">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={clsx('inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap', tab === k ? 'bg-royal-500 text-white shadow-sm' : 'text-ink-500 hover:bg-royal-100 hover:text-royal-500')}
              >
                {k !== 'all' && <span className={clsx('w-2 h-2 rounded-full', GROUPS[k].dot)} aria-hidden="true" />}
                {label}
                <span className={clsx('rounded-full px-1.5 text-[10px] tabular-nums', tab === k ? 'bg-white/25' : 'bg-cream-200 text-ink-900')}>{counts[k]}</span>
              </button>
            ))}
          </div>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <label htmlFor="dp-search" className="sr-only">
              Search patients
            </label>
            <input id="dp-search" className="flow-input !pl-9 !rounded-full" placeholder="Search patient, bed or doctor" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" className="flow-btn-ghost" onClick={csv} title="Export CSV">
            <Download className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">Export</span>
          </button>
        </div>

        {cands.error && !all.length && (
          <div className="p-5">
            <FlowError message={cands.error} onRetry={cands.refresh} />
          </div>
        )}

        {cands.loading && !all.length ? (
          <div className="p-5">
            <FlowSkeleton lines={6} height="h-14" />
          </div>
        ) : rows.length === 0 ? (
          <FlowEmpty icon={Home} title={tab === 'ready' ? 'Nobody is ready yet' : 'No patients here'} message={search ? 'Try a different search.' : 'Patients appear here automatically as they get closer to discharge.'} />
        ) : (
          <ul className="divide-y divide-cream-200">
            {rows.map((p) => {
              const g = GROUPS[groupOf(p)];
              const left = whatsLeft(p);
              const active = openId === p.patientId;
              return (
                <li key={p.patientId}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenId(p.patientId)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpenId(p.patientId))}
                    className={clsx('group flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors focus:outline-none focus-visible:bg-royal-100', active ? 'bg-[#FFE9A8]/70' : 'hover:bg-cream-100')}
                    aria-label={`${p.alias}, ${g.label}, readiness ${p.score}`}
                  >
                    <span className="relative w-11 h-11 rounded-2xl bg-royal-100 text-royal-700 text-xs font-extrabold flex items-center justify-center shrink-0">
                      {initialsOf(p.alias)}
                      <span className={clsx('absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-cream-50', g.dot)} aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink-900">{p.alias}</span>
                        <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-bold', g.pill)}>{g.label}</span>
                      </div>
                      <div className="text-xs text-ink-500 mt-0.5 truncate">
                        Bed <span className="font-mono text-ink-900">{p.bedId}</span> · {p.ward}
                      </div>
                      <div className={clsx('text-xs mt-1 truncate', left.tone)}>{left.text}</div>
                    </div>

                    <div className="hidden md:flex items-center gap-1.5 text-xs text-ink-500 w-44 min-w-0">
                      <Stethoscope className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{p.doctorName || 'No doctor'}</span>
                    </div>

                    <div className="hidden lg:flex flex-col items-end w-28 text-right">
                      <span className="text-[10px] uppercase tracking-wide text-ink-500">Going home</span>
                      <span className="text-sm font-semibold text-ink-900 inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-ink-500" aria-hidden="true" /> {timeUntil(p.expectedDischarge)}
                      </span>
                    </div>

                    <ScoreBadge score={p.score} />

                    <div className="hidden sm:block w-28 text-right" onClick={(e) => e.stopPropagation()}>
                      {groupOf(p) === 'ready' ? (
                        <button type="button" className="flow-btn-primary !py-1.5" onClick={() => notify([p.patientId], p.patientId)} disabled={busy === p.patientId}>
                          <Bell className="w-3.5 h-3.5" aria-hidden="true" /> Remind
                        </button>
                      ) : (
                        <button type="button" className="flow-btn-secondary !py-1.5" onClick={() => setOpenId(p.patientId)}>
                          Details
                        </button>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-ink-500 group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Beds freeing soon */}
      <section className="mt-6" aria-label="Beds freeing in the next 4 hours">
        <div className="flex items-end justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-royal-900">Beds freeing in the next 4 hours</h3>
            <p className="text-xs text-ink-500">Book the next patient now so no bed sits empty.</p>
          </div>
        </div>
        {freeing.loading && !freeing.data ? (
          <FlowSkeleton lines={1} height="h-20" />
        ) : (freeing.data || []).length === 0 ? (
          <div className="flow-card">
            <FlowEmpty icon={BedDouble} title="No beds freeing soon" message="No bed is expected to free up in the next 4 hours." />
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
            {freeing.data.map((b) => (
              <div key={b.bedId} className="flow-card px-4 py-3 min-w-[200px] shrink-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-extrabold text-royal-900">{b.bedId}</span>
                  <span className="text-xs font-semibold text-ink-900 tabular-nums">{clock(b.expectedFreeAt)}</span>
                </div>
                <div className="text-[11px] text-ink-500 truncate">{b.ward}</div>
                <div className="text-[11px] text-ink-500">free {timeUntil(b.expectedFreeAt)}</div>
                <div className="mt-2.5">
                  {b.preAssignedTo ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#13784F]">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Next: {b.preAssignedTo}
                    </span>
                  ) : (
                    <button type="button" className="flow-btn-secondary !py-1 w-full" onClick={() => setBook(b)}>
                      <UserPlus className="w-3.5 h-3.5" aria-hidden="true" /> Book next patient
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <PatientPanel p={open} onClose={() => setOpenId(null)} onNotify={(p) => notify([p.patientId], p.patientId)} onMarkReady={markReady} busy={busy} />
      {book && <BookModal bed={book} onClose={() => setBook(null)} onDone={() => freeing.refresh({ silent: true })} />}
    </div>
  );
}
