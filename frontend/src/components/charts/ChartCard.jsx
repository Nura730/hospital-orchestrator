/**
 * @file ChartCard.jsx
 * Standardized chart container card with fixed aspect height, header controls, and skeleton loading state.
 */

import React from 'react';
import clsx from 'clsx';
import Card from '../ui/Card.jsx';
import Skeleton from '../ui/Skeleton.jsx';

export function ChartCard({
  title,
  subtitle = null,
  action = null,
  height = 'h-72',
  loading = false,
  children,
  className = '',
  footer = null,
}) {
  return (
    <Card
      title={title}
      subtitle={subtitle}
      action={action}
      footer={footer}
      className={clsx('flex flex-col', className)}
    >
      <div className={clsx('w-full relative', height)}>
        {loading ? (
          <div className="w-full h-full flex flex-col justify-end p-2 gap-2 animate-pulse">
            <div className="flex items-end gap-2 h-4/5 w-full">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton
                  key={i}
                  variant="rect"
                  width={`${100 / 7}%`}
                  height={`${30 + ((i * 17) % 65)}%`}
                />
              ))}
            </div>
            <Skeleton width="100%" height="12px" />
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

export default ChartCard;
