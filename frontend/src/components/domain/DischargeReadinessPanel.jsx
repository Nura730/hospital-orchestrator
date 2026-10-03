/**
 * @file DischargeReadinessPanel.jsx
 * Reference B table: Patient, Acuity, Ward, Bed, Readiness bar (green > 70, amber 40-70, red < 40),
 * blocking chips, Notify Doctor, View Patient. Refreshes every 2 minutes and on discharge nudges.
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { ClipboardCheck, Bell, Eye } from 'lucide-react';
import { SectionHeader, FlowSkeleton, FlowEmpty, FlowError, ReadinessBar, FlowModal } from './FlowUi.jsx';
import StatusPill from './StatusPill.jsx';
import flowApi from '../../api/flowApi.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { dateTime, timeUntil } from '../../utils/flowFormat.js';

export function BlockingChips({ factors = [], max = 3 }) {
  if (!factors.length) return <span className="text-[11px] text-fg-ok font-semibold">No blockers</span>;
  return (
    <div className="flex flex-wrap gap-1 max-w-[280px]">
      {factors.slice(0, max).map((f) => (
        <span key={f} className="text-[10px] rounded-full bg-[#F59E0B]/15 text-fg-warn border border-[#F59E0B]/40 px-2 py-0.5 whitespace-nowrap">
          {f}
        </span>
      ))}
      {factors.length > max && <span className="text-[10px] text-ink-500">+{factors.length - max}</span>}
    </div>
  );
}

export function PatientDetailModal({ patient, onClose }) {
  if (!patient) return null;
  return (
    <FlowModal open onClose={onClose} size="sm" title={`Patient ${patient.alias}`} subtitle={`${patient.ward || ''} · Bed ${patient.bedId || '—'}`} footer={<button type="button" className="flow-btn-primary" onClick={onClose}>Close</button>}>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div><dt className="text-ink-500">Acuity</dt><dd className="font-bold">{patient.acuity}</dd></div>
        <div><dt className="text-ink-500">Doctor</dt><dd className="font-bold">{patient.doctorName || '—'}</dd></div>
        <div><dt className="text-ink-500">Admitted</dt><dd className="font-bold">{dateTime(patient.admittedAt)}</dd></div>
        <div><dt className="text-ink-500">Expected discharge</dt><dd className="font-bold">{dateTime(patient.expectedDischarge)}</dd></div>
        <div className="col-span-2"><dt className="text-ink-500 mb-1">Readiness</dt><dd><ReadinessBar score={patient.score} /></dd></div>
        <div className="col-span-2"><dt className="text-ink-500 mb-1">Blocking factors</dt><dd><BlockingChips factors={patient.blockingFactors} max={10} /></dd></div>
      </dl>
    </FlowModal>
  );
}

export function DischargeReadinessPanel({ limit = 10 }) {
  const [viewing, setViewing] = useState(null);
  const [notifying, setNotifying] = useState(null);
  const { data, loading, error, refresh } = useFlowPolling(() => flowApi.getDischargeCandidates(), {
    intervalMs: 120000,
    refreshOn: ['flow.dischargeNudge', 'patient.updated'],
  });

  const rows = (data?.candidates || []).slice(0, limit);

  const notify = async (p) => {
    setNotifying(p.patientId);
    try {
      const r = await flowApi.nudgeDischarges([p.patientId]);
      toast.success(`${p.doctorName || 'Doctor'} notified about ${p.alias}${r.notificationsSent ? '' : ' (no account linked)'}`);
    } catch (e) {
      toast.error(errorText(e, 'Could not notify doctor'));
    } finally {
      setNotifying(null);
    }
  };

  return (
    <div className="flow-card-pad">
      <SectionHeader
        title="Discharge readiness"
        subtitle={data ? `${data.readyCount} ready (≥ ${Math.round(data.threshold * 100)}%) · refreshes every 2 min` : 'Scoring every in-bed patient'}
        icon={ClipboardCheck}
      />
      {error && <FlowError message={error} onRetry={refresh} />}
      {loading && !data ? (
        <FlowSkeleton lines={5} height="h-9" />
      ) : rows.length === 0 ? (
        <FlowEmpty title="No in-bed patients" message="Nothing to score yet." />
      ) : (
        <div className="overflow-x-auto scrollbar-thin -mx-1">
          <table className="flow-table w-full min-w-[820px]">
            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col">Acuity</th>
                <th scope="col">Ward</th>
                <th scope="col">Bed</th>
                <th scope="col">Readiness</th>
                <th scope="col">Blocking</th>
                <th scope="col">Expected</th>
                <th scope="col" className="!text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.patientId} className={p.ready ? '!bg-highlight/50' : ''}>
                  <td className="font-bold text-royal-900">
                    {p.alias}
                    {p.ready && <StatusPill status="approved" label="Ready" size="xs" className="ml-1.5" />}
                  </td>
                  <td>
                    <StatusPill status={p.acuity <= 2 ? 'critical' : 'admitted'} label={`A${p.acuity}`} size="xs" />
                  </td>
                  <td className="text-ink-500">{p.ward}</td>
                  <td className="font-mono">{p.bedId}</td>
                  <td>
                    <ReadinessBar score={p.score} />
                  </td>
                  <td className="!whitespace-normal">
                    <BlockingChips factors={p.blockingFactors} />
                  </td>
                  <td className="text-ink-500">{timeUntil(p.expectedDischarge)}</td>
                  <td className="!text-right">
                    <div className="inline-flex gap-1">
                      <button type="button" className="flow-btn-secondary !py-1 !px-2" onClick={() => notify(p)} disabled={notifying === p.patientId}>
                        <Bell className="w-3 h-3" aria-hidden="true" /> {notifying === p.patientId ? '…' : 'Notify'}
                      </button>
                      <button type="button" className="flow-btn-ghost !py-1 !px-2" onClick={() => setViewing(p)} aria-label={`View patient ${p.alias}`}>
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PatientDetailModal patient={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

export default DischargeReadinessPanel;
