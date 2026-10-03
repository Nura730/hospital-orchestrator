/**
 * @file LiveDot.jsx
 * Real-time operational connection indicator with pulsing glow dot.
 */

import React from 'react';
import clsx from 'clsx';

export function LiveDot({ isConnected = true, showLabel = true, className = '' }) {
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 select-none text-xs font-medium px-2 py-1 rounded-full border',
        isConnected
          ? 'bg-success-500/10 text-success-700 dark:text-success-400 border-success-500/20'
          : 'bg-warning-500/10 text-warning-700 dark:text-warning-400 border-warning-500/20',
        className
      )}
      title={isConnected ? 'Real-time telemetry stream active' : 'Attempting to re-establish real-time socket connection'}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={clsx(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            isConnected ? 'bg-success-400' : 'bg-warning-400'
          )}
        />
        <span
          className={clsx(
            'relative inline-flex rounded-full h-2 w-2',
            isConnected ? 'bg-success-500' : 'bg-warning-500'
          )}
        />
      </span>
      {showLabel && (
        <span className="tracking-wide">
          {isConnected ? 'LIVE' : 'RECONNECTING'}
        </span>
      )}
    </div>
  );
}

export default LiveDot;
