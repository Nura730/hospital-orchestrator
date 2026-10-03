/**
 * @file TrendLine.jsx
 * Trend line chart with smooth bezier curves for recommendation acceptance rates and analytics metrics.
 */

import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import './setupChart.js';
import { useTheme } from '../../hooks/useTheme.js';

export function TrendLine({
  labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  data = [78, 81, 85, 84, 89, 91, 94],
  label = 'Acceptance Rate %',
  color = '#014BAA',
}) {
  const { isDark } = useTheme();

  const chartData = useMemo(() => ({
    labels,
    datasets: [
      {
        label,
        data,
        borderColor: color,
        borderWidth: 2.5,
        backgroundColor: isDark ? 'rgba(13, 148, 136, 0.12)' : 'rgba(13, 148, 136, 0.08)',
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: color,
        tension: 0.35,
      },
    ],
  }), [labels, data, label, color, isDark]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${label}: ${ctx.parsed.y}%`,
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
        min: 60,
        max: 100,
        grid: {
          color: isDark ? 'rgba(51, 65, 85, 0.25)' : 'rgba(226, 232, 240, 0.7)',
        },
        ticks: {
          callback: (v) => `${v}%`,
          stepSize: 10,
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 10 },
        },
      },
    },
  }), [isDark, label]);

  return <Line data={chartData} options={options} />;
}

export default TrendLine;
