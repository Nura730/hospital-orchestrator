/**
 * @file Select.jsx
 * Accessible custom select dropdown for filtering departments, statuses, and horizon presets.
 */

import React from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

export function Select({
  options = [], // [{ value, label }]
  value,
  onChange,
  label = null,
  size = 'sm', // 'sm' | 'md'
  className = '',
  disabled = false,
}) {
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && <label className="text-xs font-medium text-surface-muted">{label}</label>}
      <div className="relative inline-flex items-center">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(
            'w-full appearance-none bg-surface-elevated text-surface-foreground border border-surface-border rounded-lg pr-8 pl-3 py-1.5 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors',
            size === 'md' && 'py-2 pl-3.5 pr-9 text-sm',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-surface-elevated text-surface-foreground">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-surface-muted absolute right-2.5 pointer-events-none" />
      </div>
    </div>
  );
}

export default Select;
