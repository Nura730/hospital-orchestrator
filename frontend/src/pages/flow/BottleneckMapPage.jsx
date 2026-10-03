/**
 * @file BottleneckMapPage.jsx
 * /admin/flow/bottlenecks: one-line header, the department cascade chain, a numbered list of recommended
 * actions (Apply All / Apply Selected) and a right-side detail drawer per department. Severity legend at the bottom.
 */

import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { RefreshCw, X, Zap, Users, Stethoscope, ArrowRight } from 'lucide-react';
import BottleneckCascadeMap, { severityOf, SEVERITY_STYLE } from '../../components/domain/BottleneckCascadeMap.jsx';
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
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color }}>
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
                    <p className="text-[10px] text-ink-500">{h}h</p>
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
    <div className="space-y-4">
      <FlowPageHeader
        title="Bottleneck Map"
        subtitle={`Last updated ${data ? timeAgo(data.analyzedAt) : '—'}`}
        showHealth={false}
        actions={
          <button type="button" className="flow-btn-secondary" onClick={() => q.refresh()} disabled={q.loading}>
            <RefreshCw className={clsx('w-3.5 h-3.5', q.loading && 'animate-spin')} aria-hidden="true" /> Refresh
          </button>
        }
      />

      {q.error && !data && <FlowError message={q.error} onRetry={q.refresh} />}

      <section className="flow-card p-4">
        {!data ? <FlowSkeleton lines={4} /> : <BottleneckCascadeMap departments={depts} selected={selected} onSelect={(d) => setSelected(d.department)} />}
      </section>

      <section className="flow-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="label-xs">Recommended Actions</h2>
          <div className="flex gap-2">
            <button type="button" className="flow-btn-secondary" disabled={busy || !selectedList.length} onClick={() => apply(selectedList)}>
              Apply Selected{selectedList.length ? ` (${selectedList.length})` : ''}
            </button>
            <button type="button" className="flow-btn-primary" disabled={busy || !actions.length} onClick={() => apply(actions)}>
              <Zap className="w-3.5 h-3.5" aria-hidden="true" /> Apply All
            </button>
          </div>
        </div>
        {data && !actions.length && <MiniEmpty text="No actions needed. Every department is within limits." />}
        <ol className="space-y-1">
          {actions.map((a, i) => (
            <li key={a.id}>
              <label className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-sunken cursor-pointer">
                <input type="checkbox" className="mt-0.5 accent-[#014BAA]" checked={Boolean(checked[a.id])} onChange={(e) => setChecked((c) => ({ ...c, [a.id]: e.target.checked }))} />
                <span className="text-xs text-ink-900">
                  <span className="font-semibold tabular-nums mr-1">{i + 1}.</span>
                  {a.text} <ArrowRight className="inline w-3.5 h-3.5 mx-1 text-ink-500 align-[-2px]" aria-hidden="true" /> <span className="text-fg-ok font-medium">{a.impact}</span>
                </span>
              </label>
            </li>
          ))}
        </ol>
      </section>

      <footer className="flex flex-wrap items-center gap-4 text-[11px] text-ink-500">
        {[
          ['#10B981', '< 70% Normal'],
          ['#F59E0B', '70-90% Warning'],
          ['#EF4444', '> 90% Critical'],
        ].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} /> {l}
          </span>
        ))}
      </footer>

      {selectedDept && <DetailDrawer dept={selectedDept} staff={staffQ.data} busy={busy} onClose={() => setSelected(null)} onApply={apply} />}
    </div>
  );
}
