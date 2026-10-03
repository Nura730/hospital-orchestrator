/**
 * @file MobileBottomNav.jsx
 * Bottom navigation for phones: the signed-in role's pages (same list as the sidebar).
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useRole } from '../../hooks/useRole.js';
import { NAV_BY_ROLE } from './Sidebar.jsx';

const SHORT = {
  'Command Center': 'Command',
  'Bottleneck Map': 'Bottlenecks',
  'What-If Simulator': 'Simulate',
  'Discharge Planner': 'Discharge',
  'Live Bed Map': 'Beds',
  'Staff and Doctors': 'Staff',
  'My Patient Predictions': 'Predictions',
  'Flow Impact': 'Impact',
};

export function MobileBottomNav() {
  const location = useLocation();
  const { role } = useRole();
  // Phones get the five most important pages
  const items = (NAV_BY_ROLE[role] || []).filter((i) => i.path).slice(0, 5);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-royal-500 text-white flex items-center justify-around z-40 px-2 select-none" aria-label="Mobile navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            aria-current={isActive ? 'page' : undefined}
            className={clsx('flex flex-col items-center justify-center gap-1 min-w-[56px] py-1 rounded-lg text-[10px] font-medium', isActive ? 'bg-white text-royal-500 font-bold' : 'text-white/80')}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
            <span>{SHORT[item.label] || item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default MobileBottomNav;
