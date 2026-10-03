/**
 * @file DoctorAvailability.jsx
 * Two groups side by side: Available (specialty, surgeries today, Assign) and Busy (what each doctor is
 * doing right now and when they are expected to be free). Off-duty doctors are left out.
 */

import React from 'react';
import { UserPlus } from 'lucide-react';
import { MiniEmpty } from './CareUi.jsx';
import { clock } from '../../utils/flowFormat.js';

export function DoctorAvailability({ doctors = [], onAssign, assignLabel = 'Assign' }) {
  const available = doctors.filter((d) => d.available);
  const busy = doctors.filter((d) => !d.available && d.status !== 'off_duty');
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <section className="rounded-xl border border-cream-200 overflow-hidden">
        <h4 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-fg-ok bg-[#10B981]/10 border-b border-cream-200">Available ({available.length})</h4>
        {!available.length && <MiniEmpty text="No doctor free right now" />}
        <ul>
          {available.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2 border-b border-cream-200 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-900 truncate">{d.name}</span>
                <span className="block text-xs text-ink-500 truncate">{d.specialty}</span>
              </span>
              <span className="text-xs tabular-nums text-ink-500 whitespace-nowrap">
                {d.surgeriesToday}/{d.maxPerDay} today
              </span>
              {onAssign && (
                <button type="button" className="flow-btn-secondary !py-1 !px-2" onClick={() => onAssign(d)}>
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" /> {assignLabel}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-cream-200 overflow-hidden">
        <h4 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-fg-bad bg-[#EF4444]/10 border-b border-cream-200">Busy ({busy.length})</h4>
        {!busy.length && <MiniEmpty text="Nobody is busy" />}
        <ul>
          {busy.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2 border-b border-cream-200 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-900 truncate">{d.name}</span>
                <span className="block text-xs text-ink-500 truncate">{d.activity}</span>
              </span>
              <span className="text-xs text-ink-500 whitespace-nowrap">{d.freeAt ? `Free ~${clock(d.freeAt)}` : '—'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default DoctorAvailability;
