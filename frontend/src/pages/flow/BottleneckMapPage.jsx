/**
 * @file BottleneckMapPage.jsx
 * /admin/flow/bottlenecks: one-line header, the department cascade chain, a numbered list of recommended
 * actions (Apply All / Apply Selected) and a right-side detail drawer per department. Severity legend at the bottom.
 */

import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { RefreshCw, X, Zap, Users, Stethoscope, Sparkles, LogOut, ArrowRightLeft, BedDouble, ShieldCheck, AlertOctagon } from 'lucide-react';
import BottleneckCascadeMap, { severityOf, SEVERITY_STYLE } from '../../components/domain/BottleneckCascadeMap.jsx';
import ExperimentalOutlook from '../../components/domain/ExperimentalOutlook.jsx';
import { FlowError, FlowSkeleton } from '../../components/domain/FlowUi.jsx';
import { MiniEmpty, ProgressLine } from '../../components/domain/CareUi.jsx';
import flowApi from '../../api/flowApi.js';
import { useLiveStore } from '../../store/liveStore.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { timeAgo } from '../../utils/flowFormat.js';

function pctOf(v) {
  return v == null ? null : Math.round(v * 100);
}

function DetailDrawer({ dept, staff, onClose, onApply, busy }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  const sev = severityOf(dept.utilization);
  const { color, label } = SEVERITY_STYLE[sev];
  const s = staff?.departments?.find((x) => x.department === dept.department);
  const actions = dept.recommendedActions || [];
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#0F1117]/50" onClick={onClose} aria-hidden="true" />
      <aside className="relative w-full max-w-sm h-full bg-cream-50 border-l border-cream-200 flex flex-col animate-slide-in-right" role="dialog" aria-modal="true" aria-label={`${dept.department} details`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream-200">
          <div>
            <h2 className="text-sm font-bold text-ink-900">{dept.department}</h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} /> {label}
              {dept.rootCause && ' · Root cause'}
              {dept.isCascade && ' · Affected'}
            </span>
          </div>
          <button type="button" className="flow-btn-ghost !p-1.5" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <section>
            <h3 className="label-xs mb-1.5">Current</h3>
            <p className="text-2xl font-bold tabular-nums text-ink-900">
              {dept.occupied} <span className="text-sm font-normal text-ink-500">/ {dept.capacity} occupied</span>
            </p>
            <div className="mt-2">
              <ProgressLine value={dept.utilization * 100} color={color} label="Utilization" />
            </div>
          </section>
          <section>
            <h3 className="label-xs mb-1.5">Predicted</h3>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 4].map((h) => {
                const v = pctOf(dept.predicted?.[h]);
                return (
                  <div key={h} className="rounded-lg bg-sunken px-2 py-2 text-center">
                    <p className="text-[11px] text-ink-500">{h}h</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: v == null ? undefined : SEVERITY_STYLE[severityOf(v)].color }}>
                      {v == null ? '—' : `${v}%`}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <h3 className="label-xs mb-1.5">Staff on shift</h3>
            <div className="flex gap-4 text-xs text-ink-900">
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-ink-500" aria-hidden="true" /> {s?.nurses ?? dept.nursesOnShift ?? 0} nurses
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-ink-500" aria-hidden="true" /> {s?.doctors ?? '—'} doctors
              </span>
            </div>
          </section>
          <section>
            <h3 className="label-xs mb-1.5">Actions</h3>
            {!actions.length && <p className="text-xs text-ink-500">No action needed</p>}
            <ol className="space-y-2">
              {actions.map((a, i) => (
                <li key={a.id} className="text-xs text-ink-900">
                  {i + 1}. {a.text} <span className="text-fg-ok">· {a.impact}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="p-3 border-t border-cream-200 flex gap-2 justify-end">
          <button type="button" className="flow-btn-ghost" onClick={onClose}>
            Close
          </button>
          {actions.length > 0 && (
            <button type="button" className="flow-btn-primary" disabled={busy} onClick={() => onApply(actions)}>
              <Zap className="w-3.5 h-3.5" aria-hidden="true" /> Apply {actions.length}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

const ACTION_ICON = { cleaning: Sparkles, discharge: LogOut, transfer: ArrowRightLeft, reserve: BedDouble, staffing: Users };
const HEAT = {
  normal: { bg: 'rgba(16,185,129,0.14)', text: '#046C4E' },
  warning: { bg: 'rgba(245,158,11,0.18)', text: '#92400E' },
  critical: { bg: 'rgba(239,68,68,0.14)', text: '#991B1B' },
};

function Verdict({ depts }) {
  const root = depts.find((d) => d.rootCause);
  const affected = depts.filter((d) => d.isCascade).map((d) => d.department);
  if (!root) {
    return (
      <section className="rounded-2xl border border-[#10B981]/30 bg-[#10B981]/10 px-6 py-5 flex items-center gap-4">
        <ShieldCheck className="w-8 h-8 text-fg-ok shrink-0" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-bold text-ink-900">Patient flow is healthy</h2>
          <p className="text-sm text-ink-500">Every department is below its warning level.</p>
        </div>
      </section>
    );
  }
  const pct = Math.round(root.utilization * 100);
  return (
    <section className="rounded-2xl border border-[#EF4444]/30 bg-gradient-to-r from-[#EF4444]/10 to-transparent px-6 py-5 flex flex-wrap items-center gap-x-8 gap-y-3">
      <div className="flex items-center gap-4 flex-1 min-w-[260px]">
        <span className="w-12 h-12 rounded-2xl bg-[#DC2626] text-white flex items-center justify-center shrink-0">
          <AlertOctagon className="w-6 h-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-fg-bad">Root cause</p>
          <h2 className="text-xl font-bold text-ink-900">{root.department} is holding up patient flow</h2>
          <p className="text-sm text-ink-500 mt-0.5">{affected.length ? `It is slowing ${affected.join(' and ')} downstream.` : 'No other department is affected yet.'}</p>
        </div>
      </div>
      <dl className="flex gap-8">
        <div>
          <dt className="text-xs text-ink-500">Occupancy</dt>
          <dd className="text-2xl font-bold tabular-nums text-fg-bad">{pct}%</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">In 2 hours</dt>
          <dd className="text-2xl font-bold tabular-nums text-ink-900">{Math.round((root.predicted?.[2] ?? root.utilization) * 100)}%</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Free beds</dt>
          <dd className="text-2xl font-bold tabular-nums text-ink-900">{Math.max(0, root.capacity - root.occupied)}</dd>
        </div>
      </dl>
    </section>
  );
}

function Outlook({ depts, onSelect }) {
  const cols = [
    ['Now', (d) => d.utilization],
    ['+1h', (d) => d.predicted?.[1]],
    ['+2h', (d) => d.predicted?.[2]],
    ['+4h', (d) => d.predicted?.[4]],
  ];
  return (
    <section className="flow-card p-5" aria-label="Pressure outlook">
      <h2 className="text-base font-bold text-ink-900">Pressure outlook</h2>
      <p className="text-sm text-ink-500 mb-4">Occupancy now and forecast for the next 4 hours</p>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'minmax(110px, 1.2fr) repeat(4, minmax(0, 1fr))' }}>
        <span />
        {cols.map(([l]) => (
          <span key={l} className="text-xs font-semibold text-ink-500 text-center pb-1">
            {l}
          </span>
        ))}
        {depts.map((d) => (
          <React.Fragment key={d.department}>
            <button type="button" onClick={() => onSelect(d.department)} className="text-sm font-semibold text-ink-900 text-left pr-2 py-2 hover:text-royal-500 truncate">
              {d.department}
            </button>
            {cols.map(([l, get]) => {
              const v = get(d);
              if (v == null) return <span key={l} className="rounded-lg bg-sunken" />;
              const pct = Math.round(v * 100);
              const h = HEAT[severityOf(v)];
              return (
                <span key={l} className="rounded-lg flex items-center justify-center text-sm font-bold tabular-nums py-2" style={{ backgroundColor: h.bg, color: h.text }} title={`${d.department} ${l}: ${pct}%`}>
                  {pct}%
                </span>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

export default function BottleneckMapPage() {
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState({});
  const [busy, setBusy] = useState(false);
  const setFlowState = useLiveStore((s) => s.setFlowState);
  const q = useFlowPolling(() => flowApi.getBottlenecks(), { intervalMs: 30000, refreshOn: ['flow.analysisComplete', 'flow.bottleneckDetected', 'bed.updated'] });
  const staffQ = useFlowPolling(() => flowApi.getStaffRoster(), { intervalMs: 120000, toastOnError: false });
  const data = q.data;
  const depts = useMemo(() => data?.bottlenecks || [], [data]);

  useEffect(() => {
    if (data) setFlowState({ lastAnalysisAt: data.analyzedAt });
  }, [data, setFlowState]);

  // Root-cause actions first, then the rest, without duplicates
  const actions = useMemo(() => {
    const ordered = [...depts].sort((a, b) => Number(b.rootCause) - Number(a.rootCause) || Number(b.isCascade) - Number(a.isCascade));
    const seen = new Set();
    return ordered.flatMap((d) => d.recommendedActions || []).filter((a) => !seen.has(a.text) && seen.add(a.text)).slice(0, 6);
  }, [depts]);

  const apply = async (list) => {
    if (!list.length) return;
    setBusy(true);
    try {
      await flowApi.createRecommendationBatch(list, { autoApprove: true, source: 'bottleneck' });
      toast.success(`${list.length} action${list.length > 1 ? 's' : ''} sent to the team`);
      setChecked({});
      q.refresh({ silent: true });
    } catch (e) {
      toast.error(errorText(e, 'Could not apply actions'));
    } finally {
      setBusy(false);
    }
  };

  const selectedList = actions.filter((a) => checked[a.id]);
  const selectedDept = depts.find((d) => d.department === selected);

  return (
    <div className="space-y-5">
      <FlowPageHeader
        title="Bottleneck Map"
        subtitle={`Where patient flow is slowing down and what to do about it. Updated ${data ? timeAgo(data.analyzedAt) : '—'}`}
        showHealth={false}
        actions={
          <button type="button" className="flow-btn-secondary" onClick={() => q.refresh()} disabled={q.loading}>
            <RefreshCw className={clsx('w-4 h-4', q.loading && 'animate-spin')} aria-hidden="true" /> Refresh
          </button>
        }
      />

      {q.error && !data && <FlowError message={q.error} onRetry={q.refresh} />}
      {!data && !q.error && <FlowSkeleton lines={10} />}

      {data && (
        <>
          <Verdict depts={depts} />

          <section className="flow-card p-5" aria-label="Patient flow pipeline">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div>
                <h2 className="text-base font-bold text-ink-900">Patient flow</h2>
                <p className="text-sm text-ink-500">Departments in the order patients move. Select one for details.</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-ink-500">
                {[
                  ['#10B981', 'Below 70%'],
                  ['#F59E0B', '70 to 90%'],
                  ['#EF4444', 'Above 90%'],
                ].map(([c, l]) => (
                  <span key={l} className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} aria-hidden="true" /> {l}
                  </span>
                ))}
              </div>
            </div>
            <BottleneckCascadeMap departments={depts} selected={selected} onSelect={(d) => setSelected(d.department)} />
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5 items-start">
            <Outlook depts={depts} onSelect={setSelected} />

            <section className="flow-card p-5" aria-label="Recommended actions">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-bold text-ink-900">Recommended actions</h2>
                  <p className="text-sm text-ink-500">Root-cause actions first</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="flow-btn-secondary" disabled={busy || !selectedList.length} onClick={() => apply(selectedList)}>
                    Apply selected{selectedList.length ? ` (${selectedList.length})` : ''}
                  </button>
                  <button type="button" className="flow-btn-primary" disabled={busy || !actions.length} onClick={() => apply(actions)}>
                    <Zap className="w-4 h-4" aria-hidden="true" /> Apply all
                  </button>
                </div>
              </div>
              {!actions.length && <MiniEmpty text="No actions needed. Every department is within limits." />}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {actions.map((a) => {
                  const Icon = ACTION_ICON[a.type] || Zap;
                  const on = Boolean(checked[a.id]);
                  return (
                    <label key={a.id} className={clsx('flex gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors', on ? 'border-royal-500 bg-royal-500/5' : 'border-cream-200 hover:border-royal-500/40')}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => setChecked((c) => ({ ...c, [a.id]: e.target.checked }))} />
                      <span className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', on ? 'bg-royal-500 text-white' : 'bg-royal-500/10 text-royal-500')}>
                        <Icon className="w-5 h-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink-900">{a.text}</span>
                        <span className="inline-block mt-1.5 rounded-md bg-[#10B981]/10 px-2 py-0.5 text-xs font-semibold text-fg-ok">{a.impact}</span>
                        {a.why && <span className="block text-xs text-ink-500 mt-1.5">{a.why}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          </div>

          <ExperimentalOutlook departments={depts} />
        </>
      )}

      {selectedDept && <DetailDrawer dept={selectedDept} staff={staffQ.data} busy={busy} onClose={() => setSelected(null)} onApply={apply} />}
    </div>
  );
}
