/**
 * @file OccupancyBar.jsx
 * Department occupancy percentage vertical bar chart with 90% critical threshold annotation line.
 */

import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import './setupChart.js';
import { useTheme } from '../../hooks/useTheme.js';

export function OccupancyBar({ data = [] }) {
  const { isDark } = useTheme();

  const chartData = useMemo(() => {
    const labels = data.map((d) => d.department);
    const percentages = data.map((d) => d.occupancyPercentage || 0);

    // Color bars based on threshold (>90 danger, >70 warning, else primary)
    const backgroundColors = percentages.map((pct) => {
      if (pct >= 90) return 'rgba(239, 68, 68, 0.85)'; // Red danger
      if (pct >= 70) return 'rgba(245, 158, 11, 0.85)'; // Amber warn
      return 'rgba(13, 148, 136, 0.85)'; // Teal primary
    });

    return {
      labels,
      datasets: [
        {
          label: 'Occupancy %',
          data: percentages,
          backgroundColor: backgroundColors,
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 36,
        },
      ],
    };
  }, [data]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `Occupancy: ${ctx.parsed.y}%`,
        },
      },
      annotation: {
        annotations: {
          criticalLine: {
            type: 'line',
            yMin: 90,
            yMax: 90,
            borderColor: '#ef4444',
            borderWidth: 2,
            borderDash: [6, 4],
            label: {
              display: true,
              content: 'Critical Limit 90%',
              position: 'end',
              backgroundColor: 'rgba(239, 68, 68, 0.9)',
              color: '#ffffff',
              font: { size: 10, weight: 'bold' },
              padding: 4,
            },
          },
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
        min: 0,
        max: 100,
        grid: {
          color: isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        },
        ticks: {
          callback: (v) => `${v}%`,
          stepSize: 20,
          color: isDark ? '#94a3b8' : '#64748b',
        },
      },
    },
  }), [isDark]);

  return <Bar data={chartData} options={options} />;
}

export default OccupancyBar;
