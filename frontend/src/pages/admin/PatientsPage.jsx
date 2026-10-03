/**
 * @file PatientsPage.jsx
 * /admin/patients: every admitted or waiting patient. Click a row for PatientDetailPopup, "Track Patient"
 * for the journey page, and "Send Request" opens a compact form inline under that row. Sending creates a
 * notification for the relevant staff (Urgent also raises an alert); the row then shows "Request Sent"
 * for 3 seconds.
 */

import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Search, Send, Route, Check, Users, HeartPulse, BedDouble, MessageSquare } from 'lucide-react';
import StatusPill from '../../components/domain/StatusPill.jsx';
import PatientDetailPopup from '../../components/domain/PatientDetailPopup.jsx';
import RequestForm from '../../components/domain/RequestForm.jsx';
import { FlowError, FlowSkeleton } from '../../components/domain/FlowUi.jsx';
import { StatTile, AcuityBadge } from '../../components/domain/CareUi.jsx';
import careApi from '../../api/careApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { useFlowPolling } from '../../hooks/useFlowPolling.js';
import { displayName } from '../../utils/flowFormat.js';

const FILTERS = [
  ['all', 'All'],
  ['critical', 'Acuity 1-2'],
  ['waiting', 'Waiting'],
  ['requests', 'Open requests'],
];
const COLS = 8;

export default function PatientsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [openForm, setOpenForm] = useState(null);
  const [sent, setSent] = useState({});
  const [popup, setPopup] = useState(null);
  const q = useFlowPolling(() => careApi.listPatients(), { intervalMs: 60000, refreshOn: ['patient.updated', 'bed.updated'] });
  const all = useMemo(() => q.data || [], [q.data]);

  const rows = useMemo(
    () =>
      all.filter((p) => {
        if (filter === 'critical' && p.acuity > 2) return false;
        if (filter === 'waiting' && p.status !== 'waiting') return false;
        if (filter === 'requests' && !p.openRequests) return false;
        return !search || `${p.alias} ${p.bedId} ${p.ward} ${p.doctorName} ${p.diagnosis}`.toLowerCase().includes(search.toLowerCase());
      }),
    [all, filter, search]
  );

  const onSent = (id) => {
    setOpenForm(null);
    setSent((s) => ({ ...s, [id]: true }));
    setTimeout(() => setSent((s) => ({ ...s, [id]: false })), 3000);
    q.refresh({ silent: true });
  };

  return (
    <div className="space-y-4">
      <FlowPageHeader
        title="Patients"
        subtitle="Admitted and waiting patients"
        showHealth={false}
        actions={
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input className="flow-input !pl-8" placeholder="Search patient, bed, doctor" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search patients" />
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Users} value={all.length} label="Patients" />
        <StatTile icon={HeartPulse} value={all.filter((p) => p.acuity <= 2).length} label="Acuity 1-2" tone="bad" />
        <StatTile icon={BedDouble} value={all.filter((p) => p.status === 'waiting').length} label="Waiting for bed" tone="warn" />
        <StatTile icon={MessageSquare} value={all.reduce((a, p) => a + p.openRequests, 0)} label="Open requests" tone="violet" />
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={clsx('flow-chip', filter === k ? 'bg-royal-500 text-white border-royal-500' : 'bg-cream-50 border-cream-200 text-ink-900 hover:bg-sunken')}>
            {l}
          </button>
        ))}
      </div>

      {q.error && !q.data && <FlowError message={q.error} onRetry={q.refresh} />}
      {!q.data && !q.error && <FlowSkeleton lines={10} />}

      {q.data && (
        <div className="table-wrap">
          <table className="mo-table">
            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col">Bed</th>
                <th scope="col">Days</th>
                <th scope="col">Acuity</th>
                <th scope="col">Status</th>
                <th scope="col">Doctor</th>
                <th scope="col">Request</th>
                <th scope="col" className="text-right">
                  Track
                </th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <tr>
                  <td colSpan={COLS} className="text-center text-ink-500 py-8">
                    No patients match
                  </td>
                </tr>
              )}
              {rows.map((p) => (
                <React.Fragment key={p.patientId}>
                  <tr className={clsx('cursor-pointer', openForm === p.patientId && 'bg-sunken')} onClick={() => setPopup(p.patientId)}>
                    <td>
                      <span className="font-semibold">{p.alias}</span>
                      <span className="block text-xs text-ink-500 truncate max-w-[220px]">{p.diagnosis}</span>
                    </td>
                    <td>
                      <span className="font-mono">{p.bedId || '—'}</span>
                      <span className="block text-xs text-ink-500 truncate max-w-[160px]">{p.ward}</span>
                    </td>
                    <td className="tabular-nums">{p.status === 'waiting' ? '—' : `Day ${p.daysAdmitted}`}</td>
                    <td>
                      <AcuityBadge level={p.acuity} size="xs" />
                    </td>
                    <td>
                      <StatusPill status={p.acuity <= 2 && p.status === 'admitted' ? 'critical' : p.status} size="xs" />
                    </td>
                    <td className="max-w-[160px] truncate">{p.doctorName}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {sent[p.patientId] ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-fg-ok">
                          <Check className="w-3.5 h-3.5" aria-hidden="true" /> Request Sent
                        </span>
                      ) : (
                        <button type="button" className={clsx('flow-btn-secondary !py-1', openForm === p.patientId && '!border-royal-500 !text-royal-500')} onClick={() => setOpenForm(openForm === p.patientId ? null : p.patientId)} aria-expanded={openForm === p.patientId}>
                          <Send className="w-3.5 h-3.5" aria-hidden="true" /> Send Request
                          {p.openRequests > 0 && <span className="ml-1 rounded-full bg-[#8B5CF6] px-1.5 text-[11px] text-white">{p.openRequests}</span>}
                        </button>
                      )}
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="flow-btn-ghost !py-1" onClick={() => navigate(`/admin/patient-journey/${p.patientId}`)}>
                        <Route className="w-3.5 h-3.5" aria-hidden="true" /> Track Patient
                      </button>
                    </td>
                  </tr>
                  {openForm === p.patientId && (
                    <tr className="!bg-sunken hover:!bg-sunken">
                      <td colSpan={COLS} className="!whitespace-normal">
                        <div className="animate-fade-in py-1">
                          <RequestForm patientId={p.patientId} alias={p.alias} createdBy={displayName(user)} onSent={() => onSent(p.patientId)} onCancel={() => setOpenForm(null)} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {popup && <PatientDetailPopup patientId={popup} onClose={() => setPopup(null)} onChanged={() => q.refresh({ silent: true })} />}
    </div>
  );
}
