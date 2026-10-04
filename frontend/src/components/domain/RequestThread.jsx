/**
 * @file RequestThread.jsx
 * Where a request is in its life: a step tracker (Sent, Seen, In progress, Scheduled, Resolved) and the
 * history of who did what and when. Used by patients, doctors, OT and admin.
 */

import React from 'react';
import clsx from 'clsx';
import { Send, Eye, Loader, CalendarCheck, CheckCircle2, XCircle, ArrowRight, Reply } from 'lucide-react';
import { clock, timeAgo } from '../../utils/flowFormat.js';

const STEPS = [
  ['new', 'Sent', Send],
  ['acknowledged', 'Seen', Eye],
  ['in_progress', 'In progress', Loader],
  ['scheduled', 'Scheduled', CalendarCheck],
  ['done', 'Resolved', CheckCircle2],
];
const ORDER = STEPS.map(([k]) => k);

export const REQUEST_STATUS_LABEL = { new: 'Sent', acknowledged: 'Seen', in_progress: 'In progress', scheduled: 'Scheduled', done: 'Resolved', declined: 'Declined' };

export function RequestSteps({ status, compact = false }) {
  const declined = status === 'declined';
  const idx = declined ? -1 : ORDER.indexOf(status);
  if (declined) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#EF4444]/10 px-2.5 py-1 text-xs font-semibold text-fg-bad">
        <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> Declined
      </div>
    );
  }
  return (
    <ol className="flex items-center w-full" aria-label={`Request status: ${REQUEST_STATUS_LABEL[status] || status}`}>
      {STEPS.map(([key, label, Icon], i) => {
        const done = i <= idx;
        const current = i === idx;
        return (
          <li key={key} className="flex items-center flex-1 last:flex-none min-w-0">
            <span className="flex flex-col items-center gap-1 shrink-0">
              <span
                className={clsx(
                  'rounded-full flex items-center justify-center border-2 transition-colors',
                  compact ? 'w-6 h-6' : 'w-8 h-8',
                  done ? 'bg-royal-500 border-royal-500 text-white' : 'bg-cream-50 border-cream-200 text-ink-500',
                  current && 'ring-4 ring-royal-500/20'
                )}
              >
                <Icon className={compact ? 'w-3 h-3' : 'w-4 h-4'} aria-hidden="true" />
              </span>
              {!compact && <span className={clsx('text-xs font-semibold whitespace-nowrap', done ? 'text-ink-900' : 'text-ink-500')}>{label}</span>}
            </span>
            {i < STEPS.length - 1 && <span className={clsx('h-0.5 flex-1 mx-1.5 rounded-full', i < idx ? 'bg-royal-500' : 'bg-cream-200', !compact && '-mt-5')} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

export function RequestHistory({ history = [] }) {
  if (!history.length) return null;
  return (
    <ol className="relative border-l-2 border-cream-200 ml-2 space-y-3">
      {[...history].reverse().map((h, i) => (
        <li key={`${h.at}-${i}`} className="relative pl-4">
          <span className={clsx('absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-cream-50', i === 0 ? 'bg-royal-500' : 'bg-cream-200')} aria-hidden="true" />
          <p className="text-sm text-ink-900">{h.text}</p>
          <p className="text-xs text-ink-500 mt-0.5">
            {h.by} <span className="mx-1 text-cream-200">|</span> {clock(h.at)} <span>({timeAgo(h.at)})</span>
          </p>
        </li>
      ))}
    </ol>
  );
}

const REPLY_ROLE = { doctor: 'Doctor', patient: 'Patient', nurse: 'Bedside nurse' };

/**
 * Where a theatre request came from and who hears back:
 * "Patient PF020 (General Query) -> Dr. Sarah Lin -> Theatre team", then "Answer goes to: ...".
 * @param {{ o: object, compact?: boolean }} props  o = an OT request from careApi.listOtRequests()
 */
export function RequestPath({ o, compact = false }) {
  const chain = [
    ...(o.origin?.source === 'patient' ? [`Patient ${o.alias}${compact ? '' : ` (${o.origin.type})`}`] : []),
    o.requestedBy?.name || 'Doctor',
    'Theatre team',
  ];
  const reply = o.replyTo || [];
  return (
    <div className={clsx('space-y-2', compact ? 'text-xs' : 'text-sm')}>
      <p className="flex flex-wrap items-center gap-1.5" aria-label={`Request path: ${chain.join(', then ')}`}>
        {chain.map((step, i) => (
          <React.Fragment key={step}>
            {i > 0 && <ArrowRight className="w-3.5 h-3.5 text-ink-500 shrink-0" aria-hidden="true" />}
            <span className={clsx('rounded-md px-2 py-0.5 font-semibold', i === chain.length - 1 ? 'bg-[#8B5CF6]/10 text-fg-violet' : 'bg-sunken text-ink-900')}>{step}</span>
          </React.Fragment>
        ))}
      </p>
      {reply.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-ink-500">
          <Reply className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Answer goes to</span>
          {reply.map((r) => (
            <span key={`${r.role}-${r.name}`} className="rounded-md border border-cream-200 px-2 py-0.5 text-ink-900">
              {r.name}
              {!compact && <span className="text-ink-500"> ({REPLY_ROLE[r.role] || r.role})</span>}
            </span>
          ))}
        </p>
      )}
      {!compact && o.origin?.note && <p className="text-ink-500 italic">Patient wrote: "{o.origin.note}"</p>}
    </div>
  );
}

export default RequestSteps;
