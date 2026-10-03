/**
 * @file BedMapSchematic.jsx
 * Reference C: dark navy hospital floor schematic with neon tiles grouped by zone (ED, Radiology,
 * General Ward, HDU, ICU, PACU, OT), header chips, legend with live counts and info cards.
 * Clicking a tile opens BedDetailPopup.
 */

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Activity, Truck, Users, Sparkles, Wrench } from 'lucide-react';
import BedTile from './BedTile.jsx';
import BedDetailPopup from './BedDetailPopup.jsx';
import { BED_STATUS_COLORS, BED_STATUS_LABELS } from '../../utils/flowFormat.js';

const ZONE_LABELS = {
  ED: 'Emergency Dept · triage pods & resus',
  Radiology: 'Radiology · imaging bays',
  'General Ward': 'General Ward · medical & isolation',
  HDU: 'High Dependency Unit',
  ICU: 'ICU · critical care pods',
  PACU: 'PACU · post-op recovery',
  OT: 'OT Suites',
};

function Chip({ children, tone = 'default' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide font-mono',
        tone === 'live' ? 'border-[#1FA971] text-[#5BE3A6] bg-[#1FA971]/10' : 'border-white/20 text-white bg-white/5'
      )}
    >
      {children}
    </span>
  );
}

function InfoCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 min-w-[150px] flex-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#9FB6D9]">
        <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {label}
      </div>
      <div className="text-lg font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-[#9FB6D9]">{sub}</div>}
    </div>
  );
}

/**
 * @param {{ data: object, loading?: boolean, statusFilter?: string, search?: string, onChanged?: Function, compact?: boolean, dark?: boolean }} props
 */
export function BedMapSchematic({ data, loading = false, statusFilter = 'all', search = '', onChanged, compact = false, allowActions = true }) {
  const [selected, setSelected] = useState(null);
  const q = search.trim().toUpperCase();

  const zones = useMemo(() => (data ? data.zones : []), [data]);

  if (loading && !data) {
    return (
      <div className="schematic-panel rounded-2xl p-5 min-h-[320px]" aria-busy="true">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { header, legend, info } = data;

  return (
    <div className="schematic-panel rounded-2xl p-4 md:p-5 text-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#5BE3A6]" aria-hidden="true" />
          <h3 className="text-sm font-bold tracking-wide">Live Hospital Map</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip>
            {header.occupied}/{header.totalBeds} BEDS
          </Chip>
          <Chip>{Math.round(header.occupancyPct)}% OCCUPANCY</Chip>
          <Chip tone={header.flowActive ? 'live' : 'default'}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', header.flowActive ? 'bg-[#5BE3A6] animate-pulse' : 'bg-white/40')} />
            {header.flowActive ? 'FLOW ACTIVE' : 'FLOW IDLE'}
          </Chip>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4" aria-label="Legend">
        {legend.map((l) => (
          <span key={l.status} className="inline-flex items-center gap-1.5 text-[11px] text-[#D5E2F5]">
            <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: `${BED_STATUS_COLORS[l.status]}55`, borderColor: BED_STATUS_COLORS[l.status] }} aria-hidden="true" />
            {BED_STATUS_LABELS[l.status]} <b className="text-white tabular-nums">{l.count}</b>
          </span>
        ))}
      </div>

      <div className={clsx('grid gap-4', compact ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3')}>
        {zones.map((z) => (
          <section key={z.zone} className="rounded-xl border border-white/10 bg-white/[0.03] p-3" aria-label={ZONE_LABELS[z.zone] || z.zone}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#9FB6D9]">{ZONE_LABELS[z.zone] || z.zone}</h4>
              <span className="text-[10px] font-mono text-[#D5E2F5] tabular-nums">
                {z.counts.occupied}/{z.counts.total - z.counts.blocked}
                {z.counts.cleaning > 0 && <span className="text-[#F2A93B]"> · {z.counts.cleaning} dirty</span>}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {z.tiles.map((t) => {
                const statusMiss = statusFilter !== 'all' && t.status !== statusFilter;
                const searchMiss = q && !t.id.toUpperCase().includes(q) && !(t.patientAlias || '').toUpperCase().includes(q);
                return <BedTile key={t.id} tile={t} size={compact ? 'sm' : 'md'} onSelect={setSelected} dimmed={statusMiss || Boolean(searchMiss)} highlighted={Boolean(q) && !searchMiss} />;
              })}
            </div>
          </section>
        ))}
      </div>

      {info && (
        <div className="flex flex-wrap gap-3 mt-4">
          <InfoCard icon={Truck} label="In transit" value={info.inTransit.reservedBeds + info.inTransit.inSurgery} sub={`${info.inTransit.reservedBeds} reserved · ${info.inTransit.inSurgery} in surgery`} />
          <InfoCard icon={Users} label="Nurse ratio" value={info.nurseRatio.ratio != null ? `1:${info.nurseRatio.ratio}` : '—'} sub={`${info.nurseRatio.nurses} nurses on shift`} />
          <InfoCard icon={Sparkles} label="Cleaning queue" value={info.cleaningQueue.beds} sub={info.cleaningQueue.beds ? `oldest ${info.cleaningQueue.oldestMinutes} min` : 'clear'} />
          {info.equipment && <InfoCard icon={Wrench} label="Equipment free" value={`${info.equipment.available}/${info.equipment.total}`} sub="sub-depot stock" />}
        </div>
      )}

      <BedDetailPopup tile={selected} onClose={() => setSelected(null)} onChanged={onChanged} allowActions={allowActions} />
    </div>
  );
}

export default BedMapSchematic;
