/**
 * @file ChartPopup.jsx
 * Reusable popup: (a) Chart.js chart, (b) "Raw Data" table of the exact DB values
 * (timestamp | metric | value | lower | upper), (c) Export CSV + Close.
 *
 * Usage:
 *   <ChartPopup open title="ICU occupancy" endpoint="dashboard-numbers?scope=admin" seriesKeys={['icu']} chartType="line" />
 *   <ChartPopup open title="..." series={{ key: rows }} chartType="band" />
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { FlowModal, FlowSkeleton, FlowError } from './FlowUi.jsx';
import FlowChart from './FlowChart.jsx';
import RawDataTable from './RawDataTable.jsx';
import flowApi from '../../api/flowApi.js';
import { errorText } from '../../hooks/useFlowPolling.js';
import { dateTime, exportCsv } from '../../utils/flowFormat.js';

const RAW_COLUMNS = [
  { key: 'ts', label: 'Timestamp', render: (r) => (Number.isNaN(new Date(r.ts).getTime()) ? r.ts : dateTime(r.ts)), csv: (r) => r.ts },
  { key: 'metric', label: 'Metric' },
  { key: 'value', label: 'Value', align: 'right' },
  { key: 'lower', label: 'Lower', align: 'right' },
  { key: 'upper', label: 'Upper', align: 'right' },
];

export function ChartPopup({ open, onClose, title, subtitle, endpoint, seriesKeys, series: seriesProp, chartType = 'line', grouped, rawRows, rawColumns, unit = '' }) {
  const [fetched, setFetched] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !endpoint || seriesProp) return;
    let alive = true;
    setLoading(true);
    setError(null);
    flowApi
      .getRaw(endpoint)
      .then((d) => alive && setFetched(d && d.series ? d.series : d))
      .catch((e) => alive && setError(errorText(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, endpoint, seriesProp]);

  const series = useMemo(() => {
    const src = seriesProp || fetched || {};
    if (!seriesKeys || !seriesKeys.length) return src;
    return Object.fromEntries(seriesKeys.map((k) => [k, src[k] || []]));
  }, [seriesProp, fetched, seriesKeys]);

  const rows = useMemo(() => {
    if (rawRows) return rawRows;
    if (chartType === 'groupedBar' && grouped) {
      return grouped.labels.flatMap((label, i) => grouped.datasets.map((d) => ({ ts: label, metric: d.label, value: d.data[i], lower: null, upper: null })));
    }
    return Object.entries(series).flatMap(([metric, list]) =>
      (list || []).map((r) => ({
        ts: r.ts,
        metric: r.horizon ? `${metric} (+${r.horizon}h)` : metric,
        value: r.value,
        lower: r.lower ?? null,
        // demand-vs-capacity rows carry capacity in the "upper" column (relabelled "Capacity")
        upper: r.upper ?? r.capacity ?? null,
      }))
    );
  }, [rawRows, series, chartType, grouped]);

  const columns = rawColumns || (chartType === 'demandCapacity' ? RAW_COLUMNS.map((c) => (c.key === 'upper' ? { ...c, label: 'Capacity' } : c)) : RAW_COLUMNS);
  const fileName = `${String(title || 'chart').replace(/\W+/g, '_').toLowerCase()}_raw`;

  return (
    <FlowModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle || 'Values come straight from the database: chart and raw data side by side'}
      size="xl"
      footer={
        <>
          <button type="button" className="flow-btn-secondary" onClick={() => exportCsv(fileName, columns, rows)} disabled={!rows.length}>
            <Download className="w-3.5 h-3.5" aria-hidden="true" /> Export CSV
          </button>
          <button type="button" className="flow-btn-primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {loading && <FlowSkeleton lines={6} height="h-8" />}
      {error && <FlowError message={error} />}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 flow-card p-3">
            <FlowChart chartType={chartType} series={series} seriesKeys={seriesKeys} grouped={grouped} unit={unit} />
          </div>
          <div className="lg:col-span-2">
            <RawDataTable rows={rows} columns={columns} title="Raw data" maxHeight="max-h-80" compact />
          </div>
        </div>
      )}
    </FlowModal>
  );
}

export default ChartPopup;
