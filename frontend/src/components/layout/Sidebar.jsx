/**
 * @file Sidebar.jsx
 * Royal Blue navigation sidebar (Reference A): white icons, highlighted active item, collapse toggle,
 * and only the pages that belong to the signed-in role.
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Radar,
  GitBranch,
  FlaskConical,
  ClipboardCheck,
  Map as MapIcon,
  UserRound,
  Sparkle,
  ScrollText,
  Brain,
  Scissors,
} from 'lucide-react';
import { useUiStore } from '../../store/uiStore.js';
import { useRole } from '../../hooks/useRole.js';
import { ROLE_LABELS } from '../../utils/roles.js';

/* Navigation per role: dashboard first, then the Flow Intelligence pages */
export const NAV_BY_ROLE = {
  admin: [
    { section: 'Overview' },
    { path: '/admin/dashboard', label: 'Dashboard', icon: Gauge },
    { section: 'Flow Intelligence' },
    { path: '/admin/flow/command-center', label: 'Command Center', icon: Radar },
    { path: '/admin/flow/bottlenecks', label: 'Bottleneck Map', icon: GitBranch },
    { path: '/admin/flow/simulator', label: 'What-If Simulator', icon: FlaskConical },
    { path: '/admin/flow/discharge-planner', label: 'Discharge Planner', icon: ClipboardCheck },
    { path: '/admin/beds-overview', label: 'Live Bed Map', icon: MapIcon },
    { path: '/admin/flow/staff', label: 'Staff and Doctors', icon: UserRound },
    { section: 'Operations' },
    { path: '/admin/flow/housekeeping', label: 'Housekeeping', icon: Sparkle },
    { path: '/admin/flow/audit', label: 'Audit Log', icon: ScrollText },
  ],
  doctor: [
    { section: 'Overview' },
    { path: '/doctor/dashboard', label: 'Dashboard', icon: Gauge },
    { section: 'Flow Intelligence' },
    { path: '/doctor/flow/predictions', label: 'My Patient Predictions', icon: Brain },
  ],
  ot_manager: [
    { section: 'Overview' },
    { path: '/ot/dashboard', label: 'Dashboard', icon: Gauge },
    { section: 'Flow Intelligence' },
    { path: '/ot/flow/impact', label: 'Flow Impact', icon: Scissors },
  ],
};

export function Sidebar() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const { role } = useRole();
  const location = useLocation();
  const items = NAV_BY_ROLE[role] || [];

  return (
    <aside
      className={clsx(
        'hidden md:flex flex-col bg-royal-500 text-white transition-all duration-300 z-30 select-none shrink-0',
        sidebarCollapsed ? 'w-[72px]' : 'w-60'
      )}
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="h-16 flex items-center px-4 justify-between border-b border-white/10">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-white text-royal-500 flex items-center justify-center shrink-0 shadow-sm">
            <Activity className="w-5 h-5" aria-hidden="true" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm tracking-tight">MediOrchestra</span>
              <span className="text-[10px] uppercase tracking-wider text-white/70">Flow Intelligence</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-hidden">
        {items.map((item) => {
          if (item.section) {
            return sidebarCollapsed ? (
              <div key={item.section} className="h-px bg-white/10 my-3 mx-2" aria-hidden="true" />
            ) : (
              <div key={item.section} className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/55 first:pt-0">
                {item.section}
              </div>
            );
          }
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={sidebarCollapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors relative',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
                isActive ? 'bg-white text-royal-500 font-bold shadow-sm' : 'text-white/85 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 text-[11px] text-white/70">
        {!sidebarCollapsed ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-white">{ROLE_LABELS[role] || 'Signed in'}</span>
            <span>Predict · Decide · Act</span>
          </div>
        ) : (
          <div className="text-center font-mono">MO</div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
