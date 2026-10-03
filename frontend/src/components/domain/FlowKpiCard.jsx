/**
 * @file FlowKpiCard.jsx
 * Numbers-first KPI card: big value, delta, sub-label, and a "View chart" icon button
 * that opens ChartPopup (charts are hidden by default).
 */

import React, { useState } from 'react';
import clsx from 'clsx';
import { BarChart3, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import ChartPopup from './ChartPopup.jsx';
import { BAND_STYLES, num } from '../../utils/flowFormat.js';

/**
 * @param {{ kpi: { key, label, value, unit, sub, delta, deltaUnit, invertDelta, status, seriesKey, chartType }, series?: object, endpoint?: string, icon?: any, loading?: boolean }} props
 */
export function FlowKpiCard({ kpi, series, endpoint, icon: Icon, loading = false, className = '' }) {
  const [open, setOpen] = useState(false);
  if (loading || !kpi) {
    return (
      <div className={clsx('flow-card-pad', className)} aria-busy="true">
        <div className="flow-skeleton h-3 w-24 mb-3" />
        <div className="flow-skeleton h-8 w-20 mb-2" />
        <div className="flow-skeleton h-3 w-32" />
      </div>
    );
  }
  const band = BAND_STYLES[kpi.status] || BAND_STYLES.neutral;
  const hasDelta = kpi.delta !== null && kpi.delta !== undefined && !Number.isNaN(Number(kpi.delta));
  const up = hasDelta && kpi.delta > 0;
  const good = hasDelta ? (kpi.invertDelta ? kpi.delta < 0 : kpi.delta > 0) : null;
  const DeltaIcon = !hasDelta || kpi.delta === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const canChart = Boolean(kpi.seriesKey && (series || endpoint));

  return (
    <div className={clsx('flow-card-pad relative flex flex-col gap-1 border-l-4', className)} style={{ borderLeftColor: band.hex }}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500 flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-royal-500" aria-hidden="true" />}
          {kpi.label}
        </span>
        {canChart && (
          <button type="button" onClick={() => setOpen(true)} className="flow-btn-ghost !p-1.5 -mt-1 -mr-1" aria-label={`View chart for ${kpi.label}`} title="View chart">
            <BarChart3 className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={clsx('text-3xl font-extrabold tabular-nums tracking-tight', kpi.status === 'neutral' ? 'text-royal-900' : band.text)}>{num(kpi.value, 1)}</span>
        {kpi.unit && <span className="text-sm font-semibold text-ink-500">{kpi.unit.trim()}</span>}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-ink-500 truncate">{kpi.sub}</span>
        {hasDelta && (
          <span className={clsx('inline-flex items-center gap-0.5 font-semibold tabular-nums shrink-0', good === null || kpi.delta === 0 ? 'text-ink-500' : good ? 'text-fg-ok' : 'text-fg-bad')}>
            <DeltaIcon className="w-3.5 h-3.5" aria-hidden="true" />
            {kpi.delta > 0 ? '+' : ''}
            {num(kpi.delta, 1)} {kpi.deltaUnit}
          </span>
        )}
      </div>
      {canChart && (
        <ChartPopup
          open={open}
          onClose={() => setOpen(false)}
          title={kpi.label}
          series={series}
          endpoint={series ? undefined : endpoint}
          seriesKeys={[kpi.seriesKey]}
          chartType={kpi.chartType || 'line'}
          unit={kpi.unit && kpi.unit.trim() === '%' ? '%' : ''}
        />
      )}
    </div>
  );
}

export default FlowKpiCard;
