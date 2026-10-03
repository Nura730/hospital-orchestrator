/**
 * @file Topbar.jsx
 * Operational control topbar with LiveDot telemetry status, autonomy mode badge, theme toggle, alerts dropdown, and user menu.
 */

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sun,
  Moon,
  Bell,
  LogOut,
  Search,
  User,
  ShieldAlert,
  ChevronDown,
} from 'lucide-react';
import LiveDot from '../ui/LiveDot.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import { useUiStore } from '../../store/uiStore.js';
import { useAuthStore } from '../../store/authStore.js';
import { useLiveStore } from '../../store/liveStore.js';
import { useTheme } from '../../hooks/useTheme.js';
import { AUTONOMY_MODE_LABELS } from '../../utils/constants.js';

const ROUTE_TITLES = {
  '/': 'Operations Command Center',
  '/digital-twin': 'Hospital Digital Twin',
  '/beds-patients': 'Bed Allocation & Patient Queue',
  '/staff-ot': 'Staff Duty & Operating Theatres',
  '/equipment': 'Biomedical Equipment Tracking',
  '/recommendations': 'AI Orchestration Recommendations',
  '/simulator': 'Scenario & Surge Simulator',
  '/alerts': 'Active Alerts & Incident Escalation',
  '/analytics': 'Performance Analytics & Impact',
  '/audit-log': 'System & Compliance Audit Trail',
  '/_kit': 'UI Kit Showroom',
};

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const isConnected = useLiveStore((s) => s.isConnected);
  const alerts = useLiveStore((s) => s.alerts);
  const counts = useLiveStore((s) => s.counts);

  const autonomyMode = useUiStore((s) => s.autonomyMode);
  const globalSearch = useUiStore((s) => s.globalSearch);
  const setGlobalSearch = useUiStore((s) => s.setGlobalSearch);

  const [showAlertMenu, setShowAlertMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const pageTitle = ROUTE_TITLES[location.pathname] || 'MediOrchestra';
  const openAlerts = alerts.filter((a) => a.status === 'open');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 px-6 border-b border-surface-border bg-surface-elevated flex items-center justify-between z-20 shrink-0 select-none">
      {/* Page Title & Breadcrumb */}
      <div className="flex items-center gap-4">
        <h1 className="text-base font-bold text-surface-foreground tracking-tight">
          {pageTitle}
        </h1>
      </div>

      {/* Center Global Search */}
      <div className="hidden lg:flex items-center w-72 relative">
        <Search className="w-4 h-4 text-surface-muted absolute left-3 pointer-events-none" />
        <input
          type="text"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Global search (patient, bed, staff, alert)..."
          className="w-full text-xs pl-9 pr-3 py-1.5 bg-surface-sunken border border-surface-border rounded-lg text-surface-foreground placeholder-surface-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Live Socket Status */}
        <LiveDot isConnected={isConnected} />

        {/* Autonomy Mode Badge */}
        <Badge
          color={autonomyMode === 'auto' ? 'danger' : autonomyMode === 'approval' ? 'primary' : 'info'}
          size="sm"
          className="hidden sm:inline-flex cursor-pointer"
          onClick={() => navigate('/recommendations')}
          title="Click to manage AI autonomy levels"
        >
          {AUTONOMY_MODE_LABELS[autonomyMode] || 'Approval Required'}
        </Badge>

        {/* Theme Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </Button>

        {/* Alerts Bell Dropdown */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowAlertMenu(!showAlertMenu)}
            aria-label="View recent alerts"
            className="relative"
          >
            <Bell className="w-4 h-4 text-surface-muted" />
            {counts.activeAlerts > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger-500 animate-ping" />
            )}
            {counts.activeAlerts > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger-500" />
            )}
          </Button>

          {showAlertMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-surface-elevated border border-surface-border rounded-xl shadow-xl z-50 p-2 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
                <span className="font-semibold text-xs text-surface-foreground">
                  Active Alerts ({openAlerts.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAlertMenu(false);
                    navigate('/alerts');
                  }}
                  className="text-[11px] text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                >
                  View All
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-surface-border/50 py-1">
                {openAlerts.slice(0, 4).map((alt) => (
                  <div key={alt.id} className="p-2.5 hover:bg-surface-sunken/40 rounded-lg text-xs">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-surface-foreground truncate">
                        {alt.title}
                      </span>
                      <span className="text-[10px] uppercase font-mono text-danger-500">
                        {alt.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-surface-muted line-clamp-2">
                      {alt.description}
                    </p>
                  </div>
                ))}
                {openAlerts.length === 0 && (
                  <p className="text-center py-4 text-xs text-surface-muted">
                    No active critical alerts
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl hover:bg-surface-sunken text-left transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-primary-600/10 text-primary-600 dark:text-primary-400 border border-primary-500/20 flex items-center justify-center font-bold text-xs">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-semibold text-surface-foreground leading-tight">
                {user?.name || 'Administrator'}
              </span>
              <span className="text-[10px] text-surface-muted capitalize">
                {user?.role || 'admin'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-surface-muted" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-surface-elevated border border-surface-border rounded-xl shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 border-b border-surface-border">
                <p className="font-semibold text-xs text-surface-foreground">{user?.name}</p>
                <p className="text-[11px] text-surface-muted">{user?.email}</p>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-danger-600 dark:text-danger-400 hover:bg-danger-500/10 rounded-lg cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
