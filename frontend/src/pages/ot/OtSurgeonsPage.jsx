/**
 * @file OtSurgeonsPage.jsx
 * /ot/surgeons: who can operate and when. Each surgeon's live status, what they are doing now, when
 * they are free, and a timeline of today's cases. Updates live when doctors change status or cases move.
 */

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { UserCheck, UserX, Activity, Search } from 'lucide-react';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import StatusPill from '../../components/domain/StatusPill.jsx';
import { FlowError, FlowSkeleton } from '../../components/domain/FlowUi.jsx';
import { StatTile, Avatar, MiniEmpty } from '../../components/domain/CareUi.jsx';
import careApi from '../../api/careApi.js';
import { useFlowPolling } from '../../hooks/useFlowPolling.js';
import { clock } from '../../utils/flowFormat.js';

const PRESENCE = { available: ['online', 'Available'], in_surgery: ['in_surgery', 'In surgery'], in_consultation: ['in_consultation', 'In consultation'], on_break: ['on_break', 'On break'], emergency: ['emergency', 'Emergency'], off_duty: ['off_duty', 'Off duty'] };
const CASE_COLOR = { in_progress: '#6D28D9', scheduled: '#014BAA', completed: '#047857' };
const DAY_START = 6;
const DAY_END = 24;

function DayBar({ cases }) {
  const day = new Date();
  day.setHours(DAY_START, 0, 0, 0);
  const span = (DAY_END - DAY_START) * 3600000;
  const now = ((Date.now() - day.getTime()) / span) * 100;
  return (
    <div className="relative h-7 rounded-lg bg-sunken overflow-hidden" role="img" aria-label={`Today's cases: ${cases.length ? cases.map((c) => `${c.room} ${clock(c.start)} to ${clock(c.end)}`).join(', ') : 'none'}`}>
      {[...Array(DAY_END - DAY_START + 1)].map((_, i) => (
        <span key={i} className="absolute top-0 bottom-0 w-px bg-cream-200" style={{ left: `${(i / (DAY_END - DAY_START)) * 100}%` }} aria-hidden="true" />
      ))}
      {cases.map((c) => {
        const left = ((new Date(c.start).getTime() - day.getTime()) / span) * 100;
        const width = ((new Date(c.end).getTime() - new Date(c.start).getTime()) / span) * 100;
        return (
          <span
            key={c.id}
            className="absolute top-1 bottom-1 rounded-md text-xs leading-5 px-1.5 text-white truncate"
            style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(1.5, width)}%`, backgroundColor: CASE_COLOR[c.status] || '#475569' }}
            title={`${c.procedure}, ${c.room}, ${clock(c.start)} to ${clock(c.end)}`}
          >
            {c.room}
          </span>
        );
      })}
      {now >= 0 && now <= 100 && <span className="absolute top-0 bottom-0 w-0.5 bg-[#DC2626]" style={{ left: `${now}%` }} aria-hidden="true" />}
    </div>
  );
}

export default function OtSurgeonsPage() {
  const [filter, setFilter] = useState('surgical');
  const [search, setSearch] = useState('');
  const q = useFlowPolling(() => careApi.getOtBoard(), { intervalMs: 60000 });
  const doctors = useMemo(() => q.data?.doctors || [], [q.data]);
  const cases = useMemo(() => q.data?.cases || [], [q.data]);
  const SURGICAL = /surg|ortho|anesth|trauma|cardio/i;
  const list = doctors
    .filter((d) => (filter === 'surgical' ? SURGICAL.test(d.specialty) : filter === 'free' ? d.available : true))
    .filter((d) => !search || `${d.name} ${d.specialty}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name));

  return (
    <div>
      <FlowPageHeader
        title="Surgeons"
        subtitle="Who can operate now, what busy surgeons are doing, and today's theatre schedule per surgeon"
        showHealth={false}
        actions={
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input className="flow-input !pl-9 !text-sm" placeholder="Search surgeon" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search surgeons" />
          </div>
        }
      />
      {q.error && !q.data && <FlowError message={q.error} onRetry={q.refresh} />}
      {!q.data && !q.error && <FlowSkeleton lines={8} />}
      {q.data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <StatTile icon={UserCheck} value={doctors.filter((d) => d.available).length} label="Available now" tone="ok" />
            <StatTile icon={Activity} value={doctors.filter((d) => d.status === 'in_surgery').length} label="In surgery" tone="violet" />
            <StatTile icon={UserX} value={doctors.filter((d) => d.status === 'off_duty').length} label="Off duty" />
          </div>
          <div className="inline-flex rounded-lg border border-cream-200 bg-cream-50 p-0.5 mb-4" role="group" aria-label="Show">
            {[
              ['surgical', 'Surgical team'],
              ['free', 'Free now'],
              ['all', 'All doctors'],
            ].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={clsx('px-3 py-1.5 rounded-md text-sm font-semibold', filter === k ? 'bg-royal-500 text-white' : 'text-ink-500 hover:text-ink-900')}>
                {l}
              </button>
            ))}
          </div>
          {!list.length && (
            <div className="flow-card">
              <MiniEmpty text="No surgeons match" />
            </div>
          )}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {list.map((d) => {
              const [pill, label] = PRESENCE[d.status] || PRESENCE.available;
              const mine = cases.filter((c) => c.surgeon === d.name);
              const next = mine.filter((c) => c.status === 'scheduled').sort((a, b) => new Date(a.start) - new Date(b.start))[0];
              return (
                <article key={d.id} className="flow-card p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={d.name} color={d.available ? '#047857' : d.status === 'off_duty' ? '#475569' : '#6D28D9'} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-ink-900">{d.name}</h3>
                        <StatusPill status={pill} label={label} />
                      </div>
                      <p className="text-sm text-ink-500">{d.specialty}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-3 mt-4">
                    <div>
                      <dt className="text-xs text-ink-500">Doing now</dt>
                      <dd className="text-sm font-semibold text-ink-900">{d.activity}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-500">Free</dt>
                      <dd className="text-sm font-semibold text-ink-900">{d.available ? 'Now' : d.freeAt ? `About ${clock(d.freeAt)}` : 'Not today'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-500">Cases today</dt>
                      <dd className="text-sm font-semibold text-ink-900">
                        {mine.length}
                        {next ? <span className="font-normal text-ink-500"> (next {clock(next.start)})</span> : null}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-ink-500 mb-1 tabular-nums">
                      <span>{String(DAY_START).padStart(2, '0')}:00</span>
                      <span>12:00</span>
                      <span>18:00</span>
                      <span>24:00</span>
                    </div>
                    <DayBar cases={mine} />
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
