/**
 * @file Sidebar.jsx
 * Operational navigation sidebar with role-filtered links, badges, collapse toggle, and hospital branding.
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  Activity,
  LayoutDashboard,
  Layers,
  BedDouble,
  Users2,
  Stethoscope,
  Sparkles,
  Sliders,
  Bell,
  BarChart3,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useUiStore } from '../../store/uiStore.js';
import { useLiveStore } from '../../store/liveStore.js';
import { useRole } from '../../hooks/useRole.js';

const NAV_ITEMS = [
  { path: '/', label: 'Command Center', icon: LayoutDashboard },
  { path: '/digital-twin', label: 'Digital Twin', icon: Layers },
  { path: '/beds-patients', label: 'Beds & Patients', icon: BedDouble },
  { path: '/staff-ot', label: 'Staff & OT', icon: Users2 },
  { path: '/equipment', label: 'Equipment', icon: Stethoscope },
  {
    path: '/recommendations',
    label: 'Recommendations',
    icon: Sparkles,
    badgeKey: 'pendingRecommendations',
  },
  { path: '/simulator', label: 'Simulator', icon: Sliders },
  {
    path: '/alerts',
    label: 'Alerts',
    icon: Bell,
    badgeKey: 'activeAlerts',
  },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/audit-log', label: 'Audit Log', icon: ShieldCheck },
];

export function Sidebar() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const counts = useLiveStore((s) => s.counts);
  const { isRouteAllowed } = useRole();
  const location = useLocation();

  // Filter routes allowed for current role (Hide, don't just disable)
  const accessibleNav = NAV_ITEMS.filter((item) => isRouteAllowed(item.path));

  return (
    <aside
      className={clsx(
        'hidden md:flex flex-col border-r border-surface-border bg-surface-elevated transition-all duration-300 z-30 select-none shrink-0',
        sidebarCollapsed ? 'w-18' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-surface-border justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-700 to-primary-500 flex items-center justify-center text-white shadow-md shadow-primary-500/20 shrink-0">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sm text-surface-foreground tracking-tight">
                MediOrchestra
              </span>
              <span className="text-[10px] uppercase font-mono text-primary-600 dark:text-primary-400 tracking-wider">
                AI Control Tower
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-lg text-surface-muted hover:text-surface-foreground hover:bg-surface-sunken cursor-pointer"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 no-scrollbar">
        {accessibleNav.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const badgeCount = item.badgeKey ? counts[item.badgeKey] : 0;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={sidebarCollapsed ? item.label : undefined}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group cursor-pointer relative',
                isActive
                  ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold'
                  : 'text-surface-muted hover:text-surface-foreground hover:bg-surface-sunken/60'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary-600 dark:bg-primary-400 rounded-r-full" />
              )}
              <Icon
                className={clsx(
                  'w-4 h-4 shrink-0 transition-colors',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-surface-muted group-hover:text-surface-foreground'
                )}
              />

              {!sidebarCollapsed && (
                <span className="truncate flex-1">{item.label}</span>
              )}

              {!sidebarCollapsed && badgeCount > 0 && (
                <span
                  className={clsx(
                    'text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-full',
                    item.badgeKey === 'activeAlerts'
                      ? 'bg-danger-500 text-white'
                      : 'bg-primary-500 text-white'
                  )}
                >
                  {badgeCount}
                </span>
              )}

              {sidebarCollapsed && badgeCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-danger-500" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Footer Info */}
      <div className="p-3 border-t border-surface-border text-xs text-surface-muted">
        {!sidebarCollapsed ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-surface-foreground text-[11px]">Metropolitan General</span>
            <span className="text-[10px] text-surface-muted">Operations v1.0 • Phase 1-9</span>
          </div>
        ) : (
          <div className="flex justify-center text-[10px] font-mono">v1.0</div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
