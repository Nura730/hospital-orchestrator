/**
 * @file BottleneckCascadeMap.jsx
 * Dependency chain Emergency → Radiology → General Ward → HDU → ICU → OT.
 * Each box: big current %, predicted 2h % with arrow, colored by utilization.
 * ROOT CAUSE = pulsing red border; CASCADE = orange border. Below: selectable actions + "Apply All Actions".
 */

import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUpRight, ArrowDownRight, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import StatusPill from './StatusPill.jsx';
import { FlowSkeleton, FlowEmpty, SectionHeader } from './FlowUi.jsx';
import flowApi from '../../api/flowApi.js';
import { errorText } from '../../hooks/useFlowPolling.js';
import { utilBand, BAND_STYLES } from '../../utils/flowFormat.js';

function ChainBox({ b }) {
  const cur = Math.round(b.utilization * 100);
  const pred = Math.round((b.predicted?.[2] ?? b.utilization) * 100);
  const band = BAND_STYLES[utilBand(b.utilization)];
  const Trend = pred > cur ? ArrowUpRight : pred < cur ? ArrowDownRight : ArrowRight;
  return (
    <div
      className={clsx(
        'relative rounded-xl border-2 bg-cream-50 px-3 py-2.5 flex items-center justify-between gap-3',
        b.rootCause ? 'border-[#D64545] animate-pulse-root' : b.isCascade ? 'border-[#F28C28]' : 'border-cream-200'
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-royal-900 truncate">{b.department}</span>
          {b.rootCause && <StatusPill status="root" size="xs" dot={false} />}
          {b.isCascade && <StatusPill status="cascade" size="xs" dot={false} />}
        </div>
        <span className="text-[10px] text-ink-500 tabular-nums">
          {b.occupied}/{b.capacity} {b.department === 'OT' ? 'theatres' : 'beds'}
        </span>
      </div>
      <div className="text-right shrink-0">
        <div className={clsx('text-2xl font-extrabold tabular-nums leading-none', band.text)}>{cur}%</div>
        <div className={clsx('text-[11px] font-semibold tabular-nums inline-flex items-center gap-0.5', BAND_STYLES[utilBand(pred / 100)].text)}>
          <Trend className="w-3 h-3" aria-hidden="true" /> {pred}% in 2h
        </div>
      </div>
    </div>
  );
}

export function BottleneckCascadeMap({ bottlenecks = [], loading = false, onApplied, title = 'Bottleneck cascade' }) {
  const actions = useMemo(() => {
    const root = bottlenecks.find((b) => b.rootCause);
    const ordered = root ? [root, ...bottlenecks.filter((b) => b !== root)] : bottlenecks;
    return ordered.flatMap((b) => b.recommendedActions || []);
  }, [bottlenecks]);
  const [checked, setChecked] = useState({});
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(null);

  useEffect(() => {
    setChecked((prev) => Object.fromEntries(actions.map((a) => [a.id, prev[a.id] ?? true])));
  }, [actions]);

  const selected = actions.filter((a) => checked[a.id]);

  const apply = async () => {
    if (!selected.length) return;
    setBusy(true);
    try {
      const res = await flowApi.createRecommendationBatch(selected, { autoApprove: true, source: 'command_center' });
      setApplied(res);
      toast.success(`${res.created} actions applied · ${res.notificationsSent} notifications sent${res.nudges ? ` · ${res.nudges} discharge nudges` : ''}`);
      onApplied?.(res);
    } catch (e) {
      toast.error(errorText(e, 'Could not apply actions'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flow-card-pad h-full flex flex-col">
      <SectionHeader title={title} subtitle="Root cause → cascade (2h prediction)" icon={Zap} />
      {loading && !bottlenecks.length ? (
        <FlowSkeleton lines={6} height="h-12" />
      ) : (
        <ol className="flex flex-col gap-1" aria-label="Department dependency chain">
          {bottlenecks.map((b, i) => (
            <li key={b.department}>
              <ChainBox b={b} />
              {i < bottlenecks.length - 1 && (
                <div className="flex justify-center py-0.5" aria-hidden="true">
                  <ArrowDown className={clsx('w-4 h-4', bottlenecks[i + 1].isCascade ? 'text-[#F28C28]' : 'text-cream-200')} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 pt-3 border-t border-cream-200 flex-1 flex flex-col">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-500 mb-2">Recommended actions</h4>
        {actions.length === 0 && !loading ? (
          <FlowEmpty icon={CheckCircle2} title="No actions needed" message="Every department is within its thresholds." />
        ) : (
          <ul className="space-y-1.5 flex-1">
            {actions.map((a) => (
              <li key={a.id}>
                <label className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-royal-100 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[#014BAA] w-3.5 h-3.5"
                    checked={!!checked[a.id]}
                    onChange={(e) => setChecked((c) => ({ ...c, [a.id]: e.target.checked }))}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-ink-900">{a.text}</span>
                    <span className="block text-[10px] text-[#13784F] font-semibold">{a.impact}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {actions.length > 0 && (
          <button type="button" className="flow-btn-primary w-full mt-3" onClick={apply} disabled={busy || !selected.length}>
            <Zap className="w-3.5 h-3.5" aria-hidden="true" />
            {busy ? 'Applying…' : `Apply All Actions (${selected.length})`}
          </button>
        )}
        {applied && (
          <p className="text-[11px] text-[#13784F] mt-2 text-center" role="status">
            {applied.created} recommendations approved, {applied.notificationsSent} people notified.
          </p>
        )}
      </div>
    </div>
  );
}

export default BottleneckCascadeMap;
