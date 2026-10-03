/**
 * @file FlowActionFeed.jsx
 * Live feed (max 20, newest first): icon, title, detail, expected impact, action button, time since.
 * Seeded from pending recommendations, then fed by socket events through liveStore.flowState.feed.
 */

import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Radio, BedDouble, Lightbulb, Ambulance, LogOut, AlertTriangle, Check } from 'lucide-react';
import { SectionHeader, FlowEmpty } from './FlowUi.jsx';
import StatusPill from './StatusPill.jsx';
import flowApi from '../../api/flowApi.js';
import { useLiveStore } from '../../store/liveStore.js';
import { errorText } from '../../hooks/useFlowPolling.js';
import { timeAgo } from '../../utils/flowFormat.js';

const ICONS = { bed: BedDouble, recommendation: Lightbulb, ambulance: Ambulance, discharge: LogOut, bottleneck: AlertTriangle };
const TONES = {
  bed: 'bg-[#2BA8E0]/15 text-[#136E96]',
  recommendation: 'bg-royal-100 text-royal-500',
  ambulance: 'bg-[#D64545]/15 text-[#B02E2E]',
  discharge: 'bg-[#1FA971]/15 text-[#13784F]',
  bottleneck: 'bg-[#F2A93B]/20 text-[#8A5200]',
};

export function FlowActionFeed({ maxHeight = 'max-h-[560px]' }) {
  const feed = useLiveStore((s) => s.flowState.feed);
  const [seed, setSeed] = useState([]);
  const [decided, setDecided] = useState({});
  const [, tick] = useState(0);

  useEffect(() => {
    let alive = true;
    flowApi
      .getRecommendations()
      .then((recs) => {
        if (!alive || !Array.isArray(recs)) return;
        setSeed(
          recs.slice(0, 20).map((r) => ({ id: `seed-${r.id}`, at: r.createdAt, kind: 'recommendation', title: r.title, detail: r.detail || r.type, impact: r.expectedImpact, risk: r.risk, recommendationId: r.id, status: r.status }))
        );
      })
      .catch(() => {});
    const t = setInterval(() => tick((n) => n + 1), 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const items = useMemo(() => {
    const seen = new Set(feed.map((f) => f.recommendationId).filter(Boolean));
    return [...feed, ...seed.filter((s) => !seen.has(s.recommendationId))]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 20);
  }, [feed, seed]);

  const approve = async (item) => {
    try {
      await flowApi.decideRecommendation(item.recommendationId, 'approved');
      setDecided((d) => ({ ...d, [item.recommendationId]: 'approved' }));
      toast.success('Approved');
    } catch (e) {
      toast.error(errorText(e, 'Could not approve'));
    }
  };

  const nudge = async (item) => {
    try {
      const r = await flowApi.nudgeDischarges([item.patientId]);
      toast.success(`Doctor notified (${r.notificationsSent})`);
    } catch (e) {
      toast.error(errorText(e, 'Could not notify'));
    }
  };

  return (
    <div className="flow-card-pad h-full flex flex-col">
      <SectionHeader
        title="Live action feed"
        subtitle="Newest first · max 20"
        icon={Radio}
        actions={
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#13784F]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1FA971] animate-pulse" /> LIVE
          </span>
        }
      />
      {items.length === 0 ? (
        <FlowEmpty icon={Radio} title="Waiting for events" message="Actions appear here the moment a bed, patient or prediction changes." />
      ) : (
        <ul className={`space-y-2 overflow-y-auto scrollbar-thin pr-1 ${maxHeight}`} aria-live="polite">
          {items.map((item) => {
            const Icon = ICONS[item.kind] || Lightbulb;
            const status = decided[item.recommendationId] || item.status;
            return (
              <li key={item.id} className="flex gap-2.5 rounded-xl border border-cream-200 bg-cream-50 p-2.5 animate-fade-in">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TONES[item.kind] || TONES.recommendation}`}>
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-ink-900 leading-snug">{item.title}</p>
                    <span className="text-[10px] text-ink-500 shrink-0 tabular-nums">{timeAgo(item.at)}</span>
                  </div>
                  {item.detail && <p className="text-[11px] text-ink-500 leading-snug mt-0.5 line-clamp-2">{item.detail}</p>}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {item.impact && <span className="text-[10px] font-semibold text-[#13784F] bg-[#1FA971]/10 rounded-full px-2 py-0.5">{item.impact}</span>}
                    {item.risk && <StatusPill status={item.risk} size="xs" />}
                    {item.kind === 'recommendation' && item.recommendationId && status === 'pending' && (
                      <button type="button" className="flow-btn-primary !py-0.5 !px-2 !text-[10px] ml-auto" onClick={() => approve(item)}>
                        <Check className="w-3 h-3" aria-hidden="true" /> Approve
                      </button>
                    )}
                    {item.kind === 'recommendation' && status && status !== 'pending' && <StatusPill status={status} size="xs" className="ml-auto" />}
                    {item.kind === 'discharge' && item.patientId && (
                      <button type="button" className="flow-btn-secondary !py-0.5 !px-2 !text-[10px] ml-auto" onClick={() => nudge(item)}>
                        Notify doctor
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default FlowActionFeed;
