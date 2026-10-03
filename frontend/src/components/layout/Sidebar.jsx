/**
 * @file Sidebar.jsx
 * Royal blue (#014BAA) navigation sidebar: white icons, white pill for the active page, collapse toggle,
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
  Users,
  HeartHandshake,
  Route,
  ListChecks,
  BedDouble,
  Bell,
  HeartPulse,
  FileText,
  MessageSquare,
  LifeBuoy,
  Clock3,
  CalendarDays,
} from 'lucide-react';
import { useUiStore } from '../../store/uiStore.js';
import { useRole } from '../../hooks/useRole.js';
import { ROLE_LABELS, ROLE_ACCENT } from '../../utils/roles.js';

/* Navigation per role */
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
    { section: 'People' },
    { path: '/admin/patients', label: 'Patients', icon: Users },
    { path: '/admin/flow/staff', label: 'Staff and Doctors', icon: UserRound },
    { path: '/admin/nurses', label: 'Nurse Management', icon: HeartHandshake },
    { section: 'Patient Tracking' },
    { path: '/admin/patient-journey', label: 'Patient Journey', icon: Route, prefix: true },
    { section: 'Operations' },
    { path: '/admin/flow/housekeeping', label: 'Housekeeping', icon: Sparkle },
    { path: '/admin/flow/audit', label: 'Audit Log', icon: ScrollText },
  ],
  doctor: [
    { section: 'Overview' },
    { path: '/doctor/dashboard', label: 'Dashboard', icon: Gauge },
    { section: 'My Work' },
    { path: '/doctor/schedule', label: "Today's Schedule", icon: Clock3 },
    { path: '/doctor/patients', label: 'My Patients', icon: Users },
    { path: '/doctor/ot-cases', label: 'OT Cases', icon: Scissors },
    { path: '/doctor/calendar', label: 'Calendar', icon: CalendarDays },
    { section: 'Flow Intelligence' },
    { path: '/doctor/flow/predictions', label: 'My Patient Predictions', icon: Brain },
  ],
  ot_manager: [
    { section: 'Overview' },
    { path: '/ot/dashboard', label: 'Dashboard', icon: Gauge },
    { section: 'Flow Intelligence' },
    { path: '/ot/flow/impact', label: 'Flow Impact', icon: Scissors },
  ],
  nurse: [
    { section: 'My Shift' },
    { path: '/nurse/dashboard', label: 'My Dashboard', icon: Gauge },
    { path: '/nurse/patients', label: 'My Patients', icon: Users },
    { path: '/nurse/tasks', label: 'Tasks', icon: ListChecks },
    { path: '/nurse/beds', label: 'Bed Board', icon: BedDouble },
    { path: '/nurse/notifications', label: 'Notifications', icon: Bell },
  ],
  patient: [
    { section: 'My Care' },
    { path: '/patient/dashboard', label: 'My Status', icon: HeartPulse },
    { path: '/patient/treatment', label: 'My Treatment', icon: Route },
    { path: '/patient/reports', label: 'Reports', icon: FileText },
    { path: '/patient/requests', label: 'Requests', icon: MessageSquare },
    { path: '/patient/help', label: 'Help', icon: LifeBuoy },
  ],
};

export function isNavActive(item, pathname) {
  return pathname === item.path || (item.prefix && pathname.startsWith(`${item.path}/`));
}

export function Sidebar() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const { role } = useRole();
  const location = useLocation();
  const items = NAV_BY_ROLE[role] || [];
  const accent = ROLE_ACCENT[role] || '#014BAA';

  return (
    <aside
      className={clsx(
        'hidden md:flex flex-col bg-[#014BAA] text-white transition-all duration-300 z-30 select-none shrink-0',
        sidebarCollapsed ? 'w-[72px]' : 'w-60'
      )}
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="h-14 flex items-center px-4 justify-between border-b border-white/10">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-white text-[#014BAA] flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" aria-hidden="true" />
          </div>
          {!sidebarCollapsed && <span className="font-bold text-sm tracking-tight">MediOrchestra</span>}
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
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 scrollbar-hidden">
        {items.map((item) => {
          if (item.section) {
            return sidebarCollapsed ? (
              <div key={item.section} className="h-px bg-white/15 my-3 mx-2" aria-hidden="true" />
            ) : (
              <div key={item.section} className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/80 first:pt-1">
                {item.section}
              </div>
            );
          }
          const Icon = item.icon;
          const isActive = isNavActive(item, location.pathname);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={sidebarCollapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
                isActive ? 'bg-white text-[#014BAA] font-semibold' : 'text-white/85 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 text-[11px]">
        {!sidebarCollapsed ? (
          <span className="inline-flex items-center gap-2 font-semibold text-white">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} aria-hidden="true" />
            {ROLE_LABELS[role] || 'Signed in'}
          </span>
        ) : (
          <span className="block w-2 h-2 mx-auto rounded-full" style={{ backgroundColor: accent }} aria-hidden="true" />
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
