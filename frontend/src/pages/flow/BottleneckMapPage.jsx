/**
 * @file BottleneckMapPage.jsx
 * /admin/flow/bottlenecks: written so anyone can read it.
 *  1. Plain-English summary: where patient flow is stuck, why, and what to do first.
 *  2. Patient journey strip (Emergency → Radiology → Ward → HDU → ICU → OT) in traffic-light colors;
 *     arrow thickness = how full the step is, red arrow = the next step is overloaded.
 *  3. One card per department: beds in use, free beds, what happens in the next hours, why it is
 *     flagged, and one-click actions (each with its reason). Trend chart behind "View chart".
 * Repaints live on flow.bottleneckDetected / flow.analysisComplete.
 */

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  BarChart3,
  Info,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  BedDouble,
  Sparkles,
  Home,
  Users,
  HelpCircle,
  Zap,
  Filter,
} from 'lucide-react';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import ChartPopup from '../../components/domain/ChartPopup.jsx';
import AiReportButton from '../../components/domain/AiReportButton.jsx';
import { FlowSkeleton, FlowError, FlowEmpty } from '../../components/domain/FlowUi.jsx';
import PatientJourney, { STATUS, FRIENDLY_NAME, pct } from '../../components/domain/PatientJourney.jsx';
import flowApi from '../../api/flowApi.js';
import { useLiveStore } from '../../store/liveStore.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';

/* ── Plain-language helpers (vocabulary shared via PatientJourney) ───────── */

function trendOf(b) {
  const now = pct(b.utilization);
  const later = pct(b.predicted?.[2] ?? b.utilization);
  if (later - now >= 5) return { word: 'Getting busier', icon: TrendingUp, cls: 'text-[#B02E2E]' };
  if (now - later >= 5) return { word: 'Easing off', icon: TrendingDown, cls: 'text-[#13784F]' };
  return { word: 'Staying about the same', icon: Minus, cls: 'text-ink-500' };
}

function whyFlagged(b, thresholds) {
  const warn = pct(thresholds?.warn ?? 0.75);
  const danger = pct(thresholds?.danger ?? 0.88);
  const unit = b.department === 'OT' ? 'theatres' : 'beds';
  if (b.predictedGap > 0) return `Expected to run out of ${unit} within 2 hours (short by about ${Math.ceil(b.predictedGap)}).`;
  if (b.utilization * 100 > danger) return `${pct(b.utilization)}% of ${unit} are in use, above the ${danger}% overload limit.`;
  if (b.utilization * 100 > warn) return `${pct(b.utilization)}% of ${unit} are in use, above the ${warn}% "busy" limit.`;
  return `${pct(b.utilization)}% in use, comfortably below the ${warn}% "busy" limit.`;
}

/* ── 1. Summary ────────────────────────────────────────────────────────── */

function Summary({ list, onApply, applying }) {
  const root = list.find((b) => b.rootCause);
  const affected = list.filter((b) => b.isCascade);
  const actions = (root ? [root, ...list.filter((b) => b !== root)] : list).flatMap((b) => b.recommendedActions || []).slice(0, 3);

  if (!root) {
    return (
      <section className="rounded-2xl border-2 border-[#1FA971]/50 bg-[#1FA971]/5 p-5 flex items-start gap-4" role="status">
        <CheckCircle2 className="w-8 h-8 text-[#1FA971] shrink-0" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-extrabold text-[#13784F]">Patient flow is running smoothly</h2>
          <p className="text-sm text-ink-900 mt-1">No department is busy enough to hold patients up. Nothing needs doing right now.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-cream-50 border-2 border-[#D64545]/40 shadow-soft overflow-hidden" aria-label="Summary">
      <div className="p-5 flex items-start gap-4">
        <span className="w-11 h-11 rounded-xl bg-[#D64545] text-white flex items-center justify-center shrink-0">
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#B02E2E]">Where patients are getting stuck</p>
          <h2 className="text-xl md:text-2xl font-extrabold text-royal-900 leading-tight mt-0.5">
            The problem starts in the {FRIENDLY_NAME[root.department] || root.department}
          </h2>
          <p className="text-sm text-ink-900 mt-2 leading-relaxed">
            {root.occupied} of {root.capacity} {root.department === 'OT' ? 'theatres' : 'beds'} are in use ({pct(root.utilization)}%).{' '}
            When this area fills up, patients cannot move on from the steps before it, and new patients wait longer.
            {affected.length > 0 && (
              <>
                {' '}It is also putting pressure on <b>{affected.map((a) => FRIENDLY_NAME[a.department] || a.department).join(' and ')}</b>.
              </>
            )}
          </p>
        </div>
      </div>

      {actions.length > 0 && (
        <div className="border-t border-cream-200 bg-cream-100 px-5 py-4">
          <p className="text-xs font-bold text-royal-900 mb-2 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-royal-500" aria-hidden="true" /> What to do first
          </p>
          <ol className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            {actions.map((a, i) => (
              <li key={a.id} className="flex flex-col rounded-xl bg-cream-50 border border-cream-200 p-3">
                <div className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-royal-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="text-sm font-semibold text-ink-900 leading-snug">{a.text}</span>
                </div>
                <p className="text-xs text-[#13784F] font-semibold mt-2 ml-8">Result: {a.impact}</p>
                <button type="button" className="flow-btn-primary mt-auto ml-8 self-start !mt-3" onClick={() => onApply(a)} disabled={applying === a.id}>
                  {applying === a.id ? 'Applying…' : 'Do this now'}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/* ── 3. Department card ────────────────────────────────────────────────── */

function NextHours({ b }) {
  const points = [
    ['Now', b.utilization],
    ['+1h', b.predicted?.[1]],
    ['+2h', b.predicted?.[2]],
    ['+4h', b.predicted?.[4]],
  ];
  return (
    <div className="flex items-end gap-2 h-16" role="img" aria-label={`Expected fullness: ${points.map(([l, v]) => `${l} ${pct(v)}%`).join(', ')}`}>
      {points.map(([label, v]) => {
        const p = Math.min(130, pct(v));
        const color = p > 90 ? '#D64545' : p >= 70 ? '#F2A93B' : '#1FA971';
        return (
          <div key={label} className="flex-1 flex flex-col items-center justify-end h-full">
            <span className="text-[10px] font-bold tabular-nums text-ink-900">{v == null ? '—' : `${pct(v)}%`}</span>
            <div className="w-full rounded-t-md mt-0.5" style={{ height: `${Math.max(6, (p / 130) * 40)}px`, backgroundColor: color, opacity: label === 'Now' ? 1 : 0.75 }} />
            <span className="text-[10px] text-ink-500 mt-0.5">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function DeptCard({ b, thresholds, onApply, applying, trendSeries }) {
  const [chart, setChart] = useState(false);
  const s = STATUS[b.severity] || STATUS.LOW;
  const trend = trendOf(b);
  const TrendIcon = trend.icon;
  const isOt = b.department === 'OT';
  const unit = isOt ? 'theatres' : 'beds';
  const series = trendSeries[b.department === 'ICU' ? 'icu' : isOt ? 'otUtil' : 'occupancy'];
  const fill = Math.min(100, pct(b.utilization));

  return (
    <article className={clsx('flow-card p-4 flex flex-col border-t-4', b.rootCause && 'ring-2 ring-[#D64545]/40')} style={{ borderTopColor: s.color }} aria-label={`${b.department}: ${s.word}`}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-extrabold text-royal-900">{FRIENDLY_NAME[b.department] || b.department}</h3>
          {b.rootCause && <p className="text-[11px] font-bold text-[#B02E2E]">Problem starts here</p>}
          {b.isCascade && <p className="text-[11px] font-bold text-[#C2600A]">Affected by the problem upstream</p>}
        </div>
        <span className={clsx('rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap', s.soft, s.text)}>{s.word}</span>
      </header>

      {/* Fullness now */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-900">
            <b className="text-2xl font-extrabold tabular-nums">{b.occupied}</b> of {b.capacity} {unit} in use
          </span>
          <span className={clsx('text-sm font-extrabold tabular-nums', s.text)}>{fill}%</span>
        </div>
        <div className="h-3 rounded-full bg-cream-200 overflow-hidden mt-1.5" role="progressbar" aria-valuenow={fill} aria-valuemin={0} aria-valuemax={100} aria-label={`${b.department} fullness`}>
          <div className="h-full rounded-full transition-all" style={{ width: `${fill}%`, backgroundColor: s.color }} />
        </div>
      </div>

      {/* Quick facts */}
      <ul className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
        <li className="flex items-center gap-1.5 text-ink-900">
          <BedDouble className="w-3.5 h-3.5 text-[#1FA971]" aria-hidden="true" /> <b>{b.available ?? 0}</b> free now
        </li>
        {!isOt && (
          <li className="flex items-center gap-1.5 text-ink-900">
            <Sparkles className="w-3.5 h-3.5 text-[#F2A93B]" aria-hidden="true" /> <b>{b.cleaning ?? 0}</b> being cleaned
          </li>
        )}
        {!isOt && (
          <li className="flex items-center gap-1.5 text-ink-900">
            <Home className="w-3.5 h-3.5 text-royal-500" aria-hidden="true" /> <b>{b.dischargeReady ?? 0}</b> ready to go home
          </li>
        )}
        <li className="flex items-center gap-1.5 text-ink-900">
          <Users className="w-3.5 h-3.5 text-royal-500" aria-hidden="true" /> <b>{b.nursesOnShift ?? 0}</b> nurses on shift
        </li>
      </ul>

      {/* Next hours */}
      <div className="mt-3 rounded-xl bg-cream-100 p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wide">Next few hours</span>
          <span className={clsx('text-[11px] font-semibold inline-flex items-center gap-1', trend.cls)}>
            <TrendIcon className="w-3.5 h-3.5" aria-hidden="true" /> {trend.word}
          </span>
        </div>
        <NextHours b={b} />
      </div>

      {/* Why */}
      <p className="mt-3 text-xs text-ink-900 flex gap-1.5 leading-snug">
        <Info className="w-3.5 h-3.5 text-royal-500 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          <b>Why {b.severity === 'LOW' ? 'it is fine' : 'it is flagged'}:</b> {whyFlagged(b, thresholds)}
        </span>
      </p>

      {/* Actions */}
      <div className="mt-3 flex-1">
        {(b.recommendedActions || []).length === 0 ? (
          <p className="text-[11px] text-[#13784F] font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> No action needed here
          </p>
        ) : (
          <ul className="space-y-2">
            {b.recommendedActions.map((a) => (
              <li key={a.id} className="rounded-xl border border-cream-200 bg-cream-50 p-2.5">
                <p className="text-xs font-semibold text-ink-900">{a.text}</p>
                {a.why && <p className="text-[11px] text-ink-500 mt-0.5">Because {a.why.charAt(0).toLowerCase() + a.why.slice(1)}</p>}
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <span className="text-[11px] font-semibold text-[#13784F]">{a.impact}</span>
                  <button type="button" className="flow-btn-primary !py-1 !px-2.5 !text-[11px]" onClick={() => onApply(a)} disabled={applying === a.id}>
                    {applying === a.id ? '…' : 'Do this'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" className="flow-btn-ghost mt-3 !py-1.5 self-start" onClick={() => setChart(true)} disabled={!series}>
        <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /> View 24-hour chart
      </button>
      {series && (
        <ChartPopup
          open={chart}
          onClose={() => setChart(false)}
          title={`${FRIENDLY_NAME[b.department] || b.department}: last 24 hours`}
          subtitle={b.department === 'ICU' || isOt ? undefined : 'Hospital-wide bed occupancy (department history is not stored separately)'}
          series={{ [b.department]: series }}
          chartType="line"
          unit="%"
        />
      )}
    </article>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function BottleneckMapPage() {
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [applying, setApplying] = useState(null);
  const live = useLiveStore((s) => s.flowState.bottlenecks);
  const setFlowState = useLiveStore((s) => s.setFlowState);
  const q = useFlowPolling(() => flowApi.getBottlenecks(), { intervalMs: 30000, refreshOn: ['flow.analysisComplete', 'bed.updated'] });
  const numbers = useFlowPolling(() => flowApi.getDashboardNumbers('admin'), { intervalMs: 120000 });

  useEffect(() => {
    if (q.data) setFlowState({ bottlenecks: q.data.bottlenecks });
  }, [q.data, setFlowState]);

  const list = (live && live.length ? live : q.data?.bottlenecks) || [];
  const shown = problemsOnly ? list.filter((b) => b.severity !== 'LOW') : list;
  const thresholds = q.data?.thresholds;

  const apply = async (a) => {
    setApplying(a.id);
    try {
      const r = await flowApi.createRecommendationBatch([a], { autoApprove: true, source: 'bottleneck_map' });
      toast.success(`Done: ${a.text}${r.notificationsSent ? ` (${r.notificationsSent} people notified)` : ''}`);
      q.refresh({ silent: true });
    } catch (e) {
      toast.error(errorText(e, 'Could not apply'));
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="flow-page">
      <FlowPageHeader
        title="Bottleneck Map"
        subtitle="Where patients are getting held up, why, and what to do about it"
        crumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Flow Intelligence' }, { label: 'Bottleneck Map' }]}
        actions={
          <>
            <button type="button" className="flow-btn-secondary" onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}>
              <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" /> How to read this
            </button>
            <AiReportButton scope="admin" label="Explain with AI" />
          </>
        }
      />

      {showHelp && (
        <section className="flow-card-pad mb-5 text-xs text-ink-900 leading-relaxed" aria-label="How to read this page">
          <h3 className="text-sm font-bold text-royal-900 mb-2">How to read this page</h3>
          <ul className="space-y-1.5 list-disc pl-5">
            <li>
              Each department shows <b>how full it is</b> (beds or theatres in use) and how full it is <b>expected to be</b> in the next 1, 2 and 4 hours.
            </li>
            <li>
              <b className="text-[#13784F]">Running smoothly</b> = below {pct(thresholds?.warn ?? 0.75)}% full. <b className="text-[#8A5200]">Getting busy</b> = above {pct(thresholds?.warn ?? 0.75)}%.{' '}
              <b className="text-[#B02E2E]">Overloaded</b> = above {pct(thresholds?.danger ?? 0.88)}%, or expected to run out of beds within 2 hours.
            </li>
            <li>
              <b>Problem starts here</b> marks the first busy department along the patient journey. Fixing it first usually helps every department after it (<b>knock-on effect</b>).
            </li>
            <li>Predictions come from the last 4 weeks of arrivals at the same hour and weekday, plus patients expected to be discharged.</li>
            <li>Every suggested action says why it is suggested. "Do this" approves it and notifies the people involved.</li>
          </ul>
        </section>
      )}

      {q.error && !list.length && <FlowError message={q.error} onRetry={q.refresh} />}

      {q.loading && !list.length ? (
        <FlowSkeleton lines={4} height="h-32" />
      ) : (
        <div className="space-y-5">
          <Summary list={list} onApply={apply} applying={applying} />
          <PatientJourney list={list} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-royal-900">Department details</h3>
            <button type="button" className={clsx(problemsOnly ? 'flow-btn-primary' : 'flow-btn-secondary')} onClick={() => setProblemsOnly((v) => !v)} aria-pressed={problemsOnly}>
              <Filter className="w-3.5 h-3.5" aria-hidden="true" /> {problemsOnly ? 'Showing problem areas only' : 'Show problem areas only'}
            </button>
          </div>

          {shown.length === 0 ? (
            <div className="flow-card-pad">
              <FlowEmpty icon={CheckCircle2} title="No problem areas" message="Every department is running smoothly." />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {shown.map((b) => (
                <DeptCard key={b.department} b={b} thresholds={thresholds} onApply={apply} applying={applying} trendSeries={numbers.data?.series || {}} />
              ))}
            </div>
          )}

          {q.data?.analyzedAt && <p className="text-[11px] text-ink-500">Updated automatically. Last analysis {new Date(q.data.analyzedAt).toLocaleTimeString()}.</p>}
        </div>
      )}
    </div>
  );
}
