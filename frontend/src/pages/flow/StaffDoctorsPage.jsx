/**
 * @file StaffDoctorsPage.jsx
 * /admin/flow/staff (Reference A cards + Reference B roster table): doctor presence, nurses and housekeeping
 * per department. CSV export.
 */

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Users, Search } from 'lucide-react';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import StatusPill from '../../components/domain/StatusPill.jsx';
import RawDataTable from '../../components/domain/RawDataTable.jsx';
import { SectionHeader, FlowSkeleton, FlowError } from '../../components/domain/FlowUi.jsx';
import flowApi from '../../api/flowApi.js';
import { useFlowPolling } from '../../hooks/useFlowPolling.js';
import { initials } from '../../utils/flowFormat.js';

const DOT = { online: 'bg-[#10B981]', away: 'bg-[#F59E0B]', offline: 'bg-[#6B7280]' };

export default function StaffDoctorsPage() {
  const [presence, setPresence] = useState('all');
  const [dept, setDept] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const q = useFlowPolling(() => flowApi.getStaffRoster(), { intervalMs: 60000, refreshOn: ['doctor.statusChanged'] });
  const r = q.data;

  const doctors = useMemo(
    () =>
      (r?.doctors || []).filter(
        (d) => (presence === 'all' || d.presence === presence) && (dept === 'all' || d.department === dept) && (!search || `${d.name} ${d.specialization}`.toLowerCase().includes(search.toLowerCase()))
      ),
    [r, presence, dept, search]
  );
  const depts = [...new Set((r?.doctors || []).map((d) => d.department).filter(Boolean))];

  return (
    <div className="flow-page">
      <FlowPageHeader title="Staff & Doctors" subtitle="Who is on shift and where" crumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Flow Intelligence' }, { label: 'Staff & Doctors' }]} />
      {q.error && !r && <FlowError message={q.error} onRetry={q.refresh} />}

      {r && (
        <div className="flex flex-wrap gap-3 mb-5">
          {[
            ['Doctors online', r.totals.doctorsOnline, '#10B981'],
            ['Doctors away', r.totals.doctorsAway, '#F59E0B'],
            ['Nurses on shift', r.totals.nursesOnShift, '#014BAA'],
          ].map(([l, v, c]) => (
            <div key={l} className="flow-card px-4 py-3 flex-1 min-w-[160px] border-l-4" style={{ borderLeftColor: c }}>
              <div className="text-[11px] uppercase font-semibold text-ink-500">{l}</div>
              <div className="text-2xl font-extrabold tabular-nums text-royal-900">{v}</div>
            </div>
          ))}
        </div>
      )}

      <section className="flow-card-pad mb-5">
        <SectionHeader
          title="Doctors"
          icon={Users}
          actions={
            <>
              {['all', 'online', 'away', 'offline'].map((p) => (
                <button key={p} type="button" onClick={() => setPresence(p)} aria-pressed={presence === p} className={clsx('flow-chip capitalize', presence === p ? 'bg-royal-500 text-white border-royal-500' : 'bg-cream-50 border-cream-200')}>
                  {p}
                </button>
              ))}
              <label className="sr-only" htmlFor="staff-dept">
                Department
              </label>
              <select id="staff-dept" className="flow-input !w-auto !py-1.5" value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="all">All departments</option>
                {depts.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <label className="sr-only" htmlFor="staff-search">
                  Search doctors
                </label>
                <input id="staff-search" className="flow-input !pl-8" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </>
          }
        />
        {q.loading && !r ? (
          <FlowSkeleton lines={3} height="h-20" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {doctors.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelected(d.id)}
                aria-pressed={selected === d.id}
                className={clsx('text-left rounded-xl border bg-cream-50 p-3', selected === d.id ? 'border-royal-500' : 'border-cream-200 hover:border-royal-500/40')}
              >
                <div className="flex items-center gap-2.5">
                  <span className="relative w-11 h-11 rounded-full bg-royal-100 text-royal-700 font-bold text-xs flex items-center justify-center">
                    {initials(d.name)}
                    <span className={clsx('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-cream-50', DOT[d.presence])} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold truncate">{d.name}</span>
                    <span className="block text-[11px] text-ink-500 truncate">{d.specialization}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <StatusPill status={d.presence} size="xs" />
                  <span className="text-[10px] text-ink-500">{d.status.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-[10px] text-ink-500 mt-1 truncate">
                  {d.department}
                  {d.location ? ` · ${d.location}` : ''}
                  {d.onCall ? ' · on call' : ''}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <RawDataTable
        title="Staff roster by department"
        exportName="staff_roster"
        rows={r?.departments || []}
        columns={[
          { key: 'department', label: 'Department' },
          { key: 'doctors', label: 'Doctors on duty', align: 'right' },
          { key: 'nurses', label: 'Nurses on shift', align: 'right' },
          { key: 'staff', label: 'Housekeeping', align: 'right' },
        ]}
      />
    </div>
  );
}
