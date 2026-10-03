/**
 * @file Drawer.jsx
 * Slide-out right drawer panel for detailed side-by-side inspection without losing page context.
 */

import React, { useEffect } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import Button from './Button.jsx';

export function Drawer({
  isOpen = false,
  onClose,
  title,
  subtitle = null,
  children,
  footer = null,
  width = 'max-w-md', // 'max-w-md' | 'max-w-lg' | 'max-w-xl' | 'max-w-2xl'
  className = '',
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Body */}
      <div
        className={clsx(
          'relative w-full h-full bg-surface-elevated border-l border-surface-border shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200',
          width,
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-sunken/40">
          <div>
            <h3 className="font-semibold text-base text-surface-foreground">{title}</h3>
            {subtitle && <p className="text-xs text-surface-muted mt-0.5">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
            <X className="w-4 h-4 text-surface-muted" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-surface-border bg-surface-sunken/30 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Drawer;
