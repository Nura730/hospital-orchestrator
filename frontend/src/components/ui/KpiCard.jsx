/**
 * @file KpiCard.jsx
 * High-impact metric card displaying large tabular numbers, trend direction, RAG status accent, and sparkline SVG.
 */

import React from 'react';
import clsx from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Card from './Card.jsx';

export function KpiCard({
  title,
  value,
  unit = '',
  trend = '',
  trendDirection = 'neutral', // 'up' | 'down' | 'neutral'
  status = 'neutral', // 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  sparklineData = [],
  subtitle = null,
  icon: Icon = null,
  className = '',
  onClick = null,
}) {
  const isPositive = trend.includes('+') || trendDirection === 'up';
  const isNegative = trend.includes('-') || trendDirection === 'down';

  // Sparkline coordinates generator
  let sparklineSvg = null;
  if (sparklineData && sparklineData.length > 1) {
    const min = Math.min(...sparklineData);
    const max = Math.max(...sparklineData);
    const range = max - min || 1;
    const width = 80;
    const height = 24;

    const points = sparklineData
      .map((val, idx) => {
        const x = (idx / (sparklineData.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const strokeColor =
      status === 'danger'
        ? '#ef4444'
        : status === 'warning'
        ? '#f59e0b'
        : status === 'success'
        ? '#10b981'
        : '#014BAA';

    sparklineSvg = (
      <svg width={width} height={height} className="shrink-0 overflow-visible">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  }

  const borderAccents = {
    danger: 'border-l-4 border-l-danger-500',
    warning: 'border-l-4 border-l-warning-500',
    success: 'border-l-4 border-l-success-500',
    info: 'border-l-4 border-l-info-500',
    neutral: 'border-l-4 border-l-surface-border',
  };

  return (
    <Card
      onClick={onClick}
      hoverable={!!onClick}
      className={clsx('relative p-4 transition-all', borderAccents[status] || borderAccents.neutral, className)}
    >
      <div className="flex items-center justify-between text-xs text-surface-muted font-medium mb-1.5">
        <span className="truncate">{title}</span>
        {Icon && <Icon className="w-4 h-4 text-surface-muted shrink-0 ml-1.5" />}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-1">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold font-mono tracking-tight text-surface-foreground">
            {value}
          </span>
          {unit && (
            <span className="text-xs text-surface-muted font-medium">{unit}</span>
          )}
        </div>

        {sparklineSvg && (
          <div className="hidden sm:block opacity-90">{sparklineSvg}</div>
        )}
      </div>

      {(trend || subtitle) && (
        <div className="mt-2.5 flex items-center justify-between text-xs">
          {trend ? (
            <span
              className={clsx(
                'inline-flex items-center gap-1 font-medium',
                status === 'danger'
                  ? 'text-danger-600 dark:text-danger-400'
                  : status === 'warning'
                  ? 'text-warning-600 dark:text-warning-400'
                  : status === 'success'
                  ? 'text-success-600 dark:text-success-400'
                  : 'text-surface-muted'
              )}
            >
              {isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : isNegative ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
              {trend}
            </span>
          ) : (
            <span />
          )}

          {subtitle && (
            <span className="text-[11px] text-surface-muted truncate ml-2">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

export default KpiCard;
