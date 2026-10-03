/**
 * @file CareUi.jsx
 * Compact building blocks shared by the care screens (doctor, nurse, patient, OT, admin):
 * StatTile, TabBar, AcuityDots, AcuityBadge, Avatar, EventIcon, TimelineList, ProgressLine, Field, MiniEmpty.
 * Icons are lucide-react components only (no emoji).
 */

import React from 'react';
import clsx from 'clsx';
import {
  LogIn,
  Stethoscope,
  FlaskConical,
  FileCheck2,
  Pill,
  Scissors,
  Activity,
  NotebookPen,
  LogOut,
  HeartPulse,
  Microscope,
  Users,
  Siren,
  CheckCircle2,
  Clock3,
  CircleDashed,
  Inbox,
  BedDouble,
  Truck,
  Sparkles,
  BellRing,
  ClipboardList,
} from 'lucide-react';
import { acuityColor, acuityTextColor, clock, initials } from '../../utils/flowFormat.js';

/* ── Stat tile: icon + number + label ───────────────────────────── */
const TONES = {
  default: 'text-royal-500 bg-royal-500/10',
  ok: 'text-fg-ok bg-[#10B981]/10',
  warn: 'text-fg-warn bg-[#F59E0B]/10',
  bad: 'text-fg-bad bg-[#EF4444]/10',
  violet: 'text-fg-violet bg-[#8B5CF6]/10',
};

export function StatTile({ icon: Icon, value, label, tone = 'default', sub, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx('flow-card flex items-center gap-3 p-3 text-left min-w-0', onClick && 'hover:border-royal-500/40 transition-colors')}
    >
      {Icon && (
        <span className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', TONES[tone] || TONES.default)}>
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-xl font-bold leading-tight tabular-nums text-ink-900 truncate">{value ?? '—'}</span>
        <span className="block text-[11px] text-ink-500 truncate">
          {label}
          {sub ? <span className="ml-1 text-ink-500/80">· {sub}</span> : null}
        </span>
      </span>
    </Tag>
  );
}

/* ── Tabs (underline) ───────────────────────────────────────────── */
export function TabBar({ tabs, active, onChange, className = '' }) {
  return (
    <div role="tablist" className={clsx('flex items-center gap-1 border-b border-cream-200 overflow-x-auto no-scrollbar', className)}>
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={clsx(
              'relative -mb-px inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors',
              isActive ? 'border-royal-500 text-royal-500' : 'border-transparent text-ink-500 hover:text-ink-900'
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
            {t.label}
            {t.count !== undefined && t.count !== null && (
              <span className={clsx('rounded-full px-1.5 text-[10px] tabular-nums', isActive ? 'bg-royal-500 text-white' : 'bg-sunken text-ink-500')}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Acuity ─────────────────────────────────────────────────────── */
/** Five circles; the first `6 - level` are filled (acuity 1 = most critical = 5 filled). */
export function AcuityDots({ level }) {
  const filled = level ? 6 - level : 0;
  const color = acuityColor(level);
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`Acuity ${level ?? 'unknown'} of 5 (1 is most critical)`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="w-3 h-3 rounded-full border" style={i <= filled ? { backgroundColor: color, borderColor: color } : { borderColor: 'rgb(var(--cream-200))' }} />
      ))}
    </span>
  );
}

export function AcuityBadge({ level, size = 'sm' }) {
  if (!level) return null;
  const color = acuityColor(level);
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap', size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]')}
      style={{ color: acuityTextColor(level), borderColor: `${color}55`, backgroundColor: `${color}14` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      Acuity {level}
    </span>
  );
}

export function AcuityDot({ level }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: acuityColor(level) }} title={level ? `Acuity ${level}` : 'No patient'} aria-hidden="true" />;
}

/* ── Avatar ─────────────────────────────────────────────────────── */
export function Avatar({ name, color = '#014BAA', size = 'md' }) {
  return (
    <span
      className={clsx('rounded-full text-white font-bold flex items-center justify-center shrink-0', size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs')}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/* ── Event icons ────────────────────────────────────────────────── */
const EVENT_META = {
  admission: { icon: LogIn, label: 'Admission', color: '#014BAA' },
  consultation: { icon: Stethoscope, label: 'Consultation', color: '#014BAA' },
  test_ordered: { icon: FlaskConical, label: 'Test ordered', color: '#8B5CF6' },
  test_result: { icon: FileCheck2, label: 'Test result', color: '#8B5CF6' },
  medication: { icon: Pill, label: 'Medication', color: '#10B981' },
  procedure: { icon: Scissors, label: 'Procedure', color: '#8B5CF6' },
  status_change: { icon: Activity, label: 'Status change', color: '#F59E0B' },
  doctor_note: { icon: NotebookPen, label: 'Note', color: '#94A3B8' },
  discharge: { icon: LogOut, label: 'Discharge', color: '#10B981' },
  vitals: { icon: HeartPulse, label: 'Vitals', color: '#EF4444' },
  test: { icon: Microscope, label: 'Test', color: '#8B5CF6' },
  rounds: { icon: Users, label: 'Rounds', color: '#10B981' },
  surgery: { icon: Scissors, label: 'Surgery', color: '#8B5CF6' },
  emergency: { icon: Siren, label: 'Emergency', color: '#EF4444' },
  clean_bed: { icon: Sparkles, label: 'Clean bed', color: '#F59E0B' },
  transport: { icon: Truck, label: 'Transport', color: '#014BAA' },
  document: { icon: ClipboardList, label: 'Documentation', color: '#94A3B8' },
  notify_doctor: { icon: BellRing, label: 'Doctor notification', color: '#EF4444' },
  bed: { icon: BedDouble, label: 'Bed', color: '#014BAA' },
};

export function EventIcon({ type, className = 'w-3.5 h-3.5' }) {
  const meta = EVENT_META[type] || EVENT_META.doctor_note;
  const Icon = meta.icon;
  return <Icon className={className} style={{ color: meta.color }} aria-hidden="true" />;
}

export function StatusIcon({ status, className = 'w-4 h-4' }) {
  if (status === 'done' || status === 'completed') return <CheckCircle2 className={clsx(className, 'text-[#10B981]')} aria-label="Done" />;
  if (status === 'in_progress') return <Clock3 className={clsx(className, 'text-[#014BAA]')} aria-label="In progress" />;
  return <CircleDashed className={clsx(className, 'text-ink-500')} aria-label="Scheduled" />;
}

/** Vertical list of { at, label|description, type, status, by } items. Current item gets a blue left border. */
export function TimelineList({ items, emptyText = 'Nothing scheduled', showStatus = true }) {
  if (!items?.length) return <MiniEmpty text={emptyText} />;
  return (
    <ol className="space-y-1.5">
      {items.map((e, i) => (
        <li
          key={`${e.at}-${i}`}
          className={clsx(
            'flex items-start gap-2.5 rounded-lg px-2.5 py-2 border-l-2',
            e.status === 'in_progress' ? 'border-royal-500 bg-royal-500/5' : 'border-transparent',
            e.status === 'done' && 'opacity-70'
          )}
        >
          {showStatus ? <StatusIcon status={e.status} className="w-4 h-4 mt-px shrink-0" /> : <EventIcon type={e.type} className="w-4 h-4 mt-px shrink-0" />}
          <span className="text-[11px] font-semibold tabular-nums text-ink-500 w-10 shrink-0 mt-px">{clock(e.at)}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-ink-900">
              {showStatus && <EventIcon type={e.type} />}
              <span className="truncate">{e.label || e.description}</span>
            </span>
            {e.by && <span className="block text-[11px] text-ink-500 truncate">{e.by}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ── Misc ───────────────────────────────────────────────────────── */
export function ProgressLine({ value, color = '#014BAA', label }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="w-full">
      <div className="h-1.5 w-full rounded-full bg-sunken overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[11px] text-ink-500 shrink-0">{label}</span>
      <span className="text-xs font-medium text-ink-900 text-right min-w-0">{children ?? '—'}</span>
    </div>
  );
}

export function MiniEmpty({ text = 'Nothing to show', icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center">
      <Icon className="w-5 h-5 text-ink-500" aria-hidden="true" />
      <span className="text-xs text-ink-500">{text}</span>
    </div>
  );
}

export function Chip({ children, color = '#014BAA', icon: Icon }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ color, borderColor: `${color}55`, backgroundColor: `${color}14` }}>
      {Icon && <Icon className="w-3 h-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function PanelTitle({ children, count, action }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2.5">
      <h3 className="label-xs flex items-center gap-1.5">
        {children}
        {count !== undefined && <span className="rounded-full bg-sunken px-1.5 text-[10px] tabular-nums text-ink-900">{count}</span>}
      </h3>
      {action}
    </div>
  );
}

/* ── ICU risk from the trained model (ml/icu_need) ──────────────── */
const ICU_LEVEL = {
  high: { text: '#991B1B', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.35)', label: 'High' },
  watch: { text: '#92400E', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.40)', label: 'Watch' },
  low: { text: '#046C4E', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.35)', label: 'Low' },
};

/** "ICU 87%" pill; the tooltip lists the model's main reasons. */
export function IcuRiskBadge({ risk, size = 'sm', showLabel = false }) {
  if (!risk) return <span className="text-ink-500">—</span>;
  const s = ICU_LEVEL[risk.level] || ICU_LEVEL.low;
  const why = (risk.factors || []).map((f) => `${f.factor} ${f.direction === 'up' ? 'raises' : 'lowers'} risk`).join(' · ');
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap tabular-nums', size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]')}
      style={{ color: s.text, backgroundColor: s.bg, borderColor: s.border }}
      title={`ICU need predicted by model: ${Math.round(risk.probability * 100)}%${why ? ` (${why})` : ''}`}
    >
      <HeartPulse className="w-3 h-3" aria-hidden="true" />
      {showLabel ? `${s.label} · ` : ''}
      {Math.round(risk.probability * 100)}%
    </span>
  );
}
