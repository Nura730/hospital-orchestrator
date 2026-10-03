/**
 * @file Card.jsx
 * Standard container card with rounded-xl border, subtle shadow, header slot, and footer slot.
 */

import React from 'react';
import clsx from 'clsx';

export function Card({
  children,
  className = '',
  title = null,
  subtitle = null,
  action = null,
  footer = null,
  onClick = null,
  hoverable = false,
  noPadding = false,
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-surface-elevated text-surface-foreground border border-surface-border rounded-xl shadow-xs transition-all duration-200 overflow-hidden',
        hoverable && 'hover:shadow-md hover:border-primary-500/30 cursor-pointer',
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div>
            {title && (
              <h3 className="font-semibold text-sm text-surface-foreground tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-surface-muted mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0 ml-3">{action}</div>}
        </div>
      )}

      <div className={clsx(!noPadding && 'p-5')}>{children}</div>

      {footer && (
        <div className="px-5 py-3 bg-surface-sunken/40 border-t border-surface-border text-xs text-surface-muted flex items-center justify-between">
          {footer}
        </div>
      )}
    </div>
  );
}

export default Card;
