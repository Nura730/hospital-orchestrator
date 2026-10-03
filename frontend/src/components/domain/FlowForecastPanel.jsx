/**
 * @file FlowForecastPanel.jsx
 * Numbers first: next-6h predicted arrivals table, demand vs capacity per horizon, confidence badge.
 * "View chart" opens a popup with (1) arrival forecast + confidence band + "now" line and
 * (2) bed demand vs capacity with red fill where demand > capacity, plus the raw data table.
 */

import React, { useState } from 'react';
import clsx from 'clsx';
import { TrendingUp, BarChart3, Download } from 'lucide-react';
import { FlowSkeleton, FlowError, SectionHeader, FlowModal } from './FlowUi.jsx';
import FlowChart from './FlowChart.jsx';
import RawDataTable from './RawDataTable.jsx';
import PredictionConfidenceBadge from './PredictionConfidenceBadge.jsx';
import flowApi from '../../api/flowApi.js';
import { useFlowPolling } from '../../hooks/useFlowPolling.js';
import { clock, dateTime, exportCsv } from '../../utils/flowFormat.js';

const DEPARTMENTS = ['Emergency', 'General Ward', 'ICU', 'HDU', 'Radiology'];

export function FlowForecastPanel({ defaultDepartment = 'Emergency' }) {
  const [department, setDepartment] = useState(defaultDepartment);
  const [open, setOpen] = useState(false);
  const { data, loading, error, refresh } = useFlowPolling(
    async () => {
      const [forecast, demand] = await Promise.all([flowApi.getForecast(department, 6), flowApi.getBedDemand(department)]);
      return { forecast, demand: Array.isArray(demand) ? demand : [demand] };
    },
    { intervalMs: 60000, deps: [department], refreshOn: ['flow.analysisComplete'] }
  );

  const f = data?.forecast;
  const demand = data?.demand || [];
  const total = f ? f.predicted.reduce((a, b) => a + b, 0) : 0;

  const arrivalRows = f ? f.timestamps.map((ts, i) => ({ ts, value: f.predicted[i], lower: f.lower[i], upper: f.upper[i] })) : [];
  const demandRows = demand.map((d) => ({ ts: new Date(Date.now() + d.horizon * 3600000).toISOString(), horizon: d.horizon, value: d.demand, capacity: d.capacity }));
  const rawRows = [
    ...arrivalRows.map((r) => ({ ...r, metric: `${department} arrivals` })),
    ...demand.map((d) => ({ ts: `+${d.horizon}h`, metric: `${department} bed demand`, value: d.demand, lower: d.expectedDischarges, upper: d.capacity })),
  ];
  const rawColumns = [
    { key: 'ts', label: 'Timestamp', render: (r) => (String(r.ts).startsWith('+') ? r.ts : dateTime(r.ts)), csv: (r) => r.ts },
    { key: 'metric', label: 'Metric' },
    { key: 'value', label: 'Value', align: 'right' },
    { key: 'lower', label: 'Lower / discharges', align: 'right' },
    { key: 'upper', label: 'Upper / capacity', align: 'right' },
  ];

  return (
    <div className="flow-card-pad h-full flex flex-col">
      <SectionHeader
        title="Flow forecast"
        subtitle="Next 6 hours from 4 weeks of same-hour history"
        icon={TrendingUp}
        actions={
          <>
            <label className="sr-only" htmlFor="forecast-dept">
              Department
            </label>
            <select id="forecast-dept" className="flow-input !w-auto !py-1.5" value={department} onChange={(e) => setDepartment(e.target.value)}>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <button type="button" className="flow-btn-secondary !py-1.5" onClick={() => setOpen(true)} disabled={!f}>
              <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /> View chart
            </button>
          </>
        }
      />
      {error && <FlowError message={error} onRetry={refresh} />}
      {loading && !data ? (
        <FlowSkeleton lines={8} height="h-6" />
      ) : f ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl bg-royal-100 p-3">
              <div className="text-[10px] uppercase font-semibold text-royal-700 tracking-wide">Arrivals next 6h</div>
              <div className="text-2xl font-extrabold text-royal-900 tabular-nums">{total.toFixed(1)}</div>
              <PredictionConfidenceBadge confidence={f.confidence} />
            </div>
            <div className="rounded-xl bg-cream-100 p-3">
              <div className="text-[10px] uppercase font-semibold text-ink-500 tracking-wide">Admission rate</div>
              <div className="text-2xl font-extrabold text-royal-900 tabular-nums">{Math.round((demand[0]?.admissionRate ?? f.historicalAdmissionRate) * 100)}%</div>
              <span className="text-[10px] text-ink-500">{f.historyRows} history hours</span>
            </div>
          </div>

          <table className="flow-table w-full mb-3" aria-label="Predicted arrivals per hour">
            <thead>
              <tr>
                <th scope="col">Hour</th>
                <th scope="col" className="!text-right">Predicted</th>
                <th scope="col" className="!text-right">80% range</th>
              </tr>
            </thead>
            <tbody>
              {arrivalRows.map((r) => (
                <tr key={r.ts}>
                  <td>{clock(r.ts)}</td>
                  <td className="!text-right font-bold tabular-nums">{r.value}</td>
                  <td className="!text-right tabular-nums text-ink-500">
                    {r.lower}–{r.upper}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-500 mb-1.5">Demand vs capacity</h4>
          <div className="grid grid-cols-4 gap-1.5">
            {demand.map((d) => (
              <div key={d.horizon} className={clsx('rounded-lg border px-2 py-1.5 text-center', d.shortage ? 'border-[#EF4444] bg-[#EF4444]/10' : 'border-cream-200 bg-cream-50')}>
                <div className="text-[10px] text-ink-500">+{d.horizon}h</div>
                <div className={clsx('text-sm font-extrabold tabular-nums', d.shortage ? 'text-fg-bad' : 'text-royal-900')}>
                  {Math.round(d.demand)}/{d.capacity}
                </div>
                <div className={clsx('text-[10px] font-semibold tabular-nums', d.gap > 0 ? 'text-fg-bad' : 'text-fg-ok')}>{d.gap > 0 ? `short ${d.gap}` : `${Math.abs(d.gap)} spare`}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <FlowModal
        open={open}
        onClose={() => setOpen(false)}
        size="xl"
        title={`${department}: arrival forecast & bed demand`}
        subtitle="Charts with the exact values used, straight from the prediction engine"
        footer={
          <>
            <button type="button" className="flow-btn-secondary" onClick={() => exportCsv(`${department}_forecast_raw`, rawColumns, rawRows)}>
              <Download className="w-3.5 h-3.5" aria-hidden="true" /> Export CSV
            </button>
            <button type="button" className="flow-btn-primary" onClick={() => setOpen(false)}>
              Close
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="flow-card p-3">
            <p className="text-xs font-semibold text-royal-900 mb-2">Arrival forecast · 80% band</p>
            <FlowChart chartType="band" series={{ arrivals: arrivalRows }} height={240} />
          </div>
          <div className="flow-card p-3">
            <p className="text-xs font-semibold text-royal-900 mb-2">Bed demand vs capacity</p>
            <FlowChart chartType="demandCapacity" series={{ demand: demandRows }} height={240} />
          </div>
        </div>
        <RawDataTable rows={rawRows} columns={rawColumns} title="Raw data" compact />
      </FlowModal>
    </div>
  );
}

export default FlowForecastPanel;
