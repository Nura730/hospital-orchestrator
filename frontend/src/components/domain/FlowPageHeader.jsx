/**
 * @file FlowPageHeader.jsx
 * Shared page header and the "Last analysis X seconds ago" health badge.
 */

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Activity } from 'lucide-react';
import { useLiveStore } from '../../store/liveStore.js';

export function HealthBadge({ dark = false }) {
  const lastAnalysisAt = useLiveStore((s) => s.flowState.lastAnalysisAt || s.flowState.stateSummary?.lastAnalysisAt);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = lastAnalysisAt ? Math.max(0, Math.round((Date.now() - new Date(lastAnalysisAt).getTime()) / 1000)) : null;
  const stale = secs === null || secs > 180;
  if (secs === null) return null;
  const label = secs === null ? 'Waiting for analysis' : secs < 60 ? `Last analysis ${secs}s ago` : `Last analysis ${Math.round(secs / 60)} min ago`;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums',
        dark ? 'border-white/20 text-white bg-white/5' : stale ? 'border-[#F59E0B]/50 bg-[#F59E0B]/15 text-fg-warn' : 'border-[#10B981]/40 bg-[#10B981]/10 text-fg-ok'
      )}
      role="status"
      aria-live="off"
    >
      <Activity className={clsx('w-3.5 h-3.5', !stale && 'animate-pulse')} aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * One header for every page: title + optional subtitle on the left, actions on the right.
 * The analysis health badge shows on Flow Intelligence pages (showHealth).
 * @param {{ title: React.ReactNode, subtitle?: React.ReactNode, actions?: React.ReactNode, showHealth?: boolean }} props
 */
export function FlowPageHeader({ title, subtitle, actions, showHealth = true }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-royal-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
      </div>
      {(showHealth || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {showHealth && <HealthBadge />}
          {actions}
        </div>
      )}
    </header>
  );
}

export default FlowPageHeader;
