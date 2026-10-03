/**
 * @file ProgressBar.jsx
 * Colored progress bar adhering to clinical thresholds (warning >75%, danger >90%).
 */

import React from 'react';
import clsx from 'clsx';
import { THRESHOLDS } from '../../utils/constants.js';

export function ProgressBar({
  value = 0,
  max = 100,
  label = null,
  showValue = false,
  size = 'md', // 'sm' | 'md' | 'lg'
  autoColor = true,
  color = 'primary', // 'primary' | 'success' | 'warning' | 'danger'
  className = '',
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  let resolvedColor = color;
  if (autoColor) {
    if (percentage >= THRESHOLDS.OCCUPANCY_DANGER) {
      resolvedColor = 'danger';
    } else if (percentage >= THRESHOLDS.OCCUPANCY_WARN) {
      resolvedColor = 'warning';
    } else {
      resolvedColor = 'primary';
    }
  }

  const fillColors = {
    primary: 'bg-primary-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger:  'bg-danger-500',
    info:    'bg-info-500',
  }[resolvedColor] || 'bg-primary-500';

  const heightClass = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  }[size] || 'h-2.5';

  return (
    <div className={clsx('w-full flex flex-col gap-1', className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center text-xs text-surface-muted">
          {label && <span className="font-medium text-surface-foreground">{label}</span>}
          {showValue && <span className="font-mono font-semibold">{percentage}%</span>}
        </div>
      )}

      <div className={clsx('w-full bg-surface-sunken rounded-full overflow-hidden', heightClass)}>
        <div
          style={{ width: `${percentage}%` }}
          className={clsx('h-full transition-all duration-300 rounded-full', fillColors)}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
