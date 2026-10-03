/**
 * @file GaugeDoughnut.jsx
 * Half-circle (180 degree) gauge chart for ICU occupancy with center value readout.
 */

import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import './setupChart.js';
import { useTheme } from '../../hooks/useTheme.js';

export function GaugeDoughnut({
  value = 83.3,
  title = 'ICU Occupancy',
  dangerThreshold = 90,
  warnThreshold = 75,
}) {
  const { isDark } = useTheme();

  const percentage = Math.min(100, Math.max(0, Number(value) || 0));
  const remaining = 100 - percentage;

  const isDanger = percentage >= dangerThreshold;
  const isWarn = percentage >= warnThreshold;

  const fillColor = isDanger ? '#ef4444' : isWarn ? '#f59e0b' : '#0d9488';

  const chartData = useMemo(() => ({
    labels: ['Occupied', 'Available'],
    datasets: [
      {
        data: [percentage, remaining],
        backgroundColor: [
          fillColor,
          isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.7)',
        ],
        borderWidth: 0,
        circumference: 180,
        rotation: -90,
        cutout: '75%',
      },
    ],
  }), [percentage, remaining, fillColor, isDark]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
  }), []);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <div className="w-full h-full max-h-56 relative flex items-center justify-center">
        <Doughnut data={chartData} options={options} />
        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-8 pointer-events-none">
          <span className="text-3xl font-extrabold font-mono tracking-tight text-surface-foreground">
            {percentage}%
          </span>
          <span className="text-xs text-surface-muted font-medium mt-0.5">
            {title}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[11px] font-medium text-surface-muted -mt-3">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: fillColor }} />
          Occupied ({percentage}%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
          Capacity Buffer ({remaining.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}

export default GaugeDoughnut;
