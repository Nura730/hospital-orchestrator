/**
 * @file NotificationCenter.jsx
 * Bell with unread count; dropdown grouped by type; live updates via notification.new.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Bell, CheckCheck } from 'lucide-react';
import flowApi from '../../api/flowApi.js';
import { socketClient } from '../../api/socket.js';
import { timeAgo } from '../../utils/flowFormat.js';

const GROUP_LABELS = {
  alert: 'Alerts',
  patient_critical: 'Critical patients',
  general: 'Flow actions',
  ot_assigned: 'OT',
  ot_changed: 'OT',
  ot_cancelled: 'OT',
  patient_assigned: 'Assignments',
  shift_reminder: 'Shifts',
};

export function NotificationCenter() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const list = await flowApi.getNotifications();
      setItems(Array.isArray(list) ? list : []);
    } catch {
      /* the bell stays quiet if notifications are unavailable */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    const unsub = socketClient.on('notification.new', (payload) => {
      const n = payload?.notification || payload;
      if (n && n.id) setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
    });
    return () => {
      clearInterval(t);
      unsub && unsub();
    };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const unread = items.filter((n) => !n.isRead).length;
  const groups = items.slice(0, 40).reduce((acc, n) => {
    const g = GROUP_LABELS[n.type] || 'Other';
    (acc[g] = acc[g] || []).push(n);
    return acc;
  }, {});

  const markAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await flowApi.markAllNotificationsRead();
    } catch {
      load();
    }
  };

  const markOne = async (n) => {
    if (n.isRead) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    try {
      await flowApi.markNotificationRead(n.id);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flow-btn-ghost !p-2 relative" aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,360px)] flow-card z-50 overflow-hidden animate-fade-in" role="dialog" aria-label="Notification center">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-cream-200 bg-cream-100">
            <span className="text-xs font-bold text-royal-900">Notifications · {unread} unread</span>
            <button type="button" className="flow-btn-ghost !py-1 !px-2 !text-[11px]" onClick={markAll} disabled={!unread}>
              <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" /> Mark all read
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
            {items.length === 0 && <p className="text-xs text-ink-500 text-center py-8">You're all caught up.</p>}
            {Object.entries(groups).map(([g, list]) => (
              <div key={g}>
                <div className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                  {g} · {list.length}
                </div>
                {list.map((n) => (
                  <button key={n.id} type="button" onClick={() => markOne(n)} className={clsx('w-full text-left px-3 py-2 border-b border-cream-200 hover:bg-royal-100 flex gap-2', !n.isRead && 'bg-royal-100/50')}>
                    <span className={clsx('w-2 h-2 rounded-full mt-1.5 shrink-0', n.isRead ? 'bg-transparent' : 'bg-royal-500')} aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="flex justify-between gap-2">
                        <span className="text-xs font-semibold text-ink-900 truncate">{n.title}</span>
                        <span className="text-[10px] text-ink-500 shrink-0">{timeAgo(n.createdAt)}</span>
                      </span>
                      <span className="block text-[11px] text-ink-500 line-clamp-2">{n.message}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;
