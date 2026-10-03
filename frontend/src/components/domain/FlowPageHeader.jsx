/**
 * @file FlowPageHeader.jsx
 * Reference A top bar for flow pages: title, breadcrumb, "Last analysis X seconds ago" health badge,
 * notification bell, page actions and user avatar.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronRight, Activity } from 'lucide-react';
import NotificationCenter from './NotificationCenter.jsx';
import { useLiveStore } from '../../store/liveStore.js';
import { useAuthStore } from '../../store/authStore.js';
import { initials, displayName } from '../../utils/flowFormat.js';

export function HealthBadge({ dark = false }) {
  const lastAnalysisAt = useLiveStore((s) => s.flowState.lastAnalysisAt || s.flowState.stateSummary?.lastAnalysisAt);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = lastAnalysisAt ? Math.max(0, Math.round((Date.now() - new Date(lastAnalysisAt).getTime()) / 1000)) : null;
  const stale = secs === null || secs > 180;
  const label = secs === null ? 'Waiting for analysis' : secs < 60 ? `Last analysis ${secs}s ago` : `Last analysis ${Math.round(secs / 60)} min ago`;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums',
        dark ? 'border-white/20 text-white bg-white/5' : stale ? 'border-[#F2A93B]/50 bg-[#F2A93B]/15 text-[#8A5200]' : 'border-[#1FA971]/40 bg-[#1FA971]/10 text-[#13784F]'
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
 * @param {{ title: string, subtitle?: string, crumbs?: {label: string, to?: string}[], actions?: React.ReactNode, greeting?: boolean }} props
 */
export function FlowPageHeader({ title, subtitle, crumbs = [], actions, dark = false }) {
  const user = useAuthStore((s) => s.user);
  const name = displayName(user);
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] text-ink-500 mb-1">
            {crumbs.map((c, i) => (
              <React.Fragment key={c.label}>
                {i > 0 && <ChevronRight className="w-3 h-3" aria-hidden="true" />}
                {c.to ? (
                  <Link to={c.to} className="hover:text-royal-500 hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className={dark ? 'text-white/80' : 'text-ink-900 font-medium'}>
                    {c.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className={clsx('text-xl md:text-2xl font-extrabold tracking-tight', dark ? 'text-white' : 'text-royal-900')}>{title}</h1>
        {subtitle && <p className={clsx('text-xs mt-0.5', dark ? 'text-white/70' : 'text-ink-500')}>{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <HealthBadge dark={dark} />
        {actions}
        <NotificationCenter />
        <span className="w-9 h-9 rounded-full bg-royal-500 text-white text-xs font-bold flex items-center justify-center" title={name} aria-label={`Signed in as ${name}`}>
          {initials(name)}
        </span>
      </div>
    </header>
  );
}

export default FlowPageHeader;
