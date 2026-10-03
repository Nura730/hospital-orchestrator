/**
 * @file AdminDashboard.jsx
 * /admin/dashboard (Reference A "Care" layout): numbers-first KPI row with chart popups,
 * FlowIntelligenceStrip, doctor cards grid and a "Today's Schedule" department panel.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { BedDouble, HeartPulse, Ambulance, Timer, Sparkles, ClipboardCheck, Scissors, TrendingUp, Users, CalendarDays } from 'lucide-react';
import FlowPageHeader from '../components/domain/FlowPageHeader.jsx';
import FlowKpiCard from '../components/domain/FlowKpiCard.jsx';
import FlowIntelligenceStrip from '../components/domain/FlowIntelligenceStrip.jsx';
import AmbulanceIncomingAlert from '../components/domain/AmbulanceIncomingAlert.jsx';
import AiReportButton from '../components/domain/AiReportButton.jsx';
import DemoControls from '../components/domain/DemoControls.jsx';
import StatusPill from '../components/domain/StatusPill.jsx';
import { SectionHeader, FlowSkeleton, FlowError } from '../components/domain/FlowUi.jsx';
import flowApi from '../api/flowApi.js';
import { useAuthStore } from '../store/authStore.js';
import { useFlowPolling } from '../hooks/useFlowPolling.js';
import { initials, displayName } from '../utils/flowFormat.js';

const KPI_ICONS = { occupancy: BedDouble, icu: HeartPulse, edArrivals: Ambulance, edDemand: TrendingUp, avgWait: Timer, dirtyBeds: Sparkles, dischargeReady: ClipboardCheck, otUtil: Scissors };
const DOT = { online: 'bg-[#10B981]', away: 'bg-[#F59E0B]', offline: 'bg-[#6B7280]' };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const numbers = useFlowPolling(() => flowApi.getDashboardNumbers('admin'), { intervalMs: 30000, refreshOn: ['flow.analysisComplete'] });
  const roster = useFlowPolling(() => flowApi.getStaffRoster(), { intervalMs: 60000, refreshOn: ['doctor.statusChanged'] });

  return (
    <div className="flow-page">
      <FlowPageHeader
        title={`${greeting()}, ${displayName(user).replace(/^(Dr\.?|Nurse)\s+/i, '').split(' ')[0]}`}
        subtitle="Hospital at a glance"
        crumbs={[{ label: 'Admin' }, { label: 'Dashboard' }]}
        actions={<AiReportButton scope="admin" />}
      />
      <AmbulanceIncomingAlert />

      {numbers.error && !numbers.data && <FlowError message={numbers.error} onRetry={numbers.refresh} />}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5" aria-label="Key performance indicators">
        {(numbers.data?.kpis || Array.from({ length: 8 }).map(() => null)).map((k, i) => (
          <FlowKpiCard key={k ? k.key : i} kpi={k} loading={!k} series={numbers.data?.series} icon={k ? KPI_ICONS[k.key] : undefined} />
        ))}
      </section>

      <FlowIntelligenceStrip />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="xl:col-span-2 flow-card-pad" aria-label="Doctors">
          <SectionHeader
            title="Doctors"
            subtitle={roster.data ? `${roster.data.totals.doctorsOnline} online · ${roster.data.totals.doctorsAway} away` : 'Live presence'}
            icon={Users}
            actions={
              <Link to="/admin/flow/staff" className="flow-btn-ghost !py-1">
                Staff & roster
              </Link>
            }
          />
          {roster.loading && !roster.data ? (
            <FlowSkeleton lines={4} height="h-16" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(roster.data?.doctors || []).slice(0, 12).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDoctor(d.id === selectedDoctor ? null : d.id)}
                  aria-pressed={selectedDoctor === d.id}
                  className={clsx('text-left rounded-2xl border-2 bg-cream-50 p-3 transition-colors hover:border-royal-500/50', selectedDoctor === d.id ? 'border-royal-500 shadow-soft' : 'border-cream-200')}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="relative w-10 h-10 rounded-full bg-royal-100 text-royal-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {initials(d.name)}
                      <span className={clsx('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-cream-50', DOT[d.presence])} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-ink-900 truncate">{d.name}</span>
                      <span className="block text-xs text-ink-500 truncate">{d.specialization}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <StatusPill status={d.presence} size="xs" />
                    <span className="text-[11px] text-ink-500 truncate ml-2">{d.department}</span>
                  </div>
                  {selectedDoctor === d.id && (
                    <p className="text-xs text-ink-500 mt-2 border-t border-cream-200 pt-2">
                      Status: {d.status.replace(/_/g, ' ')}
                      {d.location ? ` · ${d.location}` : ''}
                      {d.surgeriesToday ? ` · ${d.surgeriesToday} surgeries today` : ''}
                      {d.onCall ? ' · on call' : ''}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="flow-card-pad" aria-label="Today's schedule">
          <SectionHeader title="Today's Schedule" subtitle="On shift per department" icon={CalendarDays} />
          {roster.loading && !roster.data ? (
            <FlowSkeleton lines={6} height="h-10" />
          ) : (
            <ul className="space-y-2">
              {(roster.data?.departments || []).map((d) => (
                <li key={d.department} className="rounded-xl bg-cream-100 px-3 py-2.5">
                  <div className="text-xs font-bold text-royal-900 mb-1">{d.department}</div>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {[
                      ['Doctors', d.doctors],
                      ['Nurses', d.nurses],
                      ['Staff', d.staff],
                    ].map(([l, n]) => (
                      <div key={l}>
                        <div className="text-sm font-extrabold tabular-nums text-ink-900">{n}</div>
                        <div className="text-[10px] uppercase text-ink-500">{l}</div>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <div className="mt-5">
        <DemoControls onChanged={() => numbers.refresh({ silent: true })} />
      </div>
    </div>
  );
}
