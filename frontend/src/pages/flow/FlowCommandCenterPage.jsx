/**
 * @file FlowCommandCenterPage.jsx
 * /admin/flow/command-center: one screen to understand the hospital and act.
 *
 *  1. Status hero: one-word hospital status, plain-English explanation, occupancy ring, key numbers,
 *     and each department's fullness now → in 2 hours (prediction strip, numbers only).
 *  2. "What to do now": prioritised actions with their reason and expected result, next to the live feed.
 *  3. Workspace tabs: Live bed map (dark schematic) · Patient flow & forecast · Discharges · Before vs after.
 *
 * Data: /flow/state-summary (30 s + flow.analysisComplete), /flow/bottlenecks, /flow/bed-map, last simulation.
 * Dark mode toggle applies to this page only.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  Moon,
  Sun,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Sliders,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  HeartPulse,
  Sparkles,
  Home,
  Ambulance,
  Map as MapIcon,
  GitBranch,
  ClipboardCheck,
  Scale,
  FlaskConical,
  ChevronDown,
  Info,
} from 'lucide-react';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import AmbulanceIncomingAlert from '../../components/domain/AmbulanceIncomingAlert.jsx';
import BedMapSchematic from '../../components/domain/BedMapSchematic.jsx';
import FlowForecastPanel from '../../components/domain/FlowForecastPanel.jsx';
import FlowActionFeed from '../../components/domain/FlowActionFeed.jsx';
import DischargeReadinessPanel from '../../components/domain/DischargeReadinessPanel.jsx';
import WaitTimeImpactBadge from '../../components/domain/WaitTimeImpactBadge.jsx';
import AiReportButton from '../../components/domain/AiReportButton.jsx';
import DemoControls from '../../components/domain/DemoControls.jsx';
import PatientJourney, { STATUS, SHORT_NAME } from '../../components/domain/PatientJourney.jsx';
import { FlowError, FlowEmpty } from '../../components/domain/FlowUi.jsx';
import flowApi from '../../api/flowApi.js';
import { useLiveStore } from '../../store/liveStore.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { dateTime } from '../../utils/flowFormat.js';

const DARK_KEY = 'mediorchestra_cc_dark';
const TAB_KEY = 'mediorchestra_cc_tab';

function readLocal(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/* ── Hospital status in one word ───────────────────────────────────────── */

function overallStatus(summary) {
  if (!summary) return null;
  const high = summary.departments.filter((d) => d.severity === 'HIGH');
  const shortage = summary.shortage2h?.shortage;
  if (!summary.rootCause) {
    return { level: 'stable', word: 'Stable', icon: CheckCircle2, ring: '#1FA971', chip: 'bg-[#1FA971] text-white' };
  }
  if (shortage || high.length >= 3) {
    return { level: 'critical', word: 'Under heavy pressure', icon: ShieldAlert, ring: '#D64545', chip: 'bg-[#D64545] text-white' };
  }
  return { level: 'busy', word: 'Busy', icon: AlertTriangle, ring: '#F2A93B', chip: 'bg-[#F2A93B] text-[#3D2600]' };
}

function explain(summary) {
  if (!summary) return '';
  const root = summary.departments.find((d) => d.rootCause);
  const parts = [];
  if (root) {
    parts.push(`Patients are getting held up in the ${root.department === 'OT' ? 'Operating Theatres' : root.department} (${root.utilizationPct}% full).`);
    if (summary.cascade?.length) parts.push(`This is spilling over to ${summary.cascade.map((c) => (c === 'OT' ? 'the Operating Theatres' : c)).join(' and ')}.`);
  } else {
    parts.push('Every department has room and patients are moving normally.');
  }
  if (summary.shortage2h?.shortage) parts.push(`${summary.shortage2h.department} is expected to run out of beds within 2 hours.`);
  parts.push(`${summary.dirtyBeds} bed${summary.dirtyBeds === 1 ? ' is' : 's are'} waiting for cleaning and ${summary.dischargeReady} patient${summary.dischargeReady === 1 ? ' is' : 's are'} ready to go home.`);
  return parts.join(' ');
}

/* ── Occupancy ring (SVG, no chart library) ─────────────────────────────── */

function OccupancyRing({ value, color, label }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="relative w-36 h-36 shrink-0" role="img" aria-label={`${label}: ${Math.round(v)} percent`}>
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="12" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset 600ms ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold tabular-nums">{Math.round(v)}%</span>
        <span className="text-[10px] uppercase tracking-wider text-white/75">{label}</span>
      </div>
    </div>
  );
}

function HeroStat({ icon: Icon, label, value, sub, tone = 'default' }) {
  return (
    <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/75">
        <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {label}
      </div>
      <div className={clsx('text-2xl font-extrabold tabular-nums leading-tight', tone === 'danger' ? 'text-[#FFB4B4]' : tone === 'warn' ? 'text-[#FFD99A]' : 'text-white')}>{value}</div>
      {sub && <div className="text-[10px] text-white/70 truncate">{sub}</div>}
    </div>
  );
}

function StatusHero({ summary, edArrivals }) {
  if (!summary) return <div className="rounded-3xl h-64 bg-royal-500/20 animate-pulse" aria-busy="true" />;
  const st = overallStatus(summary);
  const Icon = st.icon;
  return (
    <section className="rounded-3xl bg-gradient-to-br from-royal-900 via-royal-700 to-royal-500 text-white p-5 md:p-6 shadow-soft" aria-label="Hospital status">
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Headline */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">Hospital status right now</p>
          <div className="flex items-center gap-3 mt-1">
            <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold', st.chip)}>
              <Icon className="w-4 h-4" aria-hidden="true" /> {st.word}
            </span>
          </div>
          <p className="text-sm md:text-base text-white/90 leading-relaxed mt-3 max-w-2xl">{explain(summary)}</p>
          <p className="text-[11px] text-white/60 mt-3">
            Limits: busy above {Math.round(summary.thresholds.warn * 100)}% · overloaded above {Math.round(summary.thresholds.danger * 100)}%
          </p>
        </div>

        {/* Ring + numbers */}
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <OccupancyRing value={summary.occupancy.pct} color={st.ring} label="beds in use" />
          <div className="grid grid-cols-2 gap-2 w-full sm:w-[340px]">
            <HeroStat icon={HeartPulse} label="Intensive care" value={`${Math.round(summary.icu.pct)}%`} sub={`${summary.icu.occupied} of ${summary.icu.total} beds`} tone={summary.icu.pct > 90 ? 'danger' : summary.icu.pct >= 70 ? 'warn' : 'default'} />
            <HeroStat icon={Ambulance} label="Arrivals next 6h" value={edArrivals != null ? Math.round(edArrivals) : '—'} sub="expected at Emergency" />
            <HeroStat icon={Sparkles} label="Waiting for cleaning" value={summary.dirtyBeds} sub="beds" tone={summary.dirtyBeds > 2 ? 'warn' : 'default'} />
            <HeroStat icon={Home} label="Ready to go home" value={summary.dischargeReady} sub="patients" />
          </div>
        </div>
      </div>

      {/* Department strip: now → in 2h */}
      <div className="mt-5 pt-4 border-t border-white/15">
        <p className="text-[11px] uppercase tracking-wider text-white/70 font-semibold mb-2">How full each area is: now → in 2 hours</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {summary.departments.map((d) => {
            const s = STATUS[d.severity] || STATUS.LOW;
            const Trend = d.predicted2hPct > d.utilizationPct ? ArrowUpRight : d.predicted2hPct < d.utilizationPct ? ArrowDownRight : ArrowRight;
            return (
              <div key={d.department} className={clsx('rounded-xl bg-cream-50 px-3 py-2 text-ink-900 border-l-4', d.rootCause && 'ring-2 ring-[#FFB4B4]')} style={{ borderLeftColor: s.color }}>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-royal-900 truncate">{SHORT_NAME[d.department] || d.department}</span>
                  {d.rootCause && <span className="text-[8px] font-extrabold text-white bg-[#D64545] rounded px-1 py-0.5">START</span>}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={clsx('text-xl font-extrabold tabular-nums', s.text)}>{d.utilizationPct}%</span>
                  <span className="text-[11px] text-ink-500 inline-flex items-center tabular-nums">
                    <Trend className="w-3 h-3" aria-hidden="true" />
                    {d.predicted2hPct}%
                  </span>
                </div>
                <div className={clsx('text-[10px] font-semibold', s.text)}>{s.word}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── What to do now ─────────────────────────────────────────────────────── */

function ActionPlan({ bottlenecks, onApplied }) {
  const actions = useMemo(() => {
    const root = bottlenecks.find((b) => b.rootCause);
    const ordered = root ? [root, ...bottlenecks.filter((b) => b !== root)] : bottlenecks;
    return ordered.flatMap((b) => (b.recommendedActions || []).map((a) => ({ ...a, fromRoot: b.rootCause }))).slice(0, 6);
  }, [bottlenecks]);
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState({});

  const run = async (list, key) => {
    setBusy(key);
    try {
      const r = await flowApi.createRecommendationBatch(list, { autoApprove: true, source: 'command_center' });
      setDone((d) => ({ ...d, ...Object.fromEntries(list.map((a) => [a.id, true])) }));
      toast.success(`${r.created} action${r.created === 1 ? '' : 's'} started · ${r.notificationsSent} people notified${r.nudges ? ` · ${r.nudges} discharge reminders` : ''}`);
      onApplied?.();
    } catch (e) {
      toast.error(errorText(e, 'Could not start the action'));
    } finally {
      setBusy(null);
    }
  };

  const pending = actions.filter((a) => !done[a.id]);

  return (
    <section className="flow-card-pad h-full flex flex-col" aria-label="What to do now">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base font-extrabold text-royal-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-royal-500" aria-hidden="true" /> What to do now
          </h2>
          <p className="text-xs text-ink-500">Most helpful first. Each action says why it is suggested and what it should achieve.</p>
        </div>
        {pending.length > 1 && (
          <button type="button" className="flow-btn-primary" onClick={() => run(pending, 'all')} disabled={!!busy}>
            <Zap className="w-3.5 h-3.5" aria-hidden="true" /> {busy === 'all' ? 'Starting…' : `Do all ${pending.length}`}
          </button>
        )}
      </div>

      {actions.length === 0 ? (
        <FlowEmpty icon={CheckCircle2} title="Nothing needs doing" message="Every department is within its limits. New suggestions appear here automatically." />
      ) : (
        <ol className="space-y-2 flex-1">
          {actions.map((a, i) => (
            <li key={a.id} className={clsx('rounded-xl border p-3 flex gap-3 transition-colors', done[a.id] ? 'border-[#1FA971]/40 bg-[#1FA971]/5' : 'border-cream-200 bg-cream-50')}>
              <span className={clsx('w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0', done[a.id] ? 'bg-[#1FA971] text-white' : i === 0 ? 'bg-[#D64545] text-white' : 'bg-royal-500 text-white')}>
                {done[a.id] ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink-900">{a.text}</p>
                  {i === 0 && !done[a.id] && <span className="text-[9px] font-extrabold text-white bg-[#D64545] rounded px-1.5 py-0.5">TOP PRIORITY</span>}
                </div>
                {a.why && (
                  <p className="text-xs text-ink-500 mt-0.5 flex gap-1">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-px text-royal-500" aria-hidden="true" /> Because {a.why.charAt(0).toLowerCase() + a.why.slice(1)}
                  </p>
                )}
                <p className="text-xs font-semibold text-[#13784F] mt-1">Expected result: {a.impact}</p>
              </div>
              <div className="shrink-0 self-center">
                {done[a.id] ? (
                  <span className="text-[11px] font-bold text-[#13784F]">Started</span>
                ) : (
                  <button type="button" className="flow-btn-secondary" onClick={() => run([a], a.id)} disabled={!!busy}>
                    {busy === a.id ? '…' : 'Do this'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ── Workspace tabs ─────────────────────────────────────────────────────── */

const TABS = [
  { key: 'map', label: 'Live bed map', icon: MapIcon },
  { key: 'flow', label: 'Patient flow & forecast', icon: GitBranch },
  { key: 'discharge', label: 'Discharges', icon: ClipboardCheck },
  { key: 'impact', label: 'Before vs after', icon: Scale },
];

function BeforeAfter({ lastSim }) {
  if (!lastSim) {
    return (
      <div className="flow-card-pad">
        <FlowEmpty icon={FlaskConical} title="No simulation yet" message="Run a what-if scenario to compare doing nothing with full orchestration." action={<Link to="/admin/flow/simulator" className="flow-btn-primary mt-3">Open the simulator</Link>} />
      </div>
    );
  }
  const rows = [
    ['A', 'Do nothing', lastSim.scenarioA, '#D64545'],
    ['B', 'Partial action', lastSim.scenarioB, '#F2A93B'],
    ['C', 'Full orchestration', lastSim.scenarioC, '#1FA971'],
  ];
  const max = Math.max(...rows.map((r) => r[2]?.avgWaitMin || 0), 1);
  return (
    <div className="flow-card-pad">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-extrabold text-royal-900">What our plan changes</h3>
          <p className="text-xs text-ink-500">
            Last scenario: +{lastSim.params.arrivalIncreasePct}% patients · {lastSim.params.nursesAbsent} nurses absent · {lastSim.params.icuBedsClosed} ICU beds closed · {dateTime(lastSim.createdAt)}
          </p>
        </div>
        <WaitTimeImpactBadge before={lastSim.scenarioA.avgWaitMin} after={lastSim.scenarioC.avgWaitMin} size="lg" />
      </div>
      <div className="space-y-3">
        {rows.map(([id, label, s, color]) => (
          <div key={id} className="grid grid-cols-[150px_1fr] sm:grid-cols-[190px_1fr_auto] items-center gap-3">
            <span className="text-xs font-semibold text-ink-900">
              {id} · {label}
            </span>
            <div className="h-6 rounded-lg bg-cream-200 overflow-hidden" role="img" aria-label={`${label}: average wait ${s?.avgWaitMin} minutes`}>
              <div className="h-full rounded-lg flex items-center justify-end pr-2 text-[11px] font-bold text-white" style={{ width: `${Math.max(8, ((s?.avgWaitMin || 0) / max) * 100)}%`, backgroundColor: color }}>
                {s?.avgWaitMin} min
              </div>
            </div>
            <span className="hidden sm:block text-[11px] text-ink-500 tabular-nums">
              {s?.bedShortage} beds short · {s?.nurseShortage} nurses short
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-5">
        <Link to="/admin/flow/simulator" className="flow-btn-secondary">
          <Sliders className="w-3.5 h-3.5" aria-hidden="true" /> Run a new simulation
        </Link>
        <AiReportButton scope="admin" label="Explain the plan (AI)" variant="secondary" />
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function FlowCommandCenterPage() {
  const [dark, setDark] = useState(() => readLocal(DARK_KEY, '0') === '1');
  const [tab, setTab] = useState(() => readLocal(TAB_KEY, 'map'));
  const [showDemo, setShowDemo] = useState(false);
  const setFlowState = useLiveStore((s) => s.setFlowState);
  const bedMap = useLiveStore((s) => s.flowState.bedMap);
  const liveSummary = useLiveStore((s) => s.flowState.stateSummary);

  const summaryQ = useFlowPolling(() => flowApi.getStateSummary(), { intervalMs: 30000, refreshOn: ['flow.analysisComplete', 'bed.updated', 'flow.ambulanceIncoming'] });
  const bottleneckQ = useFlowPolling(() => flowApi.getBottlenecks(), { intervalMs: 30000, refreshOn: ['flow.bottleneckDetected', 'flow.analysisComplete', 'bed.updated'] });
  const bedMapQ = useFlowPolling(() => flowApi.getBedMap(), { intervalMs: 60000, refreshOn: ['ot.caseCompleted', 'patient.updated'] });
  const forecastQ = useFlowPolling(() => flowApi.getForecast('Emergency', 6), { intervalMs: 120000, refreshOn: ['flow.analysisComplete'], toastOnError: false });
  const simQ = useFlowPolling(() => flowApi.getSimulationHistory(1), { intervalMs: 0, toastOnError: false });

  useEffect(() => {
    if (summaryQ.data) setFlowState({ stateSummary: summaryQ.data, lastAnalysisAt: summaryQ.data.lastAnalysisAt });
  }, [summaryQ.data, setFlowState]);
  useEffect(() => {
    if (bottleneckQ.data) setFlowState({ bottlenecks: bottleneckQ.data.bottlenecks });
  }, [bottleneckQ.data, setFlowState]);
  useEffect(() => {
    if (bedMapQ.data) setFlowState({ bedMap: bedMapQ.data });
  }, [bedMapQ.data, setFlowState]);

  const summary = liveSummary && summaryQ.data && new Date(liveSummary.generatedAt) > new Date(summaryQ.data.generatedAt) ? liveSummary : summaryQ.data;
  const edArrivals = forecastQ.data ? forecastQ.data.predicted.reduce((a, b) => a + b, 0) : null;
  const bottlenecks = bottleneckQ.data?.bottlenecks || [];
  const lastSim = simQ.data && simQ.data[0];

  const refreshAll = () => {
    summaryQ.refresh({ silent: true });
    bottleneckQ.refresh({ silent: true });
    bedMapQ.refresh({ silent: true });
  };
  const toggleDark = () =>
    setDark((d) => {
      writeLocal(DARK_KEY, d ? '0' : '1');
      return !d;
    });
  const pickTab = (k) => {
    setTab(k);
    writeLocal(TAB_KEY, k);
  };

  return (
    <div className={clsx('flow-page', dark && 'flow-dark')}>
      <FlowPageHeader
        title="Flow Command Center"
        subtitle="See what is happening, what will happen next, and what to do about it"
        crumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Flow Intelligence' }, { label: 'Command Center' }]}
        dark={dark}
        actions={
          <>
            <button type="button" className="flow-btn-secondary" onClick={() => setShowDemo((v) => !v)} aria-expanded={showDemo}>
              <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" /> Demo tools <ChevronDown className={clsx('w-3 h-3 transition-transform', showDemo && 'rotate-180')} aria-hidden="true" />
            </button>
            <button type="button" onClick={toggleDark} className="flow-btn-secondary !p-2" aria-pressed={dark} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <AiReportButton scope="admin" label="Explain with AI" />
          </>
        }
      />

      {showDemo && (
        <div className="mb-4">
          <DemoControls onChanged={refreshAll} />
        </div>
      )}

      <AmbulanceIncomingAlert />
      {summaryQ.error && !summary && <FlowError message={summaryQ.error} onRetry={summaryQ.refresh} />}

      <div className="space-y-5">
        <StatusHero summary={summary} edArrivals={edArrivals} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2">
            <ActionPlan bottlenecks={bottlenecks} onApplied={refreshAll} />
          </div>
          <FlowActionFeed maxHeight="max-h-[440px]" />
        </div>

        {/* Workspace */}
        <section aria-label="Workspace">
          <div className="flex gap-1 overflow-x-auto scrollbar-thin border-b border-cream-200 mb-4" role="tablist" aria-label="Command Center views">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`cc-tab-${t.key}`}
                  aria-selected={active}
                  aria-controls={`cc-panel-${t.key}`}
                  onClick={() => pickTab(t.key)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-500 rounded-t-lg',
                    active ? 'border-royal-500 text-royal-500 bg-cream-50' : 'border-transparent text-ink-500 hover:text-royal-500'
                  )}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" /> {t.label}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" id={`cc-panel-${tab}`} aria-labelledby={`cc-tab-${tab}`}>
            {tab === 'map' && <BedMapSchematic data={bedMap || bedMapQ.data} loading={bedMapQ.loading} onChanged={refreshAll} />}

            {tab === 'flow' && (
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
                <div className="xl:col-span-3 space-y-3">
                  <PatientJourney list={bottlenecks} />
                  <Link to="/admin/flow/bottlenecks" className="flow-btn-secondary">
                    <GitBranch className="w-3.5 h-3.5" aria-hidden="true" /> Open the full Bottleneck Map
                  </Link>
                </div>
                <div className="xl:col-span-2">
                  <FlowForecastPanel />
                </div>
              </div>
            )}

            {tab === 'discharge' && <DischargeReadinessPanel />}

            {tab === 'impact' && <BeforeAfter lastSim={lastSim} />}
          </div>
        </section>
      </div>
    </div>
  );
}
