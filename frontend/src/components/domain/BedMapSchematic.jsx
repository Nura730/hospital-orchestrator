/**
 * @file BedMapSchematic.jsx
 * Hospital bed map grouped by zone (ED, Radiology, General Ward, HDU, ICU, PACU, OT): header numbers,
 * legend with live counts and 48px bed cells. Clicking an occupied bed opens PatientDetailPopup, an empty
 * bed opens BedInfoPanel and a theatre opens BedDetailPopup.
 */

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Truck, Users, Sparkles, Wrench, LogOut } from 'lucide-react';
import BedTile from './BedTile.jsx';
import BedDetailPopup from './BedDetailPopup.jsx';
import BedInfoPanel from './BedInfoPanel.jsx';
import PatientDetailPopup from './PatientDetailPopup.jsx';
import flowApi from '../../api/flowApi.js';
import { errorText } from '../../hooks/useFlowPolling.js';
import { BED_STATUS_COLORS, BED_STATUS_LABELS } from '../../utils/flowFormat.js';

const ZONE_LABELS = {
  ED: 'Emergency',
  Radiology: 'Radiology',
  'General Ward': 'General Ward',
  HDU: 'HDU',
  ICU: 'ICU',
  PACU: 'Post-op Recovery',
  OT: 'Operating Theatres',
};

function InfoTile({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-cream-200 px-3 py-2 min-w-[150px] flex-1">
      <Icon className="w-4 h-4 text-ink-500 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-sm font-bold text-ink-900 tabular-nums">{value}</div>
        <div className="text-[10px] text-ink-500 truncate">
          {label}
          {sub ? ` · ${sub}` : ''}
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{ data: object, loading?: boolean, statusFilter?: string, search?: string, onChanged?: Function, compact?: boolean, allowActions?: boolean }} props
 */
export function BedMapSchematic({ data, loading = false, statusFilter = 'all', search = '', onChanged, compact = false, allowActions = true, showLegend = true }) {
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const q = search.trim().toUpperCase();
  const zones = useMemo(() => (data?.zones ? data.zones : []), [data]);

  if (loading && !data) {
    return (
      <div className="flow-card p-4 min-h-[320px]" aria-busy="true">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 flow-skeleton" />
          ))}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { header, legend = [], info } = data;
  const close = () => setSelected(null);
  const isRoom = selected?.kind === 'ot_room';
  const hasPatient = Boolean(selected && !isRoom && selected.patientId);

  const signDischarge = async () => {
    if (!selected?.patientId) return;
    setBusy(true);
    try {
      await flowApi.postEvent('DISCHARGE_SIGNED', { patientId: selected.patientId });
      toast.success(`Discharge signed for ${selected.patientAlias || 'patient'}`);
      onChanged?.();
      close();
    } catch (e) {
      toast.error(errorText(e, 'Could not sign discharge'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flow-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-bold tabular-nums text-ink-900">
            {header?.occupied ?? '—'}/{header?.totalBeds ?? '—'}
          </span>
          <span className="text-xs text-ink-500">beds · {Math.round(header?.occupancyPct ?? 0)}% occupied</span>
        </div>
        {showLegend && (
        <div className="flex flex-wrap gap-3" aria-label="Legend">
          {legend.map((l) => (
            <span key={l.status} className="inline-flex items-center gap-1.5 text-[11px] text-ink-500">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BED_STATUS_COLORS[l.status] }} aria-hidden="true" />
              {BED_STATUS_LABELS[l.status]} <b className="text-ink-900 tabular-nums">{l.count}</b>
            </span>
          ))}
        </div>
        )}
      </div>

      {/* Columns (not grid rows) so short zones don't leave empty space */}
      <div className={clsx('gap-3', compact ? 'columns-1 lg:columns-2' : 'columns-1 md:columns-2 xl:columns-3')}>
        {zones.map((z) => (
          <section key={z.zone} className="break-inside-avoid mb-3 rounded-lg border border-cream-200 p-3" aria-label={ZONE_LABELS[z.zone] || z.zone}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 className="label-xs">{ZONE_LABELS[z.zone] || z.zone}</h4>
              <span className="text-[10px] text-ink-500 tabular-nums">
                {z.counts?.occupied ?? 0}/{(z.counts?.total ?? 0) - (z.counts?.blocked ?? 0)}
                {z.counts?.cleaning > 0 && <span className="text-fg-warn"> · {z.counts.cleaning} cleaning</span>}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(z.tiles || []).map((t) => {
                const statusMiss = statusFilter !== 'all' && t.status !== statusFilter;
                const searchMiss = q && !String(t.id).toUpperCase().includes(q) && !String(t.patientAlias || '').toUpperCase().includes(q);
                return <BedTile key={t.id} tile={t} onSelect={setSelected} dimmed={statusMiss || Boolean(searchMiss)} highlighted={Boolean(q) && !searchMiss} />;
              })}
            </div>
          </section>
        ))}
      </div>

      {info && (
        <div className="flex flex-wrap gap-2">
          <InfoTile icon={Truck} label="In transit" value={(info.inTransit?.reservedBeds ?? 0) + (info.inTransit?.inSurgery ?? 0)} sub={`${info.inTransit?.inSurgery ?? 0} in surgery`} />
          <InfoTile icon={Users} label="Nurse ratio" value={info.nurseRatio?.ratio != null ? `1:${info.nurseRatio.ratio}` : '—'} sub={`${info.nurseRatio?.nurses ?? 0} nurses`} />
          <InfoTile icon={Sparkles} label="Cleaning queue" value={info.cleaningQueue?.beds ?? 0} sub={info.cleaningQueue?.beds ? `oldest ${info.cleaningQueue.oldestMinutes} min` : 'clear'} />
          {info.equipment && <InfoTile icon={Wrench} label="Equipment free" value={`${info.equipment.available}/${info.equipment.total}`} />}
        </div>
      )}

      {isRoom && <BedDetailPopup tile={selected} onClose={close} onChanged={onChanged} allowActions={allowActions} />}
      {hasPatient && (
        <PatientDetailPopup
          patientId={selected.patientId || null}
          bedInfo={selected}
          onClose={close}
          onChanged={onChanged}
          footer={
            allowActions && selected.status === 'occupied' ? (
              <button type="button" className="flow-btn-secondary" disabled={busy} onClick={signDischarge}>
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" /> {busy ? 'Signing…' : 'Sign discharge'}
              </button>
            ) : null
          }
        />
      )}
      {selected && !isRoom && !hasPatient && <BedInfoPanel bed={selected} onClose={close} onChanged={onChanged} allowActions={allowActions} />}
    </div>
  );
}

export default BedMapSchematic;
