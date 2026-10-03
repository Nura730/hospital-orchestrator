/**
 * @file SegmentedControl.jsx
 * Compact multi-option button group for horizon selections and status filters.
 */

import React from 'react';
import clsx from 'clsx';

export function SegmentedControl({
  options = [], // [{ value, label, icon: Icon }]
  value,
  onChange,
  size = 'sm', // 'xs' | 'sm' | 'md'
  className = '',
}) {
  const sizeClasses = {
    xs: 'py-1 px-2 text-xs',
    sm: 'py-1.5 px-3 text-xs',
    md: 'py-2 px-4 text-sm',
  }[size] || 'py-1.5 px-3 text-xs';

  return (
    <div
      className={clsx(
        'inline-flex p-1 bg-surface-sunken rounded-xl border border-surface-border select-none gap-0.5',
        className
      )}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const Icon = opt.icon;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={clsx(
              'rounded-lg font-medium transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer',
              sizeClasses,
              isSelected
                ? 'bg-surface-elevated text-surface-foreground shadow-xs border border-surface-border font-semibold'
                : 'text-surface-muted hover:text-surface-foreground hover:bg-surface-elevated/40'
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
