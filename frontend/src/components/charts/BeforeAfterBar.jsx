/**
 * @file BeforeAfterBar.jsx
 * Grouped comparison bar chart for simulator stress results and analytics baseline vs system.
 */

import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import './setupChart.js';
import { useTheme } from '../../hooks/useTheme.js';

export function BeforeAfterBar({
  labels = ['Wait Time (min)', 'Bed Shortage', 'Nurse Shortage'],
  beforeData = [38, 0, 1],
  afterData = [52, 4, 5],
  beforeLabel = 'Baseline / Before',
  afterLabel = 'Projected Surge / After',
}) {
  const { isDark } = useTheme();

  const chartData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: beforeLabel,
        data: beforeData,
        backgroundColor: isDark ? 'rgba(148, 163, 184, 0.5)' : 'rgba(148, 163, 184, 0.65)',
        borderRadius: 6,
        maxBarThickness: 32,
      },
      {
        label: afterLabel,
        data: afterData,
        backgroundColor: 'rgba(239, 68, 68, 0.85)',
        borderRadius: 6,
        maxBarThickness: 32,
      },
    ],
  }), [labels, beforeData, afterData, beforeLabel, afterLabel, isDark]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 10 },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 10 },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: isDark ? 'rgba(51, 65, 85, 0.25)' : 'rgba(226, 232, 240, 0.7)',
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 10 },
        },
      },
    },
  }), [isDark]);

  return <Bar data={chartData} options={options} />;
}

export default BeforeAfterBar;
