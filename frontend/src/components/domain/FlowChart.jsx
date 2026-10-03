/**
 * @file FlowChart.jsx
 * Chart.js renderers used inside ChartPopup only (charts are hidden by default on every dashboard).
 * chartType: 'line' | 'bar' | 'band' (forecast + 80% band + "now" line) | 'demandCapacity' (red fill
 * where demand > capacity) | 'groupedBar' (simulator scenarios).
 */

import React, { useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import '../charts/setupChart.js';
import { clock, dateTime } from '../../utils/flowFormat.js';

const PALETTE = ['#014BAA', '#2BA8E0', '#F2A93B', '#1FA971', '#D64545', '#6D28D9'];
const GRID = '#EFE7E2';
const TICK = '#5B6B80';

function labelFor(ts, spanHours) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return spanHours > 30 ? dateTime(ts) : clock(ts);
}

function spanOf(rows) {
  if (!rows || rows.length < 2) return 0;
  const a = new Date(rows[0].ts).getTime();
  const b = new Date(rows[rows.length - 1].ts).getTime();
  return Number.isNaN(a) || Number.isNaN(b) ? 0 : Math.abs(b - a) / 3600000;
}

const baseOptions = (unit) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { labels: { color: TICK, usePointStyle: true, boxWidth: 8 } },
    tooltip: {
      backgroundColor: '#012A63',
      titleColor: '#fff',
      bodyColor: '#E3ECF8',
      callbacks: { label: (ctx) => (ctx.parsed.y == null ? null : `${ctx.dataset.label}: ${ctx.parsed.y}${unit || ''}`) },
    },
  },
  scales: {
    x: { grid: { color: GRID }, ticks: { color: TICK, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
    y: { grid: { color: GRID }, ticks: { color: TICK }, beginAtZero: true },
  },
});

export function FlowChart({ chartType = 'line', series = {}, seriesKeys, grouped, unit = '', height = 280 }) {
  const keys = seriesKeys && seriesKeys.length ? seriesKeys : Object.keys(series || {});

  const config = useMemo(() => {
    if (chartType === 'groupedBar' && grouped) {
      return {
        kind: 'bar',
        data: {
          labels: grouped.labels,
          datasets: grouped.datasets.map((d, i) => ({ label: d.label, data: d.data, backgroundColor: d.color || PALETTE[i % PALETTE.length], borderRadius: 6, maxBarThickness: 36 })),
        },
        options: baseOptions(unit),
      };
    }

    const first = series[keys[0]] || [];
    const span = spanOf(first);

    if (chartType === 'band') {
      const rows = first;
      const labels = ['Now', ...rows.map((r) => labelFor(r.ts, span))];
      const opts = baseOptions(unit);
      opts.plugins.annotation = {
        annotations: {
          now: {
            type: 'line',
            xMin: 0,
            xMax: 0,
            borderColor: '#D64545',
            borderWidth: 2,
            borderDash: [4, 4],
            label: { display: true, content: 'now', position: 'start', backgroundColor: '#D64545', color: '#fff', font: { size: 10 } },
          },
        },
      };
      return {
        kind: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Lower (80%)', data: [null, ...rows.map((r) => r.lower)], borderColor: 'rgba(43,168,224,0.4)', borderWidth: 1, pointRadius: 0, fill: false },
            { label: 'Upper (80%)', data: [null, ...rows.map((r) => r.upper)], borderColor: 'rgba(43,168,224,0.4)', backgroundColor: 'rgba(43,168,224,0.18)', borderWidth: 1, pointRadius: 0, fill: '-1' },
            { label: 'Predicted arrivals', data: [null, ...rows.map((r) => r.value)], borderColor: '#014BAA', backgroundColor: '#014BAA', borderWidth: 2.5, pointRadius: 3, tension: 0.3, fill: false },
          ],
        },
        options: opts,
      };
    }

    if (chartType === 'demandCapacity') {
      const rows = first;
      const labels = rows.map((r) => (r.horizon ? `+${r.horizon}h` : labelFor(r.ts, span)));
      return {
        kind: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Projected demand',
              data: rows.map((r) => r.value),
              borderColor: '#014BAA',
              backgroundColor: '#014BAA',
              borderWidth: 2.5,
              pointRadius: 4,
              tension: 0.25,
              fill: { target: 1, above: 'rgba(214,69,69,0.30)', below: 'rgba(0,0,0,0)' },
            },
            { label: 'Capacity', data: rows.map((r) => r.capacity), borderColor: '#D64545', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false },
          ],
        },
        options: baseOptions(unit),
      };
    }

    const labels = first.map((r) => r.label || labelFor(r.ts, span));
    const datasets = keys.map((k, i) => {
      const rows = series[k] || [];
      const color = PALETTE[i % PALETTE.length];
      return chartType === 'bar'
        ? { label: k, data: rows.map((r) => r.value), backgroundColor: color, borderRadius: 6, maxBarThickness: 32 }
        : { label: k, data: rows.map((r) => r.value), borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: rows.length > 30 ? 0 : 2, tension: 0.3, fill: false };
    });
    return { kind: chartType === 'bar' ? 'bar' : 'line', data: { labels, datasets }, options: baseOptions(unit) };
  }, [chartType, series, grouped, unit, keys.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const empty = chartType === 'groupedBar' ? !grouped : !keys.some((k) => (series[k] || []).length);
  if (empty) {
    return <div className="flex items-center justify-center text-xs text-ink-500" style={{ height }}>No data points yet.</div>;
  }

  return (
    <div style={{ height }} role="img" aria-label={`${chartType} chart`}>
      {config.kind === 'bar' ? <Bar data={config.data} options={config.options} /> : <Line data={config.data} options={config.options} />}
    </div>
  );
}

export default FlowChart;
