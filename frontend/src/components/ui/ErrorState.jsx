/**
 * @file ErrorState.jsx
 * Error boundary and fetch error display with Retry button.
 */

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button.jsx';

export function ErrorState({
  title = 'Failed to Load Data',
  error = 'A network or server error occurred while retrieving clinical operations data.',
  onRetry = null,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-danger-500/5 border border-danger-500/20 rounded-xl ${className}`}>
      <div className="w-12 h-12 rounded-full bg-danger-500/10 flex items-center justify-center mb-3 text-danger-500">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="font-semibold text-sm text-surface-foreground mb-1">{title}</h4>
      <p className="text-xs text-surface-muted max-w-sm mb-4 leading-relaxed font-mono">
        {typeof error === 'string' ? error : error?.message || 'Unknown error'}
      </p>
      {onRetry && (
        <Button variant="danger" size="sm" icon={RefreshCw} onClick={onRetry}>
          Retry Request
        </Button>
      )}
    </div>
  );
}

export default ErrorState;
