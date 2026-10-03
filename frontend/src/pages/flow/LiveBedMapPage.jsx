/**
 * @file LiveBedMapPage.jsx
 * /admin/beds-overview (Reference C): full schematic of every zone with legend counts and bed popups.
 * Extras: status filter, bed-ID search, "Mark cleaning done" (fires CLEANING_DONE) from the bed popup and
 * a quick list of dirty beds.
 */

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Search, Sparkles } from 'lucide-react';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import BedMapSchematic from '../../components/domain/BedMapSchematic.jsx';
import { FlowError } from '../../components/domain/FlowUi.jsx';
import flowApi from '../../api/flowApi.js';
import { useLiveStore } from '../../store/liveStore.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { BED_STATUS_COLORS, BED_STATUS_LABELS } from '../../utils/flowFormat.js';

const FILTERS = ['all', 'available', 'occupied', 'cleaning', 'reserved', 'blocked'];

export default function LiveBedMapPage() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [cleaning, setCleaning] = useState(null);
  const bedMap = useLiveStore((s) => s.flowState.bedMap);
  const setFlowState = useLiveStore((s) => s.setFlowState);
  const q = useFlowPolling(() => flowApi.getBedMap(), { intervalMs: 60000, refreshOn: ['ot.caseCompleted', 'patient.updated', 'flow.analysisComplete'] });

  useEffect(() => {
    if (q.data) setFlowState({ bedMap: q.data });
  }, [q.data, setFlowState]);

  const data = bedMap || q.data;
  const dirty = data ? data.zones.flatMap((z) => z.tiles.filter((t) => t.status === 'cleaning' && t.kind === 'bed')) : [];

  const markClean = async (bedId) => {
    setCleaning(bedId);
    try {
      const r = await flowApi.postEvent('CLEANING_DONE', { bedId });
      toast.success(`${bedId} ready (${r?.tookMs ?? '<1'} ms)`);
      if (r?.result?.recommendation) toast(`Suggested: ${r.result.recommendation.title}`);
    } catch (e) {
      toast.error(errorText(e, 'Could not update bed'));
    } finally {
      setCleaning(null);
    }
  };

  return (
    <div className="flow-page">
      <FlowPageHeader
        title="Live Bed Map"
        subtitle="Click a bed for patient or bed details"
        crumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Flow Intelligence' }, { label: 'Live Bed Map' }]}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatus(f)}
              aria-pressed={status === f}
              className={clsx('flow-chip', status === f ? 'bg-royal-500 text-white border-royal-500' : 'bg-cream-50 border-cream-200 text-ink-900 hover:bg-sunken')}
            >
              {f !== 'all' && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BED_STATUS_COLORS[f] }} aria-hidden="true" />}
              {f === 'all' ? 'All' : BED_STATUS_LABELS[f]}
              {data && f !== 'all' && <span className="tabular-nums opacity-75">{data.legend.find((l) => l.status === f)?.count ?? 0}</span>}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-60">
          <Search className="w-3.5 h-3.5 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <label htmlFor="bed-search" className="sr-only">
            Search bed ID or patient alias
          </label>
          <input id="bed-search" className="flow-input !pl-8" placeholder="Search bed ID (e.g. ICU-04)" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {q.error && !data && <FlowError message={q.error} onRetry={q.refresh} />}
      <BedMapSchematic data={data} loading={q.loading} statusFilter={status} search={search} onChanged={() => q.refresh({ silent: true })} showLegend={false} />

      {dirty.length > 0 && (
        <section className="flow-card-pad mt-5" aria-label="Dirty beds">
          <h3 className="label-xs mb-2">Waiting for cleaning · {dirty.length}</h3>
          <div className="flex flex-wrap gap-2">
            {dirty.map((t) => (
              <button key={t.id} type="button" className="flow-btn-secondary" disabled={cleaning === t.id} onClick={() => markClean(t.id)}>
                <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" aria-hidden="true" /> {cleaning === t.id ? 'Saving…' : `${t.id} cleaned`}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
