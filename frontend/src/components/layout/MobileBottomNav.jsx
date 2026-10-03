/**
 * @file MobileBottomNav.jsx
 * Responsive bottom navigation bar for mobile device screens.
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Layers,
  BedDouble,
  Bell,
  Sparkles,
} from 'lucide-react';
import { useLiveStore } from '../../store/liveStore.js';

const MOBILE_NAV = [
  { path: '/', label: 'Command', icon: LayoutDashboard },
  { path: '/digital-twin', label: 'Twin', icon: Layers },
  { path: '/beds-patients', label: 'Beds', icon: BedDouble },
  { path: '/recommendations', label: 'AI Recs', icon: Sparkles, badgeKey: 'pendingRecommendations' },
  { path: '/alerts', label: 'Alerts', icon: Bell, badgeKey: 'activeAlerts' },
];

export function MobileBottomNav() {
  const location = useLocation();
  const counts = useLiveStore((s) => s.counts);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-elevated/95 backdrop-blur-md border-t border-surface-border flex items-center justify-around z-40 px-2 select-none">
      {MOBILE_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        const badgeCount = item.badgeKey ? counts[item.badgeKey] : 0;

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 w-14 py-1 rounded-lg text-[10px] font-medium transition-colors relative cursor-pointer',
              isActive
                ? 'text-primary-600 dark:text-primary-400 font-bold'
                : 'text-surface-muted hover:text-surface-foreground'
            )}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {badgeCount > 0 && (
                <span className="absolute -top-1 -right-2 text-[9px] font-bold bg-danger-500 text-white rounded-full px-1">
                  {badgeCount}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default MobileBottomNav;
