/**
 * @file DoctorDashboard.jsx
 * /doctor/dashboard (Reference D recolored to Royal Blue): greeting, search, "+ Add" (request OT),
 * weekly report cards, calendar strip + schedule list, patient table with highlighted active row,
 * and MyPatientRiskSummary below the patient list. Charts only behind "View chart".
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Plus, Search, CalendarClock, Users } from 'lucide-react';
import FlowPageHeader from '../components/domain/FlowPageHeader.jsx';
import FlowKpiCard from '../components/domain/FlowKpiCard.jsx';
import StatusPill from '../components/domain/StatusPill.jsx';
import MyPatientRiskSummary from '../components/domain/MyPatientRiskSummary.jsx';
import AiReportButton from '../components/domain/AiReportButton.jsx';
import { SectionHeader, FlowSkeleton, FlowEmpty, ReadinessBar } from '../components/domain/FlowUi.jsx';
import { CalendarStrip } from './flow/DoctorPredictionsPage.jsx';
import DoctorActions from './flow/DoctorActions.jsx';
import flowApi from '../api/flowApi.js';
import { useAuthStore } from '../store/authStore.js';
import { useFlowPolling } from '../hooks/useFlowPolling.js';
import { clock, timeUntil, displayName } from '../utils/flowFormat.js';

export default function DoctorDashboard() {
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(null);
  const numbers = useFlowPolling(() => flowApi.getDashboardNumbers('doctor'), { intervalMs: 60000, refreshOn: ['patient.updated'] });
  const pts = useFlowPolling(() => flowApi.getDoctorPatients(), { intervalMs: 60000, refreshOn: ['patient.updated', 'bed.updated'] });

  const patients = pts.data || [];
  const list = patients.filter((p) => !search || p.alias.toLowerCase().includes(search.toLowerCase()));
  const schedule = [...patients]
    .filter((p) => p.expectedDischarge && new Date(p.expectedDischarge).getTime() < Date.now() + 24 * 3600000)
    .sort((a, b) => new Date(a.expectedDischarge) - new Date(b.expectedDischarge));
  const marks = patients.reduce((acc, p) => {
    if (p.expectedDischarge) acc[new Date(p.expectedDischarge).toDateString()] = 1;
    return acc;
  }, {});
  const first = patients[0];

  return (
    <div className="flow-page">
      <FlowPageHeader
        title={`Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, ${displayName(user)}`}
        subtitle="Your weekly report and today's patients"
        crumbs={[{ label: 'Doctor' }, { label: 'Dashboard' }]}
        actions={
          <>
            <div className="relative w-48 hidden md:block">
              <Search className="w-3.5 h-3.5 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <label className="sr-only" htmlFor="dd-search">
                Search patients
              </label>
              <input id="dd-search" className="flow-input !pl-8" placeholder="Search patients" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Link to="/doctor/flow/predictions" className="flow-btn-primary">
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add / Request
            </Link>
            <AiReportButton scope="doctor" variant="secondary" />
          </>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5" aria-label="Weekly report">
        {(numbers.data?.kpis || Array.from({ length: 5 }).map(() => null)).map((k, i) => (
          <FlowKpiCard key={k ? k.key : i} kpi={k} loading={!k} series={numbers.data?.series} />
        ))}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <section className="flow-card-pad">
            <SectionHeader title="Patients" subtitle={`${patients.length} under your care`} icon={Users} />
            {pts.loading && !pts.data ? (
              <FlowSkeleton lines={5} height="h-9" />
            ) : list.length === 0 ? (
              <FlowEmpty title="No patients" message="Nothing assigned yet." />
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="flow-table w-full min-w-[760px]">
                  <thead>
                    <tr>
                      <th scope="col">Patient</th>
                      <th scope="col">Bed</th>
                      <th scope="col">Acuity</th>
                      <th scope="col">Status</th>
                      <th scope="col">Readiness</th>
                      <th scope="col">Discharge</th>
                      <th scope="col" className="!text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.patientId} onClick={() => setActive(p.patientId)} className={clsx('cursor-pointer', (active || first?.patientId) === p.patientId && '!bg-royal-100')}>
                        <td className="font-bold text-royal-900">{p.alias}</td>
                        <td className="font-mono">{p.bedId || '—'}</td>
                        <td>
                          <StatusPill status={p.acuity <= 2 ? 'critical' : 'admitted'} label={`A${p.acuity}`} size="xs" />
                        </td>
                        <td>
                          <StatusPill status={p.status} size="xs" />
                        </td>
                        <td>
                          <ReadinessBar score={p.readiness.score} />
                        </td>
                        <td className="text-ink-500">{timeUntil(p.expectedDischarge)}</td>
                        <td className="!text-right" onClick={(e) => e.stopPropagation()}>
                          <DoctorActions patient={p} onChanged={() => pts.refresh({ silent: true })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <MyPatientRiskSummary />
        </div>

        <aside className="flow-card-pad h-fit" aria-label="Schedule">
          <SectionHeader title="Calendar" subtitle="Expected discharges" icon={CalendarClock} />
          <CalendarStrip marks={marks} />
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-500 mt-4 mb-2">Next 24 hours</h4>
          {schedule.length === 0 ? (
            <p className="text-xs text-ink-500">No discharges expected in the next 24 hours.</p>
          ) : (
            <ul className="space-y-2">
              {schedule.map((p) => (
                <li key={p.patientId} className="flex items-center gap-3 rounded-xl bg-cream-100 px-3 py-2">
                  <span className="text-xs font-extrabold text-royal-500 tabular-nums w-12">{clock(p.expectedDischarge)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-ink-900">{p.alias} discharge</span>
                    <span className="block text-[10px] text-ink-500 truncate">
                      {p.bedId} · readiness {p.readiness.score}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
