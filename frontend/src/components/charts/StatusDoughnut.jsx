/**
 * @file StatusDoughnut.jsx
 * Full doughnut chart for bed status distributions and equipment status breakdowns.
 */

import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import './setupChart.js';
import { useTheme } from '../../hooks/useTheme.js';

const STATUS_PALETTE = [
  '#10b981', // Available - Emerald
  '#f43f5e', // Occupied - Rose
  '#f59e0b', // Cleaning - Amber
  '#64748b', // Maintenance - Slate
  '#0284c7', // Reserved - Sky
];

export function StatusDoughnut({
  labels = ['Available', 'Occupied', 'Cleaning', 'Maintenance', 'Reserved'],
  counts = [14, 58, 4, 2, 2],
  title = 'Total Beds',
  colors = STATUS_PALETTE,
}) {
  const { isDark } = useTheme();
  const total = counts.reduce((acc, v) => acc + v, 0);

  const chartData = useMemo(() => ({
    labels,
    datasets: [
      {
        data: counts,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: isDark ? '#1e293b' : '#ffffff',
        cutout: '72%',
      },
    ],
  }), [labels, counts, colors, isDark]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 11 },
          padding: 12,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.parsed} (${Math.round((ctx.parsed / (total || 1)) * 100)}%)`,
        },
      },
    },
  }), [isDark, total]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <Doughnut data={chartData} options={options} />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pr-28">
        <span className="text-2xl font-bold font-mono tracking-tight text-surface-foreground">
          {total}
        </span>
        <span className="text-[11px] uppercase font-mono text-surface-muted">
          {title}
        </span>
      </div>
    </div>
  );
}

export default StatusDoughnut;
