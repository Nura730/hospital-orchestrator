/**
 * @file Slider.jsx
 * Range slider with value readout badge and step markers for simulator controls.
 */

import React from 'react';
import clsx from 'clsx';

export function Slider({
  value = 0,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label = null,
  unit = '',
  disabled = false,
  className = '',
}) {
  return (
    <div className={clsx('flex flex-col gap-2 w-full', className)}>
      <div className="flex items-center justify-between text-xs">
        {label && <span className="font-semibold text-surface-foreground">{label}</span>}
        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-surface-sunken border border-surface-border text-primary-600 dark:text-primary-400">
          {value}
          {unit}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-surface-sunken rounded-lg appearance-none cursor-pointer accent-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      />

      <div className="flex justify-between text-[11px] font-mono text-surface-muted">
        <span>{min}{unit}</span>
        <span>{Math.round((min + max) / 2)}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

export default Slider;
