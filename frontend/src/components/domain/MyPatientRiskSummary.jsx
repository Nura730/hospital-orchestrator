/**
 * @file MyPatientRiskSummary.jsx
 * Doctor dashboard widget: risk counts across ONLY this doctor's patients, with the top risks listed.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, ArrowRight } from 'lucide-react';
import { SectionHeader, FlowSkeleton, FlowEmpty, ReadinessBar } from './FlowUi.jsx';
import StatusPill from './StatusPill.jsx';
import flowApi from '../../api/flowApi.js';
import { useFlowPolling } from '../../hooks/useFlowPolling.js';
import { timeUntil } from '../../utils/flowFormat.js';

export function MyPatientRiskSummary() {
  const { data, loading } = useFlowPolling(() => flowApi.getDoctorPatients(), { intervalMs: 60000, refreshOn: ['patient.updated', 'flow.dischargeNudge'] });
  const patients = data || [];
  const critical = patients.filter((p) => (p.acuity || 5) <= 2);
  const ready = patients.filter((p) => p.readiness.score >= 60);
  const longStay = patients.filter((p) => p.los.hoursRemaining > 48);

  return (
    <div className="flow-card-pad">
      <SectionHeader
        title="My patient risk summary"
        subtitle="Only your patients"
        icon={HeartPulse}
        actions={
          <Link to="/doctor/flow/predictions" className="flow-btn-ghost !py-1">
            Predictions <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </Link>
        }
      />
      {loading && !data ? (
        <FlowSkeleton lines={4} height="h-8" />
      ) : patients.length === 0 ? (
        <FlowEmpty title="No active patients" message="Patients assigned to you will appear here." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              ['Critical', critical.length, 'text-fg-bad'],
              ['Discharge-ready', ready.length, 'text-fg-ok'],
              ['Stay > 48h', longStay.length, 'text-royal-900'],
            ].map(([label, n, cls]) => (
              <div key={label} className="rounded-xl bg-cream-100 p-2.5 text-center">
                <div className={`text-2xl font-extrabold tabular-nums ${cls}`}>{n}</div>
                <div className="text-[11px] uppercase font-semibold text-ink-500">{label}</div>
              </div>
            ))}
          </div>
          <ul className="space-y-1.5">
            {[...critical, ...ready.filter((p) => !critical.includes(p))].slice(0, 5).map((p) => (
              <li key={p.patientId} className="flex items-center gap-2 rounded-lg border border-cream-200 px-2.5 py-1.5">
                <span className="text-xs font-bold text-royal-900 w-20">{p.alias}</span>
                <StatusPill status={p.acuity <= 2 ? 'critical' : 'approved'} label={p.acuity <= 2 ? `Acuity ${p.acuity}` : 'Ready'} size="xs" />
                <span className="text-xs text-ink-500 truncate flex-1">{p.bedId || 'no bed'} · discharge {timeUntil(p.expectedDischarge)}</span>
                <div className="w-28">
                  <ReadinessBar score={p.readiness.score} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default MyPatientRiskSummary;
