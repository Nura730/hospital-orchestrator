/**
 * @file NotificationCenter.jsx
 * Bell with unread count. Each person only sees notifications meant for them (their requests, their
 * patients, their tasks). Clicking one marks it read and opens the related page. Live across tabs.
 * New arrivals are announced: a system notification when this tab is in the background (opt-in from the
 * bell menu), otherwise a toast. Urgent ones play a short tone. Already-present items are never announced.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Bell, BellRing, BellOff, CheckCheck, AlertTriangle, Scissors, MessageSquare, Info, ChevronRight } from 'lucide-react';
import flowApi, { isFlowMock } from '../../api/flowApi.js';
import careApi from '../../api/careApi.js';
import { socketClient } from '../../api/socket.js';
import { liveEmitter } from '../../api/mock/liveEmitter.js';
import { HOSPITAL_CHANGED } from '../../api/mock/hospitalSync.js';
import { useAuthStore } from '../../store/authStore.js';
import { timeAgo } from '../../utils/flowFormat.js';
import * as desktop from '../../utils/desktopAlerts.js';

const KIND = {
  alert: [AlertTriangle, '#B91C1C'],
  patient_critical: [AlertTriangle, '#B91C1C'],
  ot_assigned: [Scissors, '#6D28D9'],
  ot_changed: [Scissors, '#6D28D9'],
  request: [MessageSquare, '#014BAA'],
};

/** Local roles (nurse, patient) and mock mode read the shared hospital; staff in real mode use the API. */
function useSource(role) {
  const local = isFlowMock || role === 'nurse' || role === 'patient';
  return {
    list: () => (local ? careApi.getNotifications(role) : flowApi.getNotifications()),
    readAll: () => (local ? careApi.markAllRead(role) : flowApi.markAllNotificationsRead()),
    readOne: (id) => (local ? careApi.markRead(id, role) : flowApi.markNotificationRead(id)),
  };
}

export function NotificationCenter() {
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();
  const src = useSource(role);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [alertsOn, setAlertsOn] = useState(desktop.isEnabled());
  const ref = useRef(null);
  const seen = useRef(null); // ids already present; null until the first load for this role
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const roleRef = useRef(role);
  roleRef.current = role;

  const announce = useCallback((fresh) => {
    const urgent = fresh.some((n) => desktop.URGENT_TYPES.includes(n.type));
    if (desktop.isBackground()) {
      fresh.slice(0, 3).forEach((n) => desktop.showDesktop(n, () => n.link && navigateRef.current(n.link)));
      if (fresh.length > 3) desktop.showDesktop({ id: `more-${fresh[3].id}`, title: `${fresh.length - 3} more notifications`, message: 'Open MediOrchestra to see them all' });
    } else {
      fresh.slice(0, 3).forEach((n) => toast(n.title, { icon: desktop.URGENT_TYPES.includes(n.type) ? <AlertTriangle className="w-4 h-4 text-[#B91C1C]" aria-hidden="true" /> : <Bell className="w-4 h-4 text-royal-500" aria-hidden="true" />, id: `n-${n.id}`, duration: 5000 }));
    }
    if (urgent && desktop.isEnabled()) desktop.chime();
  }, []);

  const load = useCallback(async () => {
    try {
      const forRole = role;
      const list = await src.list();
      if (roleRef.current !== forRole) return; // someone else signed in meanwhile
      const arr = Array.isArray(list) ? list : [];
      if (seen.current === null) {
        seen.current = new Set(arr.map((n) => n.id)); // first load: nothing is "new"
      } else {
        const fresh = arr.filter((n) => !seen.current.has(n.id) && !n.isRead);
        arr.forEach((n) => seen.current.add(n.id));
        const mine = fresh.filter((n) => desktop.claim(`${role}:${n.id}`));
        if (mine.length) announce(mine);
      }
      setItems(arr);
    } catch {
      /* the bell stays quiet if notifications are unavailable */
    }
  }, [role, announce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    seen.current = null; // a different person signed in: start fresh
  }, [role]);

  const toggleAlerts = async () => {
    if (alertsOn) {
      desktop.disable();
      setAlertsOn(false);
      return;
    }
    const on = await desktop.enable();
    setAlertsOn(on);
    if (on) toast.success('Desktop alerts are on');
    else if (desktop.permission() === 'denied') toast.error('Notifications are blocked for this site in your browser settings');
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    const offLive = liveEmitter.on(HOSPITAL_CHANGED, () => load());
    const offSocket = socketClient.on('notification.new', () => load());
    return () => {
      clearInterval(t);
      offLive();
      if (offSocket) offSocket();
    };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const unread = items.filter((n) => !n.isRead).length;

  const markAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await src.readAll();
    } catch {
      load();
    }
  };

  const openOne = async (n) => {
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    setOpen(false);
    if (n.link) navigate(n.link);
    try {
      if (!n.isRead) await src.readOne(n.id);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-sunken relative" aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-xs font-bold flex items-center justify-center tabular-nums">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,400px)] flow-card z-50 overflow-hidden animate-fade-in" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between px-4 py-3 border-b border-cream-200">
            <span className="text-sm font-bold text-ink-900">
              Notifications <span className="font-normal text-ink-500">({unread} unread)</span>
            </span>
            <button type="button" className="flow-btn-ghost !py-1 !px-2" onClick={markAll} disabled={!unread}>
              <CheckCheck className="w-4 h-4" aria-hidden="true" /> Mark all read
            </button>
          </div>
          {desktop.isSupported() && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-cream-200 bg-sunken/60">
              <span className="flex items-center gap-2 min-w-0">
                {alertsOn ? <BellRing className="w-4 h-4 text-royal-500 shrink-0" aria-hidden="true" /> : <BellOff className="w-4 h-4 text-ink-500 shrink-0" aria-hidden="true" />}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink-900">Desktop alerts</span>
                  <span className="block text-xs text-ink-500">
                    {desktop.permission() === 'denied' ? 'Blocked in browser settings' : alertsOn ? 'On, with a tone for urgent alerts' : 'Get alerts when this tab is in the background'}
                  </span>
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={alertsOn}
                aria-label="Desktop alerts"
                onClick={toggleAlerts}
                disabled={desktop.permission() === 'denied'}
                className={clsx('relative w-10 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50', alertsOn ? 'bg-royal-500' : 'bg-cream-200')}
              >
                <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', alertsOn && 'translate-x-4')} />
              </button>
            </div>
          )}
          <div className="max-h-[460px] overflow-y-auto scrollbar-thin">
            {items.length === 0 && <p className="text-sm text-ink-500 text-center py-10">You are all caught up.</p>}
            {items.slice(0, 40).map((n) => {
              const [Icon, color] = KIND[n.type] || [Info, '#475569'];
              return (
                <button key={n.id} type="button" onClick={() => openOne(n)} className={clsx('w-full text-left px-4 py-3 border-b border-cream-200 hover:bg-sunken flex gap-3', !n.isRead && 'bg-royal-500/5')}>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}14`, color }}>
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex justify-between gap-2">
                      <span className={clsx('text-sm truncate', n.isRead ? 'text-ink-900' : 'font-semibold text-ink-900')}>{n.title}</span>
                      <span className="text-xs text-ink-500 shrink-0">{timeAgo(n.createdAt)}</span>
                    </span>
                    {n.message && <span className="block text-xs text-ink-500 line-clamp-2 mt-0.5">{n.message}</span>}
                  </span>
                  {n.link && <ChevronRight className="w-4 h-4 text-ink-500 self-center shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;
