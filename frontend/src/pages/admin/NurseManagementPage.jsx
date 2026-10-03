/**
 * @file NurseManagementPage.jsx
 * /admin/nurses: every nurse with ward, bed allocation, shift, duty status, patient load and open tasks.
 */

import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import React, { useState } from 'react';
import clsx from 'clsx';
import { Search, HeartHandshake, Users, ListChecks, AlertTriangle } from 'lucide-react';
import StatusPill from '../../components/domain/StatusPill.jsx';
import { FlowError, FlowSkeleton } from '../../components/domain/FlowUi.jsx';
import { StatTile, Avatar } from '../../components/domain/CareUi.jsx';
import careApi from '../../api/careApi.js';
import { useFlowPolling } from '../../hooks/useFlowPolling.js';

export default function NurseManagementPage() {
  const [search, setSearch] = useState('');
  const q = useFlowPolling(() => careApi.listNurses(), { intervalMs: 60000, refreshOn: ['bed.updated'] });
  const all = q.data || [];
  const rows = all.filter((n) => !search || `${n.name} ${n.ward} ${n.department}`.toLowerCase().includes(search.toLowerCase()));
  const onDuty = all.filter((n) => n.status === 'on_duty');

  return (
    <div className="space-y-4">
      <FlowPageHeader
        title="Nurse Management"
        subtitle="Allocation, duty status and workload"
        showHealth={false}
        actions={
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input className="flow-input !pl-8" placeholder="Search nurse or ward" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search nurses" />
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={HeartHandshake} value={`${onDuty.length}/${all.length}`} label="On duty" tone="ok" />
        <StatTile icon={Users} value={all.reduce((a, n) => a + n.patients, 0)} label="Patients covered" />
        <StatTile icon={AlertTriangle} value={all.reduce((a, n) => a + n.critical, 0)} label="Critical patients" tone="bad" />
        <StatTile icon={ListChecks} value={all.reduce((a, n) => a + n.tasksPending, 0)} label="Open tasks" tone="warn" />
      </div>

      {q.error && !q.data && <FlowError message={q.error} onRetry={q.refresh} />}
      {!q.data && !q.error && <FlowSkeleton lines={8} />}
      {q.data && (
        <div className="table-wrap">
          <table className="mo-table">
            <thead>
              <tr>
                <th scope="col">Nurse</th>
                <th scope="col">Ward</th>
                <th scope="col">Beds</th>
                <th scope="col">Shift</th>
                <th scope="col">Status</th>
                <th scope="col">Patients</th>
                <th scope="col">Open tasks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => {
                const ratio = n.patients ? n.patients : 0;
                return (
                  <tr key={n.id}>
                    <td>
                      <span className="inline-flex items-center gap-2.5">
                        <Avatar name={n.name} color="#BE185D" size="sm" />
                        <span className="font-semibold">{n.name}</span>
                      </span>
                    </td>
                    <td>
                      {n.ward}
                      <span className="block text-xs text-ink-500">{n.department}</span>
                    </td>
                    <td className="max-w-[220px] truncate text-ink-500">{n.bedRange}</td>
                    <td className="tabular-nums">{n.shift}</td>
                    <td>
                      <StatusPill status={n.status} size="xs" />
                    </td>
                    <td className="tabular-nums">
                      <span className={clsx('font-semibold', ratio > 8 && 'text-fg-warn')}>{n.patients}</span>
                      {n.critical > 0 && <span className="ml-1.5 text-xs text-fg-bad">{n.critical} critical</span>}
                    </td>
                    <td className="tabular-nums">{n.tasksPending}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
