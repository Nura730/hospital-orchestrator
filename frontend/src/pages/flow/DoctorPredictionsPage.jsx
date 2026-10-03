/**
 * @file DoctorPredictionsPage.jsx
 * /doctor/flow/predictions (Reference D, Royal Blue): greeting, weekly numeric cards, calendar strip,
 * table of ONLY this doctor's patients with admission probability, expected discharge,
 * top 3 factors and quick actions. AI report (scope "doctor").
 */

import React, { useState } from 'react';
import clsx from 'clsx';
import { Search, Brain } from 'lucide-react';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import FlowKpiCard from '../../components/domain/FlowKpiCard.jsx';
import PatientDetailPopup from '../../components/domain/PatientDetailPopup.jsx';
import { IcuRiskBadge } from '../../components/domain/CareUi.jsx';
import StatusPill from '../../components/domain/StatusPill.jsx';
import AiReportButton from '../../components/domain/AiReportButton.jsx';
import { SectionHeader, FlowSkeleton, FlowEmpty, FlowError, ReadinessBar } from '../../components/domain/FlowUi.jsx';
import DoctorActions from './DoctorActions.jsx';
import flowApi from '../../api/flowApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { useFlowPolling } from '../../hooks/useFlowPolling.js';
import { dateTime, timeUntil, displayName } from '../../utils/flowFormat.js';

export function CalendarStrip({ marks = {} }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    return d;
  });
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-thin" aria-label="This week">
      {days.map((d) => {
        const isToday = d.toDateString() === today.toDateString();
        const n = marks[d.toDateString()] || 0;
        return (
          <div key={d.toISOString()} className={clsx('rounded-xl px-3 py-2 text-center min-w-[52px]', isToday ? 'bg-royal-500 text-white' : 'bg-cream-100 text-ink-900')} aria-current={isToday ? 'date' : undefined}>
            <div className={clsx('text-[10px] uppercase', isToday ? 'text-white/80' : 'text-ink-500')}>{d.toLocaleDateString([], { weekday: 'short' })}</div>
            <div className="text-base font-extrabold tabular-nums">{d.getDate()}</div>
            <div className={clsx('h-1.5 w-1.5 rounded-full mx-auto mt-0.5', n ? (isToday ? 'bg-white' : 'bg-royal-500') : 'bg-transparent')} aria-hidden="true" />
          </div>
        );
      })}
    </div>
  );
}

function probColor(p) {
  if (p >= 0.8) return 'text-fg-bad';
  if (p >= 0.5) return 'text-fg-warn';
  return 'text-fg-ok';
}

export default function DoctorPredictionsPage() {
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(null);
  const [popup, setPopup] = useState(null);
  const numbers = useFlowPolling(() => flowApi.getDashboardNumbers('doctor'), { intervalMs: 60000, refreshOn: ['patient.updated'] });
  const pts = useFlowPolling(() => flowApi.getDoctorPatients(), { intervalMs: 60000, refreshOn: ['patient.updated', 'flow.dischargeNudge', 'bed.updated'] });

  const list = (pts.data || []).filter((p) => !search || p.alias.toLowerCase().includes(search.toLowerCase()) || (p.bedId || '').toLowerCase().includes(search.toLowerCase()));
  const marks = (pts.data || []).reduce((acc, p) => {
    if (p.expectedDischarge) acc[new Date(p.expectedDischarge).toDateString()] = (acc[new Date(p.expectedDischarge).toDateString()] || 0) + 1;
    return acc;
  }, {});
  const refresh = () => {
    pts.refresh({ silent: true });
    numbers.refresh({ silent: true });
  };

  return (
    <div className="flow-page">
      <FlowPageHeader
        title={`Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, ${displayName(user)}`}
        subtitle="Admission probability, ICU risk (trained model) and discharge readiness for your patients"
        crumbs={[{ label: 'Doctor', to: '/doctor/dashboard' }, { label: 'My Patient Predictions' }]}
        actions={<AiReportButton scope="doctor" />}
      />

      <div className="space-y-3 mb-5">
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" aria-label="Weekly report">
          {(numbers.data?.kpis || Array.from({ length: 4 }).map(() => null)).map((k, i) => (
            <FlowKpiCard key={k ? k.key : i} kpi={k} loading={!k} series={numbers.data?.series} />
          ))}
        </section>
        <div className="flow-card-pad flex flex-wrap items-center gap-4">
          <h3 className="label-xs shrink-0">Expected discharges</h3>
          <CalendarStrip marks={marks} />
        </div>
      </div>

      <section className="flow-card-pad">
        <SectionHeader
          title="My patients"
          subtitle="Highest acuity first"
          icon={Brain}
          actions={
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <label className="sr-only" htmlFor="doc-search">
                Search patients
              </label>
              <input id="doc-search" className="flow-input !pl-8" placeholder="Search alias or bed" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          }
        />
        {pts.error && !pts.data && <FlowError message={pts.error} onRetry={pts.refresh} />}
        {pts.loading && !pts.data ? (
          <FlowSkeleton lines={5} height="h-10" />
        ) : list.length === 0 ? (
          <FlowEmpty title="No patients" message="Patients assigned to you appear here." />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="flow-table w-full min-w-[980px]">
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col">Acuity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Admission prob.</th>
                  <th scope="col" title="ICU need predicted by the trained model">ICU risk</th>
                  <th scope="col">Expected discharge</th>
                  <th scope="col">Readiness</th>
                  <th scope="col">Top factors</th>
                  <th scope="col" className="!text-right">Quick actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.patientId} onClick={() => { setActive(p.patientId); setPopup(p.patientId); }} className={clsx('cursor-pointer', active === p.patientId && '!bg-highlight')}>
                    <td>
                      <div className="font-bold text-royal-900">{p.alias}</div>
                      <div className="text-[10px] text-ink-500">
                        {p.bedId || 'no bed'} · {p.ward || p.department}
                      </div>
                    </td>
                    <td>
                      <StatusPill status={p.acuity <= 2 ? 'critical' : 'admitted'} label={`A${p.acuity}`} size="xs" />
                    </td>
                    <td>
                      <StatusPill status={p.status} size="xs" />
                    </td>
                    <td>
                      <span className={clsx('text-2xl font-extrabold tabular-nums', probColor(p.admissionProbability))}>{Math.round(p.admissionProbability * 100)}%</span>
                    </td>
                    <td>{p.bedId?.startsWith('ICU') ? <span className="text-[11px] text-ink-500">In ICU</span> : <IcuRiskBadge risk={p.icuRisk} />}</td>
                    <td>
                      <div>{dateTime(p.expectedDischarge)}</div>
                      <div className="text-[10px] text-ink-500">{timeUntil(p.expectedDischarge)}</div>
                    </td>
                    <td>
                      <ReadinessBar score={p.readiness.score} />
                    </td>
                    <td className="!whitespace-normal">
                      <ul className="space-y-0.5">
                        {p.factors.map((f) => (
                          <li key={f.factor} className="text-[10px] text-ink-900">
                            {f.factor} <span className="text-ink-500">(+{Math.round(f.impact * 100)}%)</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="!text-right" onClick={(e) => e.stopPropagation()}>
                      <DoctorActions patient={p} onChanged={refresh} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {popup && <PatientDetailPopup patientId={popup} onClose={() => setPopup(null)} />}
    </div>
  );
}
