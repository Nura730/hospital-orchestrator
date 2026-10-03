/**
 * @file BedInfoPanel.jsx
 * Small popup for a bed with no patient: ID, type, status, ward/floor, last cleaned, equipment.
 * Offers "Mark cleaning done" when the bed is waiting for housekeeping.
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Sparkles } from 'lucide-react';
import { FlowModal } from './FlowUi.jsx';
import StatusPill from './StatusPill.jsx';
import { Field, Chip } from './CareUi.jsx';
import flowApi from '../../api/flowApi.js';
import { errorText } from '../../hooks/useFlowPolling.js';
import { timeAgo } from '../../utils/flowFormat.js';

const TYPE_LABEL = { icu: 'ICU', hdu: 'HDU', ed: 'Emergency', general: 'General', isolation: 'Isolation', post_op: 'Post-op recovery' };

const EQUIPMENT = {
  icu: ['Ventilator', 'Cardiac monitor', 'Infusion pumps'],
  hdu: ['Cardiac monitor', 'Oxygen point'],
  ed: ['Monitor', 'Oxygen point', 'Suction'],
  isolation: ['Negative pressure', 'PPE station', 'Oxygen point'],
  post_op: ['Monitor', 'Oxygen point', 'Warming blanket'],
  general: ['Oxygen point', 'Call bell'],
};

export function BedInfoPanel({ bed, onClose, onChanged, allowActions = true }) {
  const [busy, setBusy] = useState(false);
  if (!bed) return null;
  const id = bed.id || bed.bedId || bed.bedNumber;
  const status = bed.status || 'available';
  const type = bed.type || null;
  const lastCleaned = bed.lastCleanedAt || bed.last_cleaned_at || null;
  const equipment = bed.equipmentAttached?.length ? bed.equipmentAttached : EQUIPMENT[type] || [];

  const markClean = async () => {
    setBusy(true);
    try {
      const r = await flowApi.postEvent('CLEANING_DONE', { bedId: id });
      toast.success(`${id} is ready`);
      onChanged?.(r);
      onClose();
    } catch (e) {
      toast.error(errorText(e, 'Could not update the bed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FlowModal
      open
      onClose={onClose}
      size="sm"
      title={`Bed ${id}`}
      subtitle={[bed.ward, bed.floor ? `Floor ${bed.floor}` : null].filter(Boolean).join(' · ') || bed.department}
      footer={
        <>
          {allowActions && status === 'cleaning' && (
            <button type="button" className="flow-btn-primary" disabled={busy} onClick={markClean}>
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> {busy ? 'Saving…' : 'Mark cleaning done'}
            </button>
          )}
          <button type="button" className="flow-btn-ghost" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <Field label="Status">
        <StatusPill status={status} size="xs" />
      </Field>
      <Field label="Bed type">{type ? TYPE_LABEL[type] || type : bed.department}</Field>
      <Field label="Last cleaned">{status === 'cleaning' ? `Waiting ${bed.cleaningSince ? timeAgo(bed.cleaningSince).replace(' ago', '') : ''}` : lastCleaned ? timeAgo(lastCleaned) : null}</Field>
      <Field label="Equipment">
        {equipment.length ? (
          <span className="flex flex-wrap justify-end gap-1">
            {equipment.map((e) => (
              <Chip key={e} color="#94A3B8">
                {e}
              </Chip>
            ))}
          </span>
        ) : null}
      </Field>
    </FlowModal>
  );
}

export default BedInfoPanel;
