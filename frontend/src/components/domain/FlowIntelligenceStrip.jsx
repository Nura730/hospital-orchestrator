/**
 * @file FlowIntelligenceStrip.jsx
 * Admin dashboard strip below the KPI row: top bottleneck, 2h shortage + confidence, top action button.
 * Refreshes every 30 s and on flow.analysisComplete.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Brain, AlertTriangle, BedDouble, Zap, ArrowRight } from 'lucide-react';
import StatusPill from './StatusPill.jsx';
import PredictionConfidenceBadge from './PredictionConfidenceBadge.jsx';
import flowApi from '../../api/flowApi.js';
import { useLiveStore } from '../../store/liveStore.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';

export function FlowIntelligenceStrip() {
  const setFlowState = useLiveStore((s) => s.setFlowState);
  const live = useLiveStore((s) => s.flowState.stateSummary);
  const [busy, setBusy] = useState(false);
  const { data, loading } = useFlowPolling(() => flowApi.getStateSummary(), { intervalMs: 30000, refreshOn: ['flow.analysisComplete', 'bed.updated'] });
  const s = live && data && new Date(live.generatedAt) > new Date(data.generatedAt) ? live : data;

  useEffect(() => {
    if (data) setFlowState({ stateSummary: data, lastAnalysisAt: data.lastAnalysisAt });
  }, [data, setFlowState]);

  const applyTop = async () => {
    if (!s?.topAction) return;
    setBusy(true);
    try {
      const r = await flowApi.createRecommendationBatch([s.topAction], { autoApprove: true, source: 'dashboard' });
      toast.success(`Applied · ${r.notificationsSent} notified`);
    } catch (e) {
      toast.error(errorText(e, 'Could not apply action'));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !s) return <div className="flow-skeleton h-20 rounded-2xl mb-4" aria-busy="true" />;
  if (!s) return null;
  const root = s.departments.find((d) => d.rootCause);

  return (
    <section className="rounded-2xl bg-gradient-to-r from-royal-900 to-royal-500 text-white p-4 mb-5 shadow-soft" aria-label="Flow intelligence">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4" aria-hidden="true" />
        <h2 className="text-xs font-bold uppercase tracking-wider">Flow Intelligence</h2>
        <Link to="/admin/flow/command-center" className="ml-auto text-[11px] font-semibold text-white/85 hover:text-white inline-flex items-center gap-1">
          Command Center <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl bg-white/10 p-3">
          <div className="text-[10px] uppercase tracking-wide text-white/75 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Top bottleneck
          </div>
          {root ? (
            <>
              <div className="text-lg font-extrabold">{root.department}</div>
              <div className="text-[11px] text-white/85 tabular-nums">
                {root.utilizationPct}% now → {root.predicted2hPct}% in 2h {s.cascade.length > 0 && `· cascade: ${s.cascade.join(', ')}`}
              </div>
            </>
          ) : (
            <div className="text-lg font-extrabold">No bottleneck</div>
          )}
        </div>
        <div className="rounded-xl bg-white/10 p-3">
          <div className="text-[10px] uppercase tracking-wide text-white/75 flex items-center gap-1">
            <BedDouble className="w-3 h-3" aria-hidden="true" /> 2h bed outlook
          </div>
          {s.shortage2h ? (
            <>
              <div className={clsx('text-lg font-extrabold tabular-nums', s.shortage2h.shortage && 'text-[#FFB4B4]')}>
                {s.shortage2h.shortage ? `${s.shortage2h.gap} short` : `${Math.abs(s.shortage2h.gap)} spare`} · {s.shortage2h.department}
              </div>
              <PredictionConfidenceBadge confidence={s.shortage2h.confidence} className="!bg-white !text-royal-700 !border-white" />
            </>
          ) : (
            <div className="text-lg font-extrabold">—</div>
          )}
        </div>
        <div className="rounded-xl bg-white/10 p-3 flex flex-col">
          <div className="text-[10px] uppercase tracking-wide text-white/75 flex items-center gap-1">
            <Zap className="w-3 h-3" aria-hidden="true" /> Top action
          </div>
          <div className="text-xs font-semibold flex-1">{s.topAction ? s.topAction.text : 'No action needed'}</div>
          {s.topAction && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-[#B9F5D8]">{s.topAction.impact}</span>
              <button type="button" onClick={applyTop} disabled={busy} className="flow-btn ml-auto bg-white text-royal-700 hover:bg-royal-100 !py-1">
                {busy ? 'Applying…' : 'Apply'}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {s.departments.map((d) => (
          <StatusPill key={d.department} status={d.rootCause ? 'root' : d.isCascade ? 'cascade' : d.severity} label={`${d.department} ${d.utilizationPct}%`} size="xs" className={!d.rootCause && !d.isCascade ? '!bg-white/90' : ''} />
        ))}
      </div>
    </section>
  );
}

export default FlowIntelligenceStrip;
