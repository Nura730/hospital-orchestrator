/**
 * @file DemandCapacityLine.jsx
 * Bed demand vs capacity projection chart with deficit highlight shading.
 */

import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import './setupChart.js';
import { useTheme } from '../../hooks/useTheme.js';

export function DemandCapacityLine({ demandData = null }) {
  const { isDark } = useTheme();

  const chartData = useMemo(() => {
    if (!demandData || !demandData.labels) {
      return { labels: [], datasets: [] };
    }

    const { labels, capacity = [], demand = [] } = demandData;

    return {
      labels,
      datasets: [
        {
          label: 'Total Bed Capacity',
          data: capacity,
          borderColor: '#10b981', // green-500
          borderWidth: 2.5,
          borderDash: [4, 4],
          backgroundColor: 'transparent',
          pointRadius: 3,
          tension: 0.2,
        },
        {
          label: 'Projected Demand',
          data: demand,
          borderColor: '#f43f5e', // rose-500
          borderWidth: 3,
          backgroundColor: isDark
            ? 'rgba(244, 63, 94, 0.15)'
            : 'rgba(244, 63, 94, 0.08)',
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#f43f5e',
          tension: 0.35,
        },
      ],
    };
  }, [demandData, isDark]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 10 },
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          afterBody: (items) => {
            if (items.length >= 2) {
              const cap = items[0].parsed.y;
              const dem = items[1].parsed.y;
              const diff = dem - cap;
              if (diff > 0) return `⚠️ Deficit: -${diff} beds short`;
              return `✅ Buffer: +${Math.abs(diff)} beds available`;
            }
            return '';
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: isDark ? 'rgba(51, 65, 85, 0.2)' : 'rgba(226, 232, 240, 0.6)',
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 10 },
        },
      },
      y: {
        grid: {
          color: isDark ? 'rgba(51, 65, 85, 0.25)' : 'rgba(226, 232, 240, 0.6)',
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 10 },
        },
      },
    },
  }), [isDark]);

  return <Line data={chartData} options={options} />;
}

export default DemandCapacityLine;
