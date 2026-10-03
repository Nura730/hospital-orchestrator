/**
 * @file BedDetailPopup.jsx
 * Bed / theatre details: patient alias, acuity, admitted at, expected release, doctor, cleaning status.
 * Optional actions: "Mark cleaning done" (CLEANING_DONE) and "Sign discharge" (DISCHARGE_SIGNED).
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Sparkles, LogOut } from 'lucide-react';
import { FlowModal } from './FlowUi.jsx';
import StatusPill from './StatusPill.jsx';
import PredictionConfidenceBadge from './PredictionConfidenceBadge.jsx';
import flowApi from '../../api/flowApi.js';
import { errorText } from '../../hooks/useFlowPolling.js';
import { dateTime, timeAgo, timeUntil } from '../../utils/flowFormat.js';

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-cream-200 last:border-0">
      <span className="text-xs text-ink-500">{label}</span>
      <span className="text-xs font-semibold text-ink-900 text-right">{children ?? '—'}</span>
    </div>
  );
}

export function BedDetailPopup({ tile, onClose, onChanged, allowActions = true }) {
  const [busy, setBusy] = useState(null);
  if (!tile) return null;
  const isRoom = tile.kind === 'ot_room';

  const fire = async (eventType, payload, label) => {
    setBusy(eventType);
    try {
      const res = await flowApi.postEvent(eventType, payload);
      toast.success(`${label} (${res?.tookMs ?? '<1'} ms)`);
      if (eventType === 'CLEANING_DONE' && res?.result?.recommendation) toast(`Suggested: ${res.result.recommendation.title}`, { icon: '💡' });
      onChanged?.(res);
      onClose();
    } catch (e) {
      toast.error(errorText(e, `${label} failed`));
    } finally {
      setBusy(null);
    }
  };

  return (
    <FlowModal
      open={Boolean(tile)}
      onClose={onClose}
      size="sm"
      title={isRoom ? `${tile.id} (${tile.name})` : `Bed ${tile.id}`}
      subtitle={isRoom ? 'Operating theatre' : `${tile.ward || ''}${tile.floor ? ` · Floor ${tile.floor}` : ''}`}
      footer={
        allowActions && !isRoom ? (
          <>
            {tile.status === 'cleaning' && (
              <button type="button" className="flow-btn-primary" disabled={!!busy} onClick={() => fire('CLEANING_DONE', { bedId: tile.id }, `${tile.id} marked clean`)}>
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> {busy ? 'Saving…' : 'Mark cleaning done'}
              </button>
            )}
            {tile.status === 'occupied' && tile.patientId && (
              <button type="button" className="flow-btn-secondary" disabled={!!busy} onClick={() => fire('DISCHARGE_SIGNED', { patientId: tile.patientId }, `Discharge signed for ${tile.patientAlias}`)}>
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" /> {busy ? 'Signing…' : 'Sign discharge'}
              </button>
            )}
            <button type="button" className="flow-btn-ghost" onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <button type="button" className="flow-btn-primary" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      <div className="flex items-center gap-2 mb-3">
        <StatusPill status={tile.status} />
        {tile.acuity && <StatusPill status={tile.acuity <= 2 ? 'critical' : 'admitted'} label={`Acuity ${tile.acuity}`} />}
      </div>
      <Row label="Patient alias">{tile.patientAlias}</Row>
      {isRoom && <Row label="Case">{tile.caseNumber ? `${tile.caseNumber}: ${tile.procedure}` : null}</Row>}
      <Row label={isRoom ? 'Surgeon' : 'Assigned doctor'}>{tile.doctorName}</Row>
      {!isRoom && <Row label="Admitted at">{tile.admittedAt ? dateTime(tile.admittedAt) : null}</Row>}
      <Row label={isRoom ? 'Expected end' : 'Expected release'}>
        {tile.expectedRelease ? (
          <span className="inline-flex items-center gap-2">
            {dateTime(tile.expectedRelease)} <span className="text-ink-500 font-normal">({timeUntil(tile.expectedRelease)})</span>
          </span>
        ) : null}
      </Row>
      {tile.releaseConfidence != null && (
        <Row label="Release confidence">
          <PredictionConfidenceBadge confidence={tile.releaseConfidence} />
        </Row>
      )}
      <Row label="Cleaning status">
        {tile.status === 'cleaning'
          ? `Waiting ${tile.cleaningSince ? timeAgo(tile.cleaningSince).replace(' ago', '') : ''}`
          : tile.lastCleanedAt
            ? `Cleaned ${timeAgo(tile.lastCleanedAt)}`
            : null}
      </Row>
    </FlowModal>
  );
}

export default BedDetailPopup;
