/**
 * @file Badge.jsx
 * Tag chip component with multiple clinical color schemes and dot indicators.
 */

import React from 'react';
import clsx from 'clsx';

const BADGE_COLORS = {
  primary: 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-950/60 dark:text-primary-300 dark:border-primary-800/60',
  success: 'bg-success-50 text-success-700 border-success-200 dark:bg-success-950/60 dark:text-success-300 dark:border-success-800/60',
  warning: 'bg-warning-50 text-warning-800 border-warning-200 dark:bg-warning-950/60 dark:text-warning-300 dark:border-warning-800/60',
  danger:  'bg-danger-50 text-danger-700 border-danger-200 dark:bg-danger-950/60 dark:text-danger-300 dark:border-danger-800/60',
  info:    'bg-info-50 text-info-700 border-info-200 dark:bg-info-950/60 dark:text-info-300 dark:border-info-800/60',
  neutral: 'bg-surface-elevated text-surface-muted border-surface-border',
};

const DOT_COLORS = {
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger:  'bg-danger-500',
  info:    'bg-info-500',
  neutral: 'bg-slate-400',
};

export function Badge({
  children,
  color = 'neutral',
  size = 'sm',
  dot = false,
  className = '',
  icon: Icon = null,
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium border rounded-full select-none shrink-0 tracking-wide',
        BADGE_COLORS[color] || BADGE_COLORS.neutral,
        size === 'xs' ? 'text-[11px] px-1.5 py-0.5 gap-1' : 'text-xs px-2.5 py-0.5 gap-1.5',
        className
      )}
    >
      {dot && (
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full shrink-0',
            DOT_COLORS[color] || DOT_COLORS.neutral
          )}
        />
      )}
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {children}
    </span>
  );
}

export default Badge;
