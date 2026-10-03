/**
 * @file Skeleton.jsx
 * Animated shimmer loading placeholder components.
 */

import React from 'react';
import clsx from 'clsx';

export function Skeleton({ className = '', variant = 'text', width, height }) {
  const styles = {};
  if (width) styles.width = width;
  if (height) styles.height = height;

  const variantClass = {
    text: 'h-4 rounded',
    circle: 'rounded-full',
    rect: 'rounded-lg',
    card: 'h-32 rounded-xl',
  }[variant] || 'rounded';

  return (
    <div
      style={styles}
      className={clsx(
        'bg-surface-sunken animate-pulse shrink-0',
        variantClass,
        className
      )}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="p-5 border border-surface-border rounded-xl bg-surface-elevated flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <Skeleton width="40%" height="16px" />
        <Skeleton variant="circle" width="24px" height="24px" />
      </div>
      <Skeleton width="65%" height="28px" className="mt-2" />
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-surface-border">
        <Skeleton width="30%" height="12px" />
        <Skeleton width="20%" height="12px" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="w-full border border-surface-border rounded-xl overflow-hidden bg-surface-elevated">
      <div className="p-4 bg-surface-sunken/60 border-b border-surface-border flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={`${100 / cols}%`} height="14px" />
        ))}
      </div>
      <div className="divide-y divide-surface-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-4 flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} width={`${100 / cols}%`} height="14px" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
