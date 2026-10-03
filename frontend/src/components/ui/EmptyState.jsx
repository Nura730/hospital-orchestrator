/**
 * @file EmptyState.jsx
 * Visual placeholder when search results or data lists are empty.
 */

import React from 'react';
import { Inbox } from 'lucide-react';
import Button from './Button.jsx';

export function EmptyState({
  title = 'No Data Available',
  message = 'There are no active records matching the current filters.',
  icon: Icon = Inbox,
  actionLabel = null,
  onAction = null,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <div className="w-12 h-12 rounded-full bg-surface-sunken flex items-center justify-center mb-3 text-surface-muted">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="font-semibold text-sm text-surface-foreground mb-1">{title}</h4>
      <p className="text-xs text-surface-muted max-w-sm mb-4 leading-relaxed">{message}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
