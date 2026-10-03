/**
 * @file Topbar.jsx
 * Slim cream top bar: section name, live connection status and the user menu (role + sign out).
 * Page titles, breadcrumbs and the notification bell live in each page's FlowPageHeader.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { LogOut, ChevronDown, Activity } from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import { useLiveStore } from '../../store/liveStore.js';
import { ROLE_LABELS } from '../../utils/roles.js';
import { initials, displayName } from '../../utils/flowFormat.js';

const SECTION = [
  ['/admin/flow', 'Admin · Flow Intelligence'],
  ['/admin', 'Admin'],
  ['/doctor/flow', 'Doctor · Flow Intelligence'],
  ['/doctor', 'Doctor'],
  ['/ot/flow', 'OT · Flow Intelligence'],
  ['/ot', 'Operating Theatres'],
];

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const isConnected = useLiveStore((s) => s.isConnected);
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const section = (SECTION.find(([p]) => location.pathname.startsWith(p)) || [null, 'MediOrchestra'])[1];
  const name = displayName(user);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-14 px-4 md:px-6 border-b border-cream-200 bg-cream-50 flex items-center justify-between z-20 shrink-0 select-none">
      <div className="flex items-center gap-2 min-w-0">
        <span className="md:hidden w-8 h-8 rounded-lg bg-royal-500 text-white flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4" aria-hidden="true" />
        </span>
        <span className="text-xs font-semibold text-ink-500 truncate">{section}</span>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={clsx('inline-flex items-center gap-1.5 text-[11px] font-semibold', isConnected ? 'text-[#13784F]' : 'text-ink-500')}
          role="status"
          title={isConnected ? 'Real-time updates connected' : 'Real-time updates disconnected'}
        >
          <span className={clsx('w-2 h-2 rounded-full', isConnected ? 'bg-[#1FA971] animate-pulse' : 'bg-[#6B7280]')} aria-hidden="true" />
          <span className="hidden sm:inline">{isConnected ? 'Live' : 'Offline'}</span>
        </span>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="menu"
            className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-xl hover:bg-royal-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-500"
          >
            <span className="w-8 h-8 rounded-full bg-royal-500 text-white flex items-center justify-center text-[11px] font-bold">{initials(name)}</span>
            <span className="hidden md:flex flex-col text-left leading-tight">
              <span className="text-xs font-semibold text-ink-900">{name}</span>
              <span className="text-[10px] text-ink-500">{ROLE_LABELS[role] || role}</span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-ink-500" aria-hidden="true" />
          </button>
          {open && (
            <div role="menu" className="absolute right-0 mt-2 w-56 flow-card p-1.5 z-50 animate-fade-in">
              <div className="px-3 py-2 border-b border-cream-200">
                <p className="text-xs font-semibold text-ink-900 truncate">{name}</p>
                <p className="text-[11px] text-ink-500 truncate">{user?.email}</p>
              </div>
              <button type="button" role="menuitem" onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 mt-1 text-xs text-[#B02E2E] hover:bg-[#D64545]/10 rounded-lg">
                <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
