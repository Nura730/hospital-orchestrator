/**
 * @file RequestForm.jsx
 * Compact staff request form (admin patient rows and the patient popup): type, priority, short note.
 * Sends a notification to the relevant staff; "Urgent" also raises an alert.
 */

import React, { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Send, X, Loader2 } from 'lucide-react';
import careApi from '../../api/careApi.js';
import { errorText } from '../../hooks/useFlowPolling.js';

export const STAFF_REQUEST_TYPES = [
  ['doctor_review', 'Doctor Review Needed'],
  ['bed_transfer', 'Bed Transfer Required'],
  ['diagnostic_test', 'Diagnostic Test Required'],
  ['discharge_approval', 'Discharge Approval'],
  ['family_notification', 'Family Notification'],
  ['equipment', 'Equipment Needed'],
];

const PRIORITIES = [
  ['low', 'Low', '#475569'],
  ['medium', 'Medium', '#014BAA'],
  ['high', 'High', '#B45309'],
  ['urgent', 'Urgent', '#DC2626'],
];

const MAX = 150;

export function RequestForm({ patientId, alias, createdBy = 'Admin', onSent, onCancel, compact = false }) {
  const [type, setType] = useState(STAFF_REQUEST_TYPES[0][0]);
  const [priority, setPriority] = useState('medium');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await careApi.createRequest({ patientId, type, priority, note: note.trim(), source: 'staff', createdBy });
      toast.success(`${r.typeLabel} sent${alias ? ` for ${alias}` : ''}`);
      setNote('');
      onSent?.(r);
    } catch (err) {
      toast.error(errorText(err, 'Could not send request'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={clsx('grid gap-2.5', compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,2fr)_auto] md:items-end')}>
      <label className="block">
        <span className="label-xs block mb-1">Request type</span>
        <select className="flow-input" value={type} onChange={(e) => setType(e.target.value)}>
          {STAFF_REQUEST_TYPES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="label-xs mb-1">Priority</legend>
        <div className="inline-flex rounded-lg border border-cream-200 p-0.5 bg-cream-50">
          {PRIORITIES.map(([k, l, c]) => (
            <button
              key={k}
              type="button"
              onClick={() => setPriority(k)}
              aria-pressed={priority === k}
              className={clsx('px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors', priority === k ? 'text-white' : 'text-ink-500 hover:text-ink-900')}
              style={priority === k ? { backgroundColor: c } : undefined}
            >
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="label-xs flex justify-between mb-1">
          Note <span className="normal-case tracking-normal font-normal tabular-nums">{note.length}/{MAX}</span>
        </span>
        <input className="flow-input" maxLength={MAX} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short note for the team" />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="flow-btn-primary" disabled={busy}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Send className="w-3.5 h-3.5" aria-hidden="true" />} Send Request
        </button>
        {onCancel && (
          <button type="button" className="flow-btn-ghost" onClick={onCancel}>
            <X className="w-3.5 h-3.5" aria-hidden="true" /> Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default RequestForm;
