/**
 * @file Modal.jsx
 * Centered modal dialog with backdrop, escape key handler, title bar, and action buttons.
 */

import React, { useEffect } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import Button from './Button.jsx';

export function Modal({
  isOpen = false,
  onClose,
  title,
  subtitle = null,
  children,
  footer = null,
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
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

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size] || 'max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      />

      {/* Modal Dialog */}
      <div
        className={clsx(
          'relative w-full bg-surface-elevated border border-surface-border rounded-2xl shadow-xl overflow-hidden z-10 animate-in zoom-in-95 duration-150',
          sizeClasses,
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-sunken/40">
          <div>
            <h3 className="font-semibold text-base text-surface-foreground">{title}</h3>
            {subtitle && <p className="text-xs text-surface-muted mt-0.5">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="w-4 h-4 text-surface-muted" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-border bg-surface-sunken/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
