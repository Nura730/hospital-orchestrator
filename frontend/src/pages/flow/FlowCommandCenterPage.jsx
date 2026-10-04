/**
 * @file FlowCommandCenterPage.jsx
 * /admin/flow/command-center: classic operations-room layout.
 *  1. Title bar with live clock.
 *  2. KPI band (six key numbers).
 *  3. Department status board (table) + action queue.
 *  4. Arrivals vs capacity forecast + live activity log.
 *  5. Discharge readiness.
 * Everything refreshes live as other tabs and roles act.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Line } from 'react-chartjs-2';
import {
  BedDouble,
  HeartPulse,
  Ambulance,
  LogOut,
  Sparkles,
  Inbox,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  FlaskConical,
  ChevronDown,
  Send,
  AlertTriangle,
  Scissors,
  MessageSquare,
  Info,
  CheckCircle2,
  Siren,
} from 'lucide-react';
import '../../components/charts/setupChart.js';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import AmbulanceIncomingAlert from '../../components/domain/AmbulanceIncomingAlert.jsx';
import AiReportButton from '../../components/domain/AiReportButton.jsx';
import DemoControls from '../../components/domain/DemoControls.jsx';
import PatientDetailPopup from '../../components/domain/PatientDetailPopup.jsx';
import { FlowError, FlowSkeleton } from '../../components/domain/FlowUi.jsx';
import { MiniEmpty } from '../../components/domain/CareUi.jsx';
import flowApi from '../../api/flowApi.js';
import careApi from '../../api/careApi.js';
import { useLiveStore } from '../../store/liveStore.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { clock, readinessBand, BAND_STYLES } from '../../utils/flowFormat.js';
import { runwayHours, formatRunway, runwayTone } from '../../utils/runway.js';

const SEV = {
  LOW: { label: 'Normal', color: '#047857', bar: '#10B981' },
  MEDIUM: { label: 'Warning', color: '#92400E', bar: '#F59E0B' },
  HIGH: { label: 'Critical', color: '#B91C1C', bar: '#EF4444' },
};
const FEED_KIND = { alert: [AlertTriangle, '#B91C1C'], ot_assigned: [Scissors, '#6D28D9'], request: [MessageSquare, '#014BAA'] };

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right leading-tight" aria-live="off">
      <div className="text-2xl font-bold tabular-nums text-royal-900">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</div>
      <div className="text-xs text-ink-500">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone = 'default', to }) {
  const color = { default: '#014BAA', ok: '#047857', warn: '#B45309', bad: '#B91C1C', violet: '#6D28D9' }[tone];
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</span>
        <Icon className="w-5 h-5" style={{ color }} aria-hidden="true" />
      </div>
      <div className="text-3xl font-bold tabular-nums mt-2" style={{ color }}>
        {value}
      </div>
      <div className="text-sm text-ink-500 mt-1">{sub}</div>
    </>
  );
  const cls = 'flow-card p-4 border-t-4 block';
  return to ? (
    <Link to={to} className={clsx(cls, 'hover:border-royal-500/40 transition-colors')} style={{ borderTopColor: color }}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={{ borderTopColor: color }}>
      {body}
    </div>
  );
}

const RUNWAY_COLOR = { bad: '#B91C1C', warn: '#B45309', ok: 'rgb(var(--ink-500))' };

function MassCasualtySwitch({ onChanged }) {
  const q = useFlowPolling(() => flowApi.getMci(), { intervalMs: 30000, toastOnError: false });
  const [busy, setBusy] = useState(false);
  if (!q.data || q.data.unsupported) return null;
  const active = Boolean(q.data.active);
  const toggle = async () => {
    const msg = active
      ? 'Stand down mass casualty mode and return to normal operations?'
      : 'Activate mass casualty mode? Elective surgery moves to tomorrow, ready patients are flagged for discharge and all staff are alerted.';
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await flowApi.setMci(!active);
      toast.success(active ? 'Mass casualty mode stood down' : 'Mass casualty mode active. All staff alerted.');
      q.refresh({ silent: true });
      onChanged();
    } catch (e) {
      toast.error(errorText(e, 'Could not change mass casualty mode'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={active}
      className={clsx('inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors', active ? 'bg-white text-[#B91C1C] border-2 border-[#B91C1C]' : 'bg-[#B91C1C] text-white hover:bg-[#991B1B]')}
    >
      <Siren className="w-4 h-4" aria-hidden="true" /> {active ? 'Stand down' : 'Mass casualty'}
    </button>
  );
}

function StatusBoard({ departments, bottlenecks = [] }) {
  const runwayOf = Object.fromEntries(bottlenecks.map((b) => [b.department, runwayHours(b)]));
  return (
    <section className="flow-card overflow-hidden h-full" aria-label="Department status board">
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-cream-200">
        <h2 className="text-base font-bold text-ink-900">Department status</h2>
        <Link to="/admin/flow/bottlenecks" className="text-sm font-semibold text-royal-500 hover:underline">
          Open bottleneck map
        </Link>
      </header>
      <table className="mo-table">
        <thead>
          <tr>
            <th scope="col">Department</th>
            <th scope="col" className="w-[34%]">
              Occupancy
            </th>
            <th scope="col" className="text-right">
              Beds
            </th>
            <th scope="col" className="text-right">
              In 2 hours
            </th>
            <th scope="col">Capacity runway</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {departments.map((d) => {
            const s = SEV[d.severity] || SEV.LOW;
            const delta = d.predicted2hPct - d.utilizationPct;
            const Trend = delta > 2 ? TrendingUp : delta < -2 ? TrendingDown : Minus;
            return (
              <tr key={d.department}>
                <td className="!text-sm font-semibold">
                  {d.department}
                  {d.rootCause && <span className="ml-2 rounded bg-[#DC2626] px-1.5 py-0.5 text-xs font-bold text-white align-middle">ROOT CAUSE</span>}
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 rounded-full bg-sunken overflow-hidden" role="progressbar" aria-valuenow={d.utilizationPct} aria-valuemin={0} aria-valuemax={100} aria-label={`${d.department} occupancy`}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, d.utilizationPct)}%`, backgroundColor: s.bar }} />
                    </div>
                    <span className="w-12 text-right text-sm font-bold tabular-nums text-ink-900">{d.utilizationPct}%</span>
                  </div>
                </td>
                <td className="!text-sm text-right tabular-nums">
                  {d.occupied}/{d.capacity}
                </td>
                <td className="!text-sm text-right tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Trend className="w-4 h-4 text-ink-500" aria-hidden="true" /> {d.predicted2hPct}%
                  </span>
                </td>
                <td className="!text-sm font-semibold whitespace-nowrap" style={{ color: RUNWAY_COLOR[runwayTone(runwayOf[d.department])] }}>
                  {d.department in runwayOf ? formatRunway(runwayOf[d.department]) : '—'}
                </td>
                <td>
                  <span className="inline-flex rounded-md px-2 py-1 text-xs font-bold" style={{ color: s.color, backgroundColor: `${s.bar}1F` }}>
                    {s.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function ActionQueue({ actions, onApplied }) {
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState({});
  const apply = async (a) => {
    setBusy(a.id);
    try {
      await flowApi.createRecommendationBatch([a], { autoApprove: true, source: 'command_center' });
      setDone((d) => ({ ...d, [a.id]: true }));
      toast.success('Sent to the team');
      onApplied();
    } catch (e) {
      toast.error(errorText(e, 'Could not apply the action'));
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="flow-card flex flex-col h-full" aria-label="Action queue">
      <header className="px-5 py-3.5 border-b border-cream-200">
        <h2 className="text-base font-bold text-ink-900">Action queue</h2>
      </header>
      {!actions.length && <MiniEmpty text="No action needed. Every department is within limits." icon={CheckCircle2} />}
      <ol className="flex-1">
        {actions.map((a, i) => (
          <li key={a.id} className="flex items-start gap-3 px-5 py-3.5 border-b border-cream-200 last:border-0">
            <span className="w-7 h-7 rounded-full bg-royal-500/10 text-royal-500 text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-900">{a.text}</p>
              <p className="text-xs text-fg-ok mt-0.5">{a.impact}</p>
            </div>
            <button type="button" className={clsx('shrink-0 !py-1.5', done[a.id] ? 'flow-btn-ghost' : 'flow-btn-primary')} disabled={busy === a.id || done[a.id]} onClick={() => apply(a)}>
              {done[a.id] ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <Zap className="w-4 h-4" aria-hidden="true" />} {done[a.id] ? 'Sent' : 'Act'}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ForecastChart({ forecast, demand, capacity }) {
  const data = useMemo(() => {
    if (!forecast) return null;
    const labels = forecast.timestamps.map((t) => clock(t));
    const demandByH = Object.fromEntries((demand || []).map((d) => [d.horizon, d.demand]));
    return {
      labels,
      datasets: [
        { label: 'Expected arrivals', data: forecast.predicted, borderColor: '#014BAA', backgroundColor: 'rgba(1,75,170,0.10)', fill: true, tension: 0.35, pointRadius: 3, yAxisID: 'y1' },
        { label: 'Bed demand', data: labels.map((_, i) => demandByH[i + 1] ?? null), borderColor: '#F59E0B', spanGaps: true, tension: 0.3, pointRadius: 4, yAxisID: 'y' },
        { label: 'Capacity', data: labels.map(() => capacity), borderColor: '#DC2626', borderDash: [6, 4], pointRadius: 0, yAxisID: 'y' },
      ],
    };
  }, [forecast, demand, capacity]);
  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'start', labels: { color: '#5B6B80', usePointStyle: true, boxWidth: 8, font: { size: 12 } } },
        tooltip: { backgroundColor: '#012A63', titleColor: '#FFFFFF', bodyColor: '#E3ECF8' },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#5B6B80', font: { size: 12 } } },
        y: { grid: { color: 'rgba(91,107,128,0.15)' }, ticks: { color: '#5B6B80', font: { size: 12 } }, title: { display: true, text: 'Beds', color: '#5B6B80' } },
        y1: { position: 'right', grid: { display: false }, ticks: { color: '#014BAA', font: { size: 12 } }, beginAtZero: true, title: { display: true, text: 'Arrivals / hour', color: '#014BAA' } },
      },
    }),
    []
  );
  const arrivals = forecast ? Math.round(forecast.predicted.reduce((a, b) => a + b, 0)) : null;
  const last = demand?.[demand.length - 1];
  const gap = last ? Math.round(last.gap) : null;
  return (
    <section className="flow-card flex flex-col h-full" aria-label="Emergency forecast">
      <header className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-cream-200">
        <h2 className="text-base font-bold text-ink-900">Emergency: next 6 hours</h2>
        <div className="flex gap-5 text-sm">
          <span className="text-ink-500">
            Arrivals <b className="text-ink-900 tabular-nums">{arrivals ?? '—'}</b>
          </span>
          <span className="text-ink-500">
            Discharges <b className="text-ink-900 tabular-nums">{last ? Math.round(last.expectedDischarges) : '—'}</b>
          </span>
          <span className="text-ink-500">
            Bed gap <b className={clsx('tabular-nums', gap > 0 ? 'text-fg-bad' : 'text-fg-ok')}>{gap == null ? '—' : gap > 0 ? `${gap} short` : `${Math.abs(gap)} spare`}</b>
          </span>
        </div>
      </header>
      <div className="h-[280px] p-4">{data ? <Line data={data} options={options} aria-label={`Emergency forecast: about ${arrivals ?? 0} arrivals in the next 6 hours`} /> : <FlowSkeleton lines={6} />}</div>
    </section>
  );
}

function ActivityLog() {
  const q = useFlowPolling(() => careApi.getNotifications('admin'), { intervalMs: 30000, toastOnError: false });
  const items = (q.data || []).slice(0, 30);
  return (
    <section className="flow-card flex flex-col h-full" aria-label="Live activity">
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-cream-200">
        <h2 className="text-base font-bold text-ink-900">Live activity</h2>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-ok">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" aria-hidden="true" /> Live
        </span>
      </header>
      {!items.length && <MiniEmpty text="No activity yet" />}
      <ol className="flex-1 overflow-y-auto max-h-[300px]">
        {items.map((n) => {
          const [Icon, color] = FEED_KIND[n.type] || [Info, '#475569'];
          return (
            <li key={n.id} className="flex items-start gap-3 px-5 py-2.5 border-b border-cream-200 last:border-0">
              <span className="text-xs font-semibold tabular-nums text-ink-500 w-11 shrink-0 pt-0.5">{clock(n.createdAt)}</span>
              <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm text-ink-900">{n.title}</p>
                {n.message && <p className="text-xs text-ink-500 truncate">{n.message}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      <Link to="/admin/flow/audit" className="px-5 py-3 text-sm font-semibold text-royal-500 hover:underline border-t border-cream-200">
        Full audit log
      </Link>
    </section>
  );
}

function DischargeTable({ data, onOpen, onChanged }) {
  const [busy, setBusy] = useState(null);
  const rows = (data?.candidates || []).slice(0, 5);
  const nudge = async (c) => {
    setBusy(c.patientId);
    try {
      await flowApi.nudgeDischarges([c.patientId]);
      toast.success(`Reminder sent for ${c.alias}`);
      onChanged();
    } catch (e) {
      toast.error(errorText(e, 'Could not send the reminder'));
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="flow-card overflow-hidden" aria-label="Discharge readiness">
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-cream-200">
        <h2 className="text-base font-bold text-ink-900">Ready to go home</h2>
        <Link to="/admin/flow/discharge-planner" className="text-sm font-semibold text-royal-500 hover:underline">
          Discharge planner
        </Link>
      </header>
      <table className="mo-table">
        <thead>
          <tr>
            <th scope="col">Patient</th>
            <th scope="col">Ward</th>
            <th scope="col" className="text-right">
              Readiness
            </th>
            <th scope="col">What is left</th>
            <th scope="col" className="text-right">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {!rows.length && (
            <tr>
              <td colSpan={5} className="text-center !text-sm text-ink-500 py-8">
                No discharge candidates right now
              </td>
            </tr>
          )}
          {rows.map((c) => (
            <tr key={c.patientId} className="cursor-pointer" onClick={() => onOpen(c.patientId)}>
              <td className="!text-sm font-semibold">
                {c.alias} <span className="font-normal text-ink-500">{c.bedId}</span>
              </td>
              <td className="!text-sm max-w-[200px] truncate">{c.ward}</td>
              <td className={clsx('!text-sm font-bold tabular-nums text-right', BAND_STYLES[readinessBand(c.score)].text)}>{c.score}</td>
              <td className="!text-sm max-w-[280px] truncate text-ink-500">{c.blockingFactors?.[0] || 'Nothing'}</td>
              <td className="text-right" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="flow-btn-secondary !py-1.5" disabled={busy === c.patientId} onClick={() => nudge(c)}>
                  <Send className="w-4 h-4" aria-hidden="true" /> Remind
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function FlowCommandCenterPage() {
  const [showDemo, setShowDemo] = useState(false);
  const [popup, setPopup] = useState(null);
  const setFlowState = useLiveStore((s) => s.setFlowState);
  const summaryQ = useFlowPolling(() => flowApi.getStateSummary(), { intervalMs: 30000, refreshOn: ['flow.analysisComplete'] });
  const bnQ = useFlowPolling(() => flowApi.getBottlenecks(), { intervalMs: 30000, refreshOn: ['flow.analysisComplete'], toastOnError: false });
  const forecastQ = useFlowPolling(() => Promise.all([flowApi.getForecast('Emergency', 6), flowApi.getBedDemand('Emergency')]), { intervalMs: 60000, refreshOn: ['flow.analysisComplete'] });
  const dischargeQ = useFlowPolling(() => flowApi.getDischargeCandidates(), { intervalMs: 60000 });
  const badgeQ = useFlowPolling(() => careApi.getBadgeCounts('admin'), { intervalMs: 60000, toastOnError: false });
  const summary = summaryQ.data;

  useEffect(() => {
    if (summary) setFlowState({ stateSummary: summary, lastAnalysisAt: summary.lastAnalysisAt });
  }, [summary, setFlowState]);

  const refreshAll = () => {
    summaryQ.refresh({ silent: true });
    bnQ.refresh({ silent: true });
    forecastQ.refresh({ silent: true });
    dischargeQ.refresh({ silent: true });
  };

  const actions = useMemo(() => {
    const list = [...(bnQ.data?.bottlenecks || [])].sort((a, b) => Number(b.rootCause) - Number(a.rootCause) || Number(b.isCascade) - Number(a.isCascade));
    const seen = new Set();
    return list.flatMap((d) => d.recommendedActions || []).filter((a) => !seen.has(a.text) && seen.add(a.text)).slice(0, 5);
  }, [bnQ.data]);

  const [forecast, demand] = forecastQ.data || [];
  const ed = summary?.departments?.find((d) => d.department === 'Emergency');
  const arrivals6h = forecast ? Math.round(forecast.predicted.reduce((a, b) => a + b, 0)) : null;

  return (
    <div className="space-y-5">
      <FlowPageHeader
        title="Command Center"
        subtitle="Hospital operations at a glance"
        actions={
          <>
            <button type="button" className="flow-btn-secondary" onClick={() => setShowDemo((v) => !v)} aria-expanded={showDemo}>
              <FlaskConical className="w-4 h-4" aria-hidden="true" /> Demo <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', showDemo && 'rotate-180')} aria-hidden="true" />
            </button>
            <MassCasualtySwitch onChanged={refreshAll} />
            <AiReportButton scope="admin" label="AI Report" />
            <span className="hidden md:block w-px h-10 bg-cream-200 mx-1" aria-hidden="true" />
            <LiveClock />
          </>
        }
      />
      {showDemo && <DemoControls onChanged={refreshAll} compact />}
      <AmbulanceIncomingAlert />
      {summaryQ.error && !summary && <FlowError message={summaryQ.error} onRetry={summaryQ.refresh} />}

      {!summary ? (
        <FlowSkeleton lines={12} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi icon={BedDouble} label="Bed occupancy" value={`${Math.round(summary.occupancy.pct)}%`} sub={`${summary.occupancy.occupied} of ${summary.occupancy.capacity} beds`} tone={summary.occupancy.pct > 90 ? 'bad' : summary.occupancy.pct >= 75 ? 'warn' : 'ok'} to="/admin/beds-overview" />
            <Kpi icon={HeartPulse} label="ICU" value={`${Math.round(summary.icu.pct)}%`} sub={`${summary.icu.occupied} of ${summary.icu.total} beds`} tone={summary.icu.pct > 90 ? 'bad' : summary.icu.pct >= 75 ? 'warn' : 'ok'} />
            <Kpi icon={Ambulance} label="Arrivals 6h" value={arrivals6h ?? '—'} sub="expected at Emergency" />
            <Kpi icon={LogOut} label="Discharge ready" value={summary.dischargeReady} sub="patients" tone="ok" to="/admin/flow/discharge-planner" />
            <Kpi icon={Sparkles} label="Beds to clean" value={summary.dirtyBeds} sub="waiting for housekeeping" tone={summary.dirtyBeds > 2 ? 'warn' : 'default'} to="/admin/flow/housekeeping" />
            <Kpi icon={Inbox} label="Open requests" value={badgeQ.data?.requests ?? '—'} sub="patients, staff and theatre" tone={(badgeQ.data?.requests || 0) > 0 ? 'violet' : 'default'} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
            <div className="xl:col-span-8">
              <StatusBoard departments={summary.departments || []} bottlenecks={bnQ.data?.bottlenecks || []} />
            </div>
            <div className="xl:col-span-4">
              <ActionQueue actions={actions} onApplied={refreshAll} />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
            <div className="xl:col-span-8">
              <ForecastChart forecast={forecast} demand={demand} capacity={ed?.capacity} />
            </div>
            <div className="xl:col-span-4">
              <ActivityLog />
            </div>
          </div>

          <DischargeTable data={dischargeQ.data} onOpen={setPopup} onChanged={refreshAll} />
        </>
      )}

      {popup && <PatientDetailPopup patientId={popup} onClose={() => setPopup(null)} onChanged={refreshAll} />}
    </div>
  );
}
