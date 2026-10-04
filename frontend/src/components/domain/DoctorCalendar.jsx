/**
 * @file DoctorCalendar.jsx
 * Doctor calendar built with CSS grid only (no library). Month view shows colored dots per event type;
 * clicking a day opens a panel with that day's events and an "Add Event" form. The panel sits beside the
 * calendar on wide screens and below it on phones, so every day stays clickable; its arrows (and the
 * Left/Right keys) step one day and move the calendar along. Week view shows 08:00-20:00 time slots.
 */

import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, X, Plus, MapPin } from 'lucide-react';
import careApi from '../../api/careApi.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { EventIcon, MiniEmpty } from './CareUi.jsx';
import { clock, EVENT_COLORS } from '../../utils/flowFormat.js';

const TYPE_LABEL = { consultation: 'Consultation', surgery: 'Surgery', rounds: 'Rounds', emergency: 'Emergency' };
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY = 86400000;
const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i); // 08:00 .. 20:00
const SLOT_PX = 44;

const dayStart = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const sameDay = (a, b) => dayStart(a).getTime() === dayStart(b).getTime();
const mondayOf = (d) => {
  const x = dayStart(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const key = (d) => dayStart(d).getTime();

function DayPanel({ date, events, onClose, onAdded, onStep }) {
  const [form, setForm] = useState({ time: '10:00', type: 'consultation', title: '', location: '' });
  const [busy, setBusy] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    const [h, m] = form.time.split(':').map(Number);
    const start = new Date(date);
    start.setHours(h, m, 0, 0);
    setBusy(true);
    try {
      await careApi.addDoctorEvent({ start: start.toISOString(), type: form.type, title: form.title || TYPE_LABEL[form.type], location: form.location, durationMin: form.type === 'surgery' ? 120 : 30 });
      toast.success('Event added and reminder sent');
      setForm((f) => ({ ...f, title: '', location: '' }));
      onAdded();
    } catch (err) {
      toast.error(errorText(err, 'Could not add event'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="flex flex-col bg-cream-50 border-t lg:border-t-0 lg:border-l border-cream-200 lg:max-h-[640px]" aria-label="Day details">
      <div className="flex items-center gap-1 px-3 py-3 border-b border-cream-200">
        <button type="button" className="flow-btn-ghost !p-1.5" onClick={() => onStep(-1)} aria-label="Previous day">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center min-w-0" aria-live="polite">
          <p className="text-sm font-bold text-ink-900 truncate">{date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          <p className="text-xs text-ink-500">{events.length} {events.length === 1 ? 'event' : 'events'}</p>
        </div>
        <button type="button" className="flow-btn-ghost !p-1.5" onClick={() => onStep(1)} aria-label="Next day">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button type="button" className="flow-btn-ghost !p-1.5" onClick={onClose} aria-label="Close day panel">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[120px]">
        {!events.length && <MiniEmpty text="No events" />}
        {events.map((e) => (
          <div key={e.id} className="flex items-start gap-2.5 rounded-lg border border-cream-200 px-3 py-2 border-l-4" style={{ borderLeftColor: EVENT_COLORS[e.type] }}>
            <EventIcon type={e.type} className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-900 truncate">{e.title}</p>
              <p className="text-xs text-ink-500">
                {clock(e.start)} to {clock(e.end)}
                {e.alias ? `, ${e.alias}` : ''}
              </p>
              {e.location && (
                <p className="text-xs text-ink-500 inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" aria-hidden="true" /> {e.location}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="border-t border-cream-200 p-3 space-y-2">
        <p className="label-xs">Add event</p>
        <div className="grid grid-cols-2 gap-2">
          <input type="time" className="flow-input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} aria-label="Time" required />
          <select className="flow-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} aria-label="Type">
            {Object.entries(TYPE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <input className="flow-input" placeholder="Title" maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Title" />
        <input className="flow-input" placeholder="Location" maxLength={40} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} aria-label="Location" />
        <button type="submit" className="flow-btn-primary w-full" disabled={busy}>
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add Event
        </button>
      </form>
    </aside>
  );
}

function MonthGrid({ cursor, byDay, selected, onSelect }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = mondayOf(first);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * DAY + 2 * 3600000));
  const today = new Date();
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-cream-200">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center label-xs">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const evs = byDay[key(d)] || [];
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const types = [...new Set(evs.map((e) => e.type))];
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelect(dayStart(d))}
              className={clsx(
                'min-h-[64px] sm:min-h-[76px] p-1.5 flex flex-col items-start justify-start text-left border-b border-r border-cream-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-royal-500',
                isToday ? 'bg-royal-500/10' : 'hover:bg-sunken',
                selected && sameDay(selected, d) && 'ring-2 ring-inset ring-royal-500',
                !inMonth && 'bg-sunken/70'
              )}
              aria-label={`${d.toDateString()}, ${evs.length} events`}
            >
              <span className={clsx('inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-semibold', isToday ? 'bg-royal-500 text-white' : inMonth ? 'text-ink-900' : 'text-ink-500')}>{d.getDate()}</span>
              <span className="flex flex-wrap gap-1 mt-1">
                {types.map((t) => (
                  <span key={t} className="w-2 h-2 rounded-full" style={{ backgroundColor: EVENT_COLORS[t] }} title={TYPE_LABEL[t]} />
                ))}
              </span>
              {evs.length > 0 && <span className={clsx('hidden sm:block text-[11px] mt-0.5', 'text-ink-500')}>{evs.length} {evs.length === 1 ? 'event' : 'events'}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ cursor, byDay, selected, onSelect }) {
  const monday = mondayOf(cursor);
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY + 2 * 3600000));
  const today = new Date();
  const nowTop = ((today.getHours() + today.getMinutes() / 60 - 8) * SLOT_PX);
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[720px]" style={{ gridTemplateColumns: '52px repeat(7, minmax(0, 1fr))' }}>
        <div className="border-b border-cream-200" />
        {days.map((d) => (
          <button key={d.toISOString()} type="button" onClick={() => onSelect(dayStart(d))} aria-pressed={Boolean(selected && sameDay(selected, d))} className={clsx('py-2 text-center border-b border-l border-cream-200 hover:bg-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-royal-500', sameDay(d, today) && 'bg-royal-500/10', selected && sameDay(selected, d) && 'ring-2 ring-inset ring-royal-500')}>
            <span className="label-xs block">{WEEKDAYS[(d.getDay() + 6) % 7]}</span>
            <span className={clsx('text-sm font-bold', sameDay(d, today) ? 'text-royal-500' : 'text-ink-900')}>{d.getDate()}</span>
          </button>
        ))}
        <div className="relative">
          {HOURS.map((h) => (
            <div key={h} className="text-[11px] text-ink-500 text-right pr-2 tabular-nums" style={{ height: SLOT_PX }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {days.map((d) => {
          const evs = (byDay[key(d)] || []).filter((e) => new Date(e.start).getHours() < 20 && new Date(e.end).getHours() >= 8);
          return (
            <div key={d.toISOString()} className="relative border-l border-cream-200" style={{ height: HOURS.length * SLOT_PX }}>
              {HOURS.map((h) => (
                <div key={h} className="border-b border-cream-200/60" style={{ height: SLOT_PX }} />
              ))}
              {sameDay(d, today) && nowTop >= 0 && nowTop <= HOURS.length * SLOT_PX && <div className="absolute left-0 right-0 h-px bg-[#EF4444] z-10" style={{ top: nowTop }} aria-hidden="true" />}
              {evs.map((e) => {
                const s = new Date(e.start);
                const en = new Date(e.end);
                const top = Math.max(0, (s.getHours() + s.getMinutes() / 60 - 8) * SLOT_PX);
                const height = Math.max(18, ((en - s) / 3600000) * SLOT_PX - 2);
                const color = EVENT_COLORS[e.type] || '#014BAA';
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onSelect(dayStart(d))}
                    className="absolute left-1 right-1 rounded-md px-1.5 py-1 text-left overflow-hidden text-[11px] leading-tight border-l-2"
                    style={{ top, height, backgroundColor: `${color}26`, borderLeftColor: color, color: 'rgb(var(--ink-900))' }}
                    title={`${e.title}, ${clock(e.start)} to ${clock(e.end)}`}
                  >
                    <span className="block font-semibold truncate">{e.title}</span>
                    <span className="block opacity-75 tabular-nums">{clock(e.start)}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DoctorCalendar() {
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(() => dayStart(new Date()));
  const [selected, setSelected] = useState(null);

  const [from, to] = useMemo(() => {
    if (view === 'week') {
      const m = mondayOf(cursor);
      return [m.getTime(), m.getTime() + 7 * DAY - 1];
    }
    const s = mondayOf(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    return [s.getTime(), s.getTime() + 42 * DAY - 1];
  }, [view, cursor]);

  const q = useFlowPolling(() => careApi.getDoctorEvents(from, to), { deps: [from, to] });
  const byDay = useMemo(() => {
    const m = {};
    for (const e of q.data || []) (m[key(e.start)] = m[key(e.start)] || []).push(e);
    return m;
  }, [q.data]);

  const move = (dir) => {
    const c = new Date(cursor);
    if (view === 'week') c.setDate(c.getDate() + dir * 7);
    else c.setMonth(c.getMonth() + dir, 1);
    setCursor(c);
  };

  // Select a day and keep it visible: the calendar follows when the day leaves the shown month/week
  const selectDay = (d) => {
    const day = dayStart(d);
    setSelected(day);
    const visible = view === 'week' ? sameDay(mondayOf(day), mondayOf(cursor)) : day.getMonth() === cursor.getMonth() && day.getFullYear() === cursor.getFullYear();
    if (!visible) setCursor(day);
  };
  const stepDay = (dir) => {
    if (!selected) return;
    const d = new Date(selected);
    d.setDate(d.getDate() + dir); // calendar arithmetic, safe across daylight-saving changes
    selectDay(d);
  };

  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') stepDay(-1);
      else if (e.key === 'ArrowRight') stepDay(1);
      else if (e.key === 'Escape') setSelected(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const title = view === 'week' ? `Week of ${mondayOf(cursor).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}` : cursor.toLocaleDateString([], { month: 'long', year: 'numeric' });

  return (
    <section className="flow-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-cream-200">
        <div className="flex items-center gap-1">
          <button type="button" className="flow-btn-ghost !p-1.5" onClick={() => move(-1)} aria-label="Previous">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" className="flow-btn-ghost !p-1.5" onClick={() => move(1)} aria-label="Next">
            <ChevronRight className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-bold text-ink-900 ml-1">{title}</h3>
          <button
            type="button"
            className="flow-btn-secondary !py-1 ml-2"
            onClick={() => {
              setCursor(dayStart(new Date()));
              if (selected) setSelected(dayStart(new Date()));
            }}
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3">
            {Object.entries(TYPE_LABEL).map(([k, l]) => (
              <span key={k} className="inline-flex items-center gap-1 text-xs text-ink-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EVENT_COLORS[k] }} /> {l}
              </span>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-cream-200 p-0.5">
            {['month', 'week'].map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={clsx('px-3 py-1 rounded-md text-xs font-semibold capitalize', view === v ? 'bg-royal-500 text-white' : 'text-ink-500 hover:text-ink-900')}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={clsx('grid grid-cols-1', selected && 'lg:grid-cols-[minmax(0,1fr)_320px]')}>
        <div className={clsx('min-w-0', q.loading && !q.data && 'opacity-50')}>
          {view === 'month' ? <MonthGrid cursor={cursor} byDay={byDay} selected={selected} onSelect={selectDay} /> : <WeekGrid cursor={cursor} byDay={byDay} selected={selected} onSelect={selectDay} />}
        </div>
        {selected && <DayPanel date={selected} events={byDay[key(selected)] || []} onClose={() => setSelected(null)} onAdded={() => q.refresh({ silent: true })} onStep={stepDay} />}
      </div>
    </section>
  );
}

export default DoctorCalendar;
