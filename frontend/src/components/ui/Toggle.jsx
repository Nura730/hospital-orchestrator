/**
 * @file Toggle.jsx
 * Accessible switch toggle component with smooth transition animation.
 */

import React from 'react';
import clsx from 'clsx';

export function Toggle({
  checked = false,
  onChange,
  label = null,
  description = null,
  disabled = false,
  className = '',
}) {
  return (
    <label
      className={clsx(
        'inline-flex items-center gap-3 select-none cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          checked ? 'bg-primary-600' : 'bg-surface-sunken border-surface-border'
        )}
      >
        <span
          className={clsx(
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>

      {(label || description) && (
        <div className="flex flex-col text-xs">
          {label && <span className="font-medium text-surface-foreground">{label}</span>}
          {description && <span className="text-surface-muted text-xs">{description}</span>}
        </div>
      )}
    </label>
  );
}

export default Toggle;
