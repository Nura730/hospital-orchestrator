/**
 * @file FlowCommandCenterPage.jsx
 * /admin/flow/command-center: numbers-first command center.
 * Top strip (beds, bottlenecks, discharges ready, dirty beds, next surge), then three columns:
 * Flow Status (bottleneck chain + one action), Next 6 Hours (compact forecast chart + 3 chips) and
 * Live Updates, with a 5-row discharge readiness table below.
 */

import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Line } from 'react-chartjs-2';
import {
  BedDouble,
  AlertOctagon,
  LogOut,
  Sparkles,
  Ambulance,
  ArrowDown,
  ArrowUp,
  TriangleAlert,
  Zap,
  FlaskConical,
  ChevronDown,
  Send,
} from 'lucide-react';
import '../../components/charts/setupChart.js';
import AmbulanceIncomingAlert from '../../components/domain/AmbulanceIncomingAlert.jsx';
import AiReportButton from '../../components/domain/AiReportButton.jsx';
import DemoControls from '../../components/domain/DemoControls.jsx';
import PatientDetailPopup from '../../components/domain/PatientDetailPopup.jsx';
import { FlowError, FlowSkeleton } from '../../components/domain/FlowUi.jsx';
import { MiniEmpty } from '../../components/domain/CareUi.jsx';
import flowApi from '../../api/flowApi.js';
import { useLiveStore } from '../../store/liveStore.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { clock, timeAgo, readinessBand, BAND_STYLES } from '../../utils/flowFormat.js';

const SEV = {
  LOW: ['#10B981', 'OK'],
  MEDIUM: ['#F59E0B', 'Warning'],
  HIGH: ['#EF4444', 'Critical'],
};
const REFRESH_ON = ['flow.analysisComplete', 'bed.updated', 'patient.updated', 'ot.caseCompleted'];

function StripItem({ icon: Icon, value, label, tone }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 min-w-0">
      <Icon className={clsx('w-4 h-4 shrink-0', tone || 'text-ink-500')} aria-hidden="true" />
      <span className="text-sm font-bold tabular-nums text-ink-900">{value}</span>
      <span className="text-[11px] text-ink-500 truncate">{label}</span>
    </div>
  );
}

function FlowStatus({ summary, onApplied }) {
  const [busy, setBusy] = useState(false);
  const depts = summary.departments || [];
  const action = summary.topAction;
  const apply = async () => {
    setBusy(true);
    try {
      await flowApi.createRecommendationBatch([action], { autoApprove: true, source: 'command_center' });
      toast.success('Action sent to the team');
      onApplied();
    } catch (e) {
      toast.error(errorText(e, 'Could not apply the action'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flow-card p-4 flex flex-col">
      <h2 className="label-xs mb-3">Flow Status</h2>
      <ol className="space-y-0.5 mb-3">
        {depts.map((d, i) => {
          const [color] = SEV[d.severity] || SEV.LOW;
          return (
            <li key={d.department}>
              <div className="flex items-center gap-3 rounded-lg border border-cream-200 border-l-4 px-3 h-11" style={{ borderLeftColor: color }}>
                <span className="text-xs font-semibold text-ink-900 flex-1 truncate">{d.department}</span>
                {d.rootCause && <span className="rounded bg-[#DC2626] px-1.5 py-0.5 text-[9px] font-bold text-white">ROOT CAUSE</span>}
                <span className="text-sm font-bold tabular-nums text-ink-900">{d.utilizationPct}%</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} role="img" aria-label={SEV[d.severity]?.[1]} />
              </div>
              {i < depts.length - 1 && <ArrowDown className="w-3 h-3 text-ink-500/50 mx-auto" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      <div className="mt-auto pt-3 border-t border-cream-200 flex items-center gap-2">
        <p className="text-xs text-ink-900 flex-1 min-w-0">
          <span className="text-ink-500">Action: </span>
          {action ? action.text : 'No action needed'}
        </p>
        {action && (
          <button type="button" className="flow-btn-primary !py-1.5 shrink-0" onClick={apply} disabled={busy}>
            <Zap className="w-3.5 h-3.5" aria-hidden="true" /> Take Action
          </button>
        )}
      </div>
    </section>
  );
}

function Forecast({ forecast, demand, capacity }) {
  const data = useMemo(() => {
    if (!forecast) return null;
    const labels = forecast.timestamps.map((t) => clock(t));
    const demandByH = Object.fromEntries((demand || []).map((d) => [d.horizon, d.demand]));
    return {
      labels,
      datasets: [
        { label: 'Arrivals', data: forecast.predicted, borderColor: '#014BAA', backgroundColor: 'rgba(1,75,170,0.12)', fill: true, tension: 0.35, pointRadius: 2, yAxisID: 'y1' },
        { label: 'Bed demand', data: labels.map((_, i) => demandByH[i + 1] ?? null), borderColor: '#F59E0B', spanGaps: true, tension: 0.3, pointRadius: 3, yAxisID: 'y' },
        { label: 'Capacity', data: labels.map(() => capacity), borderColor: '#EF4444', borderDash: [5, 4], pointRadius: 0, yAxisID: 'y' },
      ],
    };
  }, [forecast, demand, capacity]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'end', labels: { color: '#94A3B8', usePointStyle: true, boxWidth: 6, boxHeight: 6, font: { size: 10 } } },
        tooltip: { backgroundColor: '#222536', titleColor: '#F1F5F9', bodyColor: '#CBD5E1' },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 10 } } },
        y: { grid: { color: 'rgba(148,163,184,0.15)' }, ticks: { color: '#94A3B8', font: { size: 10 } }, title: { display: false } },
        y1: { position: 'right', grid: { display: false }, ticks: { color: '#014BAA', font: { size: 10 } }, beginAtZero: true },
      },
    }),
    []
  );

  const arrivals = forecast ? Math.round(forecast.predicted.reduce((a, b) => a + b, 0)) : null;
  const last = demand?.[demand.length - 1];
  const gap = last ? Math.round(last.gap) : null;

  return (
    <section className="flow-card p-4 flex flex-col">
      <h2 className="label-xs mb-2">Next 6 Hours · Emergency</h2>
      <div className="flex-1 min-h-[200px] relative">{data ? <Line data={data} options={options} aria-label={`Emergency forecast for the next 6 hours: about ${arrivals ?? 0} arrivals, bed demand against capacity ${capacity ?? ''}`} /> : <FlowSkeleton lines={5} />}</div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <span className="flex items-center justify-center gap-1 rounded-lg bg-[#014BAA]/10 px-2 py-2 text-[11px] whitespace-nowrap font-semibold text-fg-info">
          <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" /> +{arrivals ?? '—'} arrivals
        </span>
        <span className="flex items-center justify-center gap-1 rounded-lg bg-[#10B981]/10 px-2 py-2 text-[11px] whitespace-nowrap font-semibold text-fg-ok">
          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" /> -{last ? Math.round(last.expectedDischarges) : '—'} discharges
        </span>
        <span className={clsx('flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] whitespace-nowrap font-semibold', gap > 0 ? 'bg-[#EF4444]/10 text-fg-bad' : 'bg-[#10B981]/10 text-fg-ok')}>
          <TriangleAlert className="w-3.5 h-3.5" aria-hidden="true" /> Gap: {gap == null ? '—' : `${gap > 0 ? '+' : ''}${gap} beds`}
        </span>
      </div>
    </section>
  );
}

function dotFor(text, type) {
  const t = text.toLowerCase();
  if (type === 'alert' || /critical|urgent|ambulance|\d{2,3}%|deteriorat/.test(t)) return '#EF4444';
  if (/clean|ready|available|completed|done/.test(t)) return '#10B981';
  if (/discharge|cleaning|waiting|delay/.test(t)) return '#F59E0B';
  return '#014BAA';
}

function LiveFeed({ summary }) {
  const notes = useFlowPolling(() => flowApi.getNotifications(), { intervalMs: 30000, refreshOn: ['notification.new', 'flow.analysisComplete'], toastOnError: false });
  const feed = useLiveStore((s) => s.flowState.feed);
  const items = useMemo(() => {
    const rows = [];
    const list = Array.isArray(notes.data) ? notes.data : notes.data?.notifications || [];
    for (const n of list) rows.push({ id: n.id, text: n.title || n.message, at: n.createdAt || n.created_at, type: n.type });
    for (const f of feed || []) rows.push({ id: f.id, text: f.title || f.text || f.message, at: f.at || f.ts || f.createdAt, type: f.kind });
    for (const d of summary?.departments || []) if (d.severity === 'HIGH') rows.push({ id: `dept-${d.department}`, text: `${d.department} at ${d.utilizationPct}%`, at: summary.lastAnalysisAt, type: 'alert' });
    return rows.filter((r) => r.text).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 20);
  }, [notes.data, feed, summary]);

  return (
    <section className="flow-card p-4 flex flex-col">
      <h2 className="label-xs mb-2">Live Updates</h2>
      {!items.length && <MiniEmpty text="No updates yet" />}
      <ul className="flex-1 min-h-[220px] lg:min-h-0 lg:h-0 overflow-y-auto -mr-2 pr-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-start gap-2.5 py-1.5">
            <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: dotFor(it.text, it.type) }} aria-hidden="true" />
            <span className="text-xs text-ink-900 flex-1 min-w-0 truncate" title={it.text}>
              {it.text}
            </span>
            <span className="text-[10px] text-ink-500 whitespace-nowrap">{timeAgo(it.at)}</span>
          </li>
        ))}
      </ul>
      <Link to="/admin/flow/audit" className="text-[11px] font-semibold text-royal-500 hover:underline mt-2">
        View all
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
      toast.success(`Nudge sent for ${c.alias}`);
      onChanged();
    } catch (e) {
      toast.error(errorText(e, 'Could not send nudge'));
    } finally {
      setBusy(null);
    }
  };
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="label-xs">Discharge Readiness</h2>
        <Link to="/admin/flow/discharge-planner" className="text-[11px] font-semibold text-royal-500 hover:underline">
          View all
        </Link>
      </div>
      <div className="table-wrap">
        <table className="mo-table">
          <thead>
            <tr>
              <th scope="col">Patient</th>
              <th scope="col">Ward</th>
              <th scope="col">Score</th>
              <th scope="col">Blocking</th>
              <th scope="col" className="text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && (
              <tr>
                <td colSpan={5} className="text-center text-ink-500 py-6">
                  No discharge candidates
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.patientId} className="cursor-pointer" onClick={() => onOpen(c.patientId)}>
                <td className="font-semibold">
                  {c.alias} <span className="font-normal text-ink-500">· {c.bedId}</span>
                </td>
                <td className="max-w-[180px] truncate">{c.ward}</td>
                <td className={clsx('font-bold tabular-nums', BAND_STYLES[readinessBand(c.score)].text)}>{c.score}</td>
                <td className="max-w-[260px] truncate text-ink-500">{c.blockingFactors?.[0] || 'None'}</td>
                <td className="text-right" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="flow-btn-secondary !py-1" disabled={busy === c.patientId} onClick={() => nudge(c)}>
                    <Send className="w-3.5 h-3.5" aria-hidden="true" /> Nudge
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function FlowCommandCenterPage() {
  const [showDemo, setShowDemo] = useState(false);
  const [popup, setPopup] = useState(null);
  const setFlowState = useLiveStore((s) => s.setFlowState);
  const summaryQ = useFlowPolling(() => flowApi.getStateSummary(), { intervalMs: 30000, refreshOn: REFRESH_ON });
  const forecastQ = useFlowPolling(() => Promise.all([flowApi.getForecast('Emergency', 6), flowApi.getBedDemand('Emergency')]), { intervalMs: 60000, refreshOn: ['flow.analysisComplete'] });
  const dischargeQ = useFlowPolling(() => flowApi.getDischargeCandidates(), { intervalMs: 60000, refreshOn: REFRESH_ON });
  const summary = summaryQ.data;

  useEffect(() => {
    if (summary) setFlowState({ stateSummary: summary, lastAnalysisAt: summary.lastAnalysisAt });
  }, [summary, setFlowState]);

  const refreshAll = () => {
    summaryQ.refresh({ silent: true });
    forecastQ.refresh({ silent: true });
    dischargeQ.refresh({ silent: true });
  };

  const [forecast, demand] = forecastQ.data || [];
  const ed = summary?.departments?.find((d) => d.department === 'Emergency');
  const surge = useMemo(() => {
    if (!forecast) return '—';
    const i = forecast.predicted.indexOf(Math.max(...forecast.predicted));
    return `+${i + 1}h`;
  }, [forecast]);
  const bottlenecks = (summary?.departments || []).filter((d) => d.severity !== 'LOW').length;

  return (
    <div className="space-y-4">
      <FlowPageHeader
        title="Command Center"
        actions={
          <>
            <button type="button" className="flow-btn-secondary" onClick={() => setShowDemo((v) => !v)} aria-expanded={showDemo}>
              <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" /> Demo <ChevronDown className={clsx('w-3 h-3 transition-transform', showDemo && 'rotate-180')} aria-hidden="true" />
            </button>
            <AiReportButton scope="admin" label="AI Report" />
          </>
        }
      />
      {showDemo && <DemoControls onChanged={refreshAll} compact />}
      <AmbulanceIncomingAlert />
      {summaryQ.error && !summary && <FlowError message={summaryQ.error} onRetry={summaryQ.refresh} />}

      {/* Top strip */}
      <div className="rounded-xl border border-cream-200 bg-sunken grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-cream-200">
        <StripItem icon={BedDouble} value={summary ? `${summary.occupancy.occupied}/${summary.occupancy.capacity}` : '—'} label="beds" />
        <StripItem icon={AlertOctagon} value={summary ? bottlenecks : '—'} label="bottlenecks" tone={bottlenecks ? 'text-[#EF4444]' : 'text-[#10B981]'} />
        <StripItem icon={LogOut} value={summary?.dischargeReady ?? '—'} label="discharges ready" tone="text-[#10B981]" />
        <StripItem icon={Sparkles} value={summary?.dirtyBeds ?? '—'} label="dirty beds" tone={summary?.dirtyBeds > 2 ? 'text-[#F59E0B]' : undefined} />
        <StripItem icon={Ambulance} value={surge} label="next surge" tone="text-[#014BAA]" />
      </div>

      {/* Three columns */}
      {!summary ? (
        <FlowSkeleton lines={10} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <FlowStatus summary={summary} onApplied={refreshAll} />
          <Forecast forecast={forecast} demand={demand} capacity={ed?.capacity} />
          <LiveFeed summary={summary} />
        </div>
      )}

      <DischargeTable data={dischargeQ.data} onOpen={setPopup} onChanged={refreshAll} />

      {popup && <PatientDetailPopup patientId={popup} onClose={() => setPopup(null)} onChanged={refreshAll} />}
    </div>
  );
}
