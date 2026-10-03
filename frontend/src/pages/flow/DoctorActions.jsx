/**
 * @file DoctorActions.jsx
 * Quick actions for one patient: Request OT, Update status (acuity change → PATIENT_DETERIORATED),
 * Sign discharge (DISCHARGE_SIGNED).
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Scissors, Activity, LogOut } from 'lucide-react';
import { FlowModal } from '../../components/domain/FlowUi.jsx';
import flowApi from '../../api/flowApi.js';
import { errorText } from '../../hooks/useFlowPolling.js';

export function DoctorActions({ patient, onChanged }) {
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ot, setOt] = useState({ procedureName: '', urgency: 'urgent', durationMin: 90, notes: '' });
  const [status, setStatus] = useState({ newAcuity: Math.max(1, (patient.acuity || 3) - 1), requiresIcu: false, note: '' });

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      const r = await fn();
      toast.success(ok(r));
      setModal(null);
      onChanged?.();
    } catch (e) {
      toast.error(errorText(e, 'Action failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex gap-1">
      <button type="button" className="flow-btn-secondary !py-1 !px-2" onClick={() => setModal('ot')} title="Request OT">
        <Scissors className="w-3 h-3" aria-hidden="true" /> <span className="hidden xl:inline">Request OT</span>
      </button>
      <button type="button" className="flow-btn-secondary !py-1 !px-2" onClick={() => setModal('status')} title="Update status">
        <Activity className="w-3 h-3" aria-hidden="true" /> <span className="hidden xl:inline">Update status</span>
      </button>
      <button type="button" className="flow-btn-primary !py-1 !px-2" disabled={!patient.bedId} onClick={() => setModal('discharge')} title="Sign discharge">
        <LogOut className="w-3 h-3" aria-hidden="true" /> <span className="hidden xl:inline">Sign discharge</span>
      </button>

      <FlowModal
        open={modal === 'ot'}
        onClose={() => setModal(null)}
        size="sm"
        title={`Request OT: ${patient.alias}`}
        footer={
          <>
            <button type="button" className="flow-btn-ghost" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="flow-btn-primary"
              disabled={busy || !ot.procedureName.trim()}
              onClick={() => run(() => flowApi.requestOt({ patientId: patient.patientId, ...ot }), () => 'OT request sent for approval')}
            >
              {busy ? 'Sending…' : 'Send request'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold block mb-1" htmlFor="ot-proc">
              Procedure
            </label>
            <input id="ot-proc" className="flow-input" value={ot.procedureName} onChange={(e) => setOt({ ...ot, procedureName: e.target.value })} placeholder="e.g. Laparoscopic appendectomy" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1" htmlFor="ot-urg">
                Urgency
              </label>
              <select id="ot-urg" className="flow-input" value={ot.urgency} onChange={(e) => setOt({ ...ot, urgency: e.target.value })}>
                {['elective', 'urgent', 'emergency', 'critical'].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" htmlFor="ot-dur">
                Duration (min)
              </label>
              <input id="ot-dur" type="number" min={15} className="flow-input" value={ot.durationMin} onChange={(e) => setOt({ ...ot, durationMin: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" htmlFor="ot-notes">
              Notes
            </label>
            <textarea id="ot-notes" className="flow-input" rows={2} value={ot.notes} onChange={(e) => setOt({ ...ot, notes: e.target.value })} />
          </div>
        </div>
      </FlowModal>

      <FlowModal
        open={modal === 'status'}
        onClose={() => setModal(null)}
        size="sm"
        title={`Update status: ${patient.alias}`}
        subtitle={`Current acuity ${patient.acuity}. A lower number means more urgent.`}
        footer={
          <>
            <button type="button" className="flow-btn-ghost" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="flow-btn-danger"
              disabled={busy}
              onClick={() => run(() => flowApi.postEvent('PATIENT_DETERIORATED', { patientId: patient.patientId, ...status }), (r) => `Acuity set to ${r?.result?.acuity ?? status.newAcuity}${r?.result?.recommendation ? ' · ICU transfer suggested' : ''}`)}
            >
              {busy ? 'Saving…' : 'Update & re-run analysis'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold block mb-1" htmlFor="st-acuity">
              New acuity
            </label>
            <select id="st-acuity" className="flow-input" value={status.newAcuity} onChange={(e) => setStatus({ ...status, newAcuity: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((a) => (
                <option key={a} value={a}>
                  {a} {a === 1 ? '(resuscitation)' : a === 5 ? '(non-urgent)' : ''}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="accent-[#014BAA]" checked={status.requiresIcu} onChange={(e) => setStatus({ ...status, requiresIcu: e.target.checked })} /> Requires ICU care
          </label>
          <div>
            <label className="text-xs font-semibold block mb-1" htmlFor="st-note">
              Note
            </label>
            <input id="st-note" className="flow-input" value={status.note} onChange={(e) => setStatus({ ...status, note: e.target.value })} placeholder="Optional clinical note" />
          </div>
        </div>
      </FlowModal>

      <FlowModal
        open={modal === 'discharge'}
        onClose={() => setModal(null)}
        size="sm"
        title={`Sign discharge: ${patient.alias}`}
        subtitle={`Bed ${patient.bedId} goes to cleaning and housekeeping is notified.`}
        footer={
          <>
            <button type="button" className="flow-btn-ghost" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="button" className="flow-btn-primary" disabled={busy} onClick={() => run(() => flowApi.postEvent('DISCHARGE_SIGNED', { patientId: patient.patientId }), (r) => `Discharged · ${r?.result?.bedId} → cleaning (${r?.tookMs ?? '<1'} ms)`)}>
              {busy ? 'Signing…' : 'Sign discharge'}
            </button>
          </>
        }
      >
        <p className="text-xs text-ink-500">
          Readiness score {patient.readiness?.score ?? '—'}/100.
          {patient.readiness?.blockingFactors?.length ? ` Still open: ${patient.readiness.blockingFactors.join(', ')}.` : ' No blockers.'}
        </p>
      </FlowModal>
    </div>
  );
}

export default DoctorActions;
