/**
 * @file Tooltip.jsx
 * Lightweight floating tooltip with customizable arrow and position placement.
 */

import React, { useState } from 'react';
import clsx from 'clsx';

export function Tooltip({
  content,
  children,
  position = 'top', // 'top' | 'bottom' | 'left' | 'right'
  className = '',
}) {
  const [visible, setVisible] = useState(false);

  if (!content) return children;

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position] || 'bottom-full left-1/2 -translate-x-1/2 mb-2';

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}

      {visible && (
        <div
          role="tooltip"
          className={clsx(
            'absolute z-50 px-2.5 py-1.5 text-xs font-normal text-slate-100 bg-slate-900 dark:bg-slate-800 rounded-lg shadow-lg whitespace-nowrap pointer-events-none transition-all duration-150 border border-slate-700/50 animate-in fade-in zoom-in-95',
            positionClasses,
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export default Tooltip;
