/**
 * @file WorkloadBar.jsx
 * Horizontal bar chart displaying staff member workload % and fatigue metrics.
 */

import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import './setupChart.js';
import { useTheme } from '../../hooks/useTheme.js';

export function WorkloadBar({ workloadData = null }) {
  const { isDark } = useTheme();

  const chartData = useMemo(() => {
    if (!workloadData || !workloadData.names) {
      return { labels: [], datasets: [] };
    }

    const { names = [], workloads = [], fatigues = [] } = workloadData;

    // Color bars based on workload threshold
    const barColors = workloads.map((w) => {
      if (w >= 90) return 'rgba(239, 68, 68, 0.85)'; // danger
      if (w >= 75) return 'rgba(245, 158, 11, 0.85)'; // warning
      return 'rgba(13, 148, 136, 0.85)'; // normal
    });

    return {
      labels: names,
      datasets: [
        {
          label: 'Workload %',
          data: workloads,
          backgroundColor: barColors,
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 16,
        },
        {
          label: 'Fatigue Score',
          data: fatigues,
          backgroundColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 16,
        },
      ],
    };
  }, [workloadData, isDark]);

  const options = useMemo(() => ({
    indexAxis: 'y',
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
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.x}%`,
        },
      },
    },
    scales: {
      x: {
        min: 0,
        max: 100,
        grid: {
          color: isDark ? 'rgba(51, 65, 85, 0.25)' : 'rgba(226, 232, 240, 0.7)',
        },
        ticks: {
          callback: (v) => `${v}%`,
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 10 },
        },
      },
      y: {
        grid: { display: false },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 10 },
        },
      },
    },
  }), [isDark]);

  return <Bar data={chartData} options={options} />;
}

export default WorkloadBar;
