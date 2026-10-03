/**
 * @file ForecastLine.jsx
 * Arrival forecast line chart with confidence bands, actual vs predicted dashed lines, and vertical "Now" marker.
 */

import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import './setupChart.js';
import { useTheme } from '../../hooks/useTheme.js';

export function ForecastLine({ forecastData = null }) {
  const { isDark } = useTheme();

  const chartData = useMemo(() => {
    if (!forecastData || !forecastData.labels) {
      return { labels: [], datasets: [] };
    }

    const { labels, datasets } = forecastData;

    return {
      labels,
      datasets: [
        // 1. Lower Bound (hidden border, base of fill band)
        {
          label: 'Confidence Lower',
          data: datasets.lowerBound || [],
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          pointRadius: 0,
          fill: '+1', // fills to upper bound
          tension: 0.35,
        },
        // 2. Upper Bound (defines the shaded confidence zone)
        {
          label: 'Confidence Band',
          data: datasets.upperBound || [],
          borderColor: 'transparent',
          backgroundColor: isDark
            ? 'rgba(13, 148, 136, 0.12)'
            : 'rgba(13, 148, 136, 0.08)',
          pointRadius: 0,
          fill: false,
          tension: 0.35,
        },
        // 3. Predicted (Dashed line)
        {
          label: 'Predicted Arrivals',
          data: datasets.predicted || [],
          borderColor: '#014BAA', // teal-600
          borderWidth: 2.5,
          borderDash: [5, 5],
          backgroundColor: 'transparent',
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.35,
        },
        // 4. Actual (Solid line)
        {
          label: 'Actual Arrivals',
          data: datasets.actual || [],
          borderColor: '#38bdf8', // sky-400
          borderWidth: 3,
          backgroundColor: 'transparent',
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#38bdf8',
          tension: 0.35,
        },
      ],
    };
  }, [forecastData, isDark]);

  const nowIndex = forecastData?.nowIndex ?? 0;

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          filter: (item) => item.text !== 'Confidence Lower',
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 10 },
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
      annotation: {
        annotations: {
          nowLine: {
            type: 'line',
            xMin: nowIndex,
            xMax: nowIndex,
            borderColor: '#f59e0b',
            borderWidth: 2,
            borderDash: [4, 4],
            label: {
              display: true,
              content: 'NOW',
              position: 'start',
              backgroundColor: 'rgba(245, 158, 11, 0.9)',
              color: '#ffffff',
              font: { size: 9, weight: 'bold' },
              padding: 3,
            },
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
        beginAtZero: true,
        grid: {
          color: isDark ? 'rgba(51, 65, 85, 0.25)' : 'rgba(226, 232, 240, 0.6)',
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 10 },
        },
      },
    },
  }), [nowIndex, isDark]);

  return <Line data={chartData} options={options} />;
}

export default ForecastLine;
