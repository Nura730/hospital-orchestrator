/**
 * @file Card.jsx
 * Standard container card: rounded-xl, 1px border, no shadow; optional header and footer slots.
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
        'bg-cream-50 text-ink-900 border border-cream-200 rounded-xl transition-colors overflow-hidden',
        hoverable && 'hover:border-royal-500/40 cursor-pointer',
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream-200">
          <div>
            {title && (
              <h3 className="font-semibold text-sm text-ink-900 tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0 ml-3">{action}</div>}
        </div>
      )}

      <div className={clsx(!noPadding && 'p-4')}>{children}</div>

      {footer && (
        <div className="px-4 py-3 border-t border-cream-200 text-xs text-ink-500 flex items-center justify-between">
          {footer}
        </div>
      )}
    </div>
  );
}

export default Card;
