/**
 * @file OtDashboard.jsx
 * /ot/dashboard: numbers-first OT KPIs, theatre room cards, OtFlowWarning below the room cards,
 * and the ambulance banner.
 */

import React, { useEffect } from 'react';
import clsx from 'clsx';
import { DoorOpen } from 'lucide-react';
import FlowPageHeader from '../components/domain/FlowPageHeader.jsx';
import FlowKpiCard from '../components/domain/FlowKpiCard.jsx';
import StatusPill from '../components/domain/StatusPill.jsx';
import OtFlowWarning from '../components/domain/OtFlowWarning.jsx';
import AmbulanceIncomingAlert from '../components/domain/AmbulanceIncomingAlert.jsx';
import AiReportButton from '../components/domain/AiReportButton.jsx';
import { SectionHeader, FlowSkeleton } from '../components/domain/FlowUi.jsx';
import { CaseCompleteButton } from './flow/OtFlowImpactPage.jsx';
import flowApi from '../api/flowApi.js';
import { useLiveStore } from '../store/liveStore.js';
import { useFlowPolling } from '../hooks/useFlowPolling.js';
import { BED_STATUS_COLORS, clock, timeUntil } from '../utils/flowFormat.js';

export default function OtDashboard() {
  const setFlowState = useLiveStore((s) => s.setFlowState);
  const numbers = useFlowPolling(() => flowApi.getDashboardNumbers('ot'), { intervalMs: 60000, refreshOn: ['ot.caseCompleted'] });
  const map = useFlowPolling(() => flowApi.getBedMap(), { intervalMs: 60000, refreshOn: ['ot.caseCompleted', 'bed.updated'] });
  const impact = useFlowPolling(() => flowApi.getOtImpact(), { intervalMs: 60000, refreshOn: ['ot.caseCompleted'] });

  useEffect(() => {
    if (map.data) setFlowState({ bedMap: map.data });
  }, [map.data, setFlowState]);

  const rooms = map.data ? map.data.zones.find((z) => z.zone === 'OT')?.tiles || [] : [];
  const pacu = map.data ? map.data.zones.find((z) => z.zone === 'PACU') : null;
  const refresh = () => {
    numbers.refresh({ silent: true });
    map.refresh({ silent: true });
    impact.refresh({ silent: true });
  };

  return (
    <div className="flow-page">
      <FlowPageHeader title="Operating Theatres" subtitle="Room status, post-op capacity and flow risk" crumbs={[{ label: 'OT' }, { label: 'Dashboard' }]} actions={<AiReportButton scope="ot" />} />
      <AmbulanceIncomingAlert />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5" aria-label="OT numbers">
        {(numbers.data?.kpis || Array.from({ length: 5 }).map(() => null)).map((k, i) => (
          <FlowKpiCard key={k ? k.key : i} kpi={k} loading={!k} series={numbers.data?.series} />
        ))}
      </section>

      <section className="flow-card-pad mb-5" aria-label="Theatres">
        <SectionHeader title="Theatres" subtitle={pacu ? `PACU ${pacu.counts.occupied}/${pacu.counts.total} occupied · ${pacu.counts.available} free` : ''} icon={DoorOpen} />
        {map.loading && !map.data ? (
          <FlowSkeleton lines={2} height="h-24" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {rooms.map((r) => {
              const live = (impact.data?.inProgress || []).find((c) => c.room === r.name);
              return (
                <article key={r.id} className="rounded-2xl border-2 bg-cream-50 p-4" style={{ borderColor: BED_STATUS_COLORS[r.status] }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-royal-900">{r.name}</h3>
                    <StatusPill status={r.status} label={r.rawStatus.replace(/_/g, ' ')} size="xs" />
                  </div>
                  <p className={clsx('text-xs mt-2 min-h-[32px]', r.procedure ? 'text-ink-900' : 'text-ink-500')}>{r.procedure ? `${r.caseNumber}: ${r.procedure}` : r.status === 'cleaning' ? 'Turnover cleaning in progress' : r.status === 'reserved' ? 'Reserved for next case' : 'Ready'}</p>
                  {r.doctorName && <p className="text-[11px] text-ink-500">{r.doctorName}</p>}
                  {r.expectedRelease && (
                    <p className="text-[11px] text-ink-500 mt-1">
                      {r.procedure ? 'Ends' : 'Free'} {clock(r.expectedRelease)} ({timeUntil(r.expectedRelease)})
                    </p>
                  )}
                  {live && <CaseCompleteButton caseItem={live} onDone={refresh} className="mt-3 w-full" />}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <OtFlowWarning />
    </div>
  );
}
