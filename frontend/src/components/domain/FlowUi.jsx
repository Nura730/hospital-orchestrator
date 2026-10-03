/**
 * @file FlowUi.jsx
 * Small cream / royal-blue primitives shared by every Flow Intelligence screen:
 * FlowModal, FlowSkeleton, FlowEmpty, FlowError, SectionHeader, ReadinessBar.
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X, Inbox, AlertTriangle, RefreshCw } from 'lucide-react';
import { readinessBand, BAND_STYLES } from '../../utils/flowFormat.js';

export function FlowModal({ open, onClose, title, subtitle, children, footer, size = 'lg', labelledBy }) {
  const ref = useRef(null);
  const titleId = labelledBy || `flow-modal-${String(title || 'dialog').replace(/\W+/g, '-').toLowerCase()}`;

  useEffect(() => {
    if (!open) return undefined;
    const prevFocus = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector('button, [href], input, select, textarea')?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size] || 'max-w-3xl';

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-[#0F1B2D]/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx('relative w-full bg-cream-50 text-ink-900 rounded-2xl shadow-modal border border-cream-200 flex flex-col max-h-[92vh] animate-scale-in', width)}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-cream-200 bg-cream-100 rounded-t-2xl">
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-bold text-royal-900 truncate">{title}</h2>
            {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="flow-btn-ghost !p-1.5" aria-label="Close dialog">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-cream-200 flex flex-wrap justify-end gap-2 bg-cream-100 rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function FlowSkeleton({ className = '', lines = 1, height = 'h-4' }) {
  return (
    <div className={clsx('space-y-2', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={clsx('flow-skeleton', height)} style={{ width: `${100 - (i % 3) * 12}%` }} />
      ))}
    </div>
  );
}

export function FlowEmpty({ title = 'Nothing to show', message = 'No records match right now.', icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4">
      <div className="w-11 h-11 rounded-full bg-royal-100 text-royal-500 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      <p className="text-xs text-ink-500 mt-1 max-w-xs">{message}</p>
      {action}
    </div>
  );
}

export function FlowError({ message, onRetry }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-[#D64545]/30 bg-[#D64545]/5 px-4 py-3 text-xs text-[#B02E2E]">
      <span className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
        {message || 'Could not load data.'}
      </span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="flow-btn-secondary !py-1">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

export function SectionHeader({ title, subtitle, icon: Icon, actions, className = '' }) {
  return (
    <div className={clsx('flex flex-wrap items-center justify-between gap-2 mb-3', className)}>
      <div className="flex items-center gap-2 min-w-0">
        {Icon && (
          <span className="w-7 h-7 rounded-lg bg-royal-100 text-royal-500 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-royal-900 truncate">{title}</h3>
          {subtitle && <p className="text-[11px] text-ink-500 truncate">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Readiness bar: green > 70, amber 40-70, red < 40. */
export function ReadinessBar({ score = 0, showLabel = true }) {
  const band = readinessBand(score);
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-cream-200 overflow-hidden" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label="Discharge readiness">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(3, score)}%`, backgroundColor: BAND_STYLES[band].hex }} />
      </div>
      {showLabel && <span className={clsx('text-xs font-bold tabular-nums w-8 text-right', BAND_STYLES[band].text)}>{score}</span>}
    </div>
  );
}

export default FlowModal;
