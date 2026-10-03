/**
 * @file SearchInput.jsx
 * Filter search input with search icon, clear button, and focus ring.
 */

import React from 'react';
import clsx from 'clsx';
import { Search, X } from 'lucide-react';

export function SearchInput({
  value = '',
  onChange,
  placeholder = 'Search...',
  className = '',
  onClear = null,
  autoFocus = false,
}) {
  return (
    <div className={clsx('relative flex items-center w-full max-w-sm', className)}>
      <Search className="w-4 h-4 text-surface-muted absolute left-3 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full text-xs pl-9 pr-8 py-2 bg-surface-elevated text-surface-foreground border border-surface-border rounded-lg placeholder-surface-muted focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            if (onClear) onClear();
          }}
          className="absolute right-2.5 p-0.5 rounded text-surface-muted hover:text-surface-foreground cursor-pointer"
          aria-label="Clear input"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default SearchInput;
