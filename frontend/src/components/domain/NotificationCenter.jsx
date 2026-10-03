/**
 * @file NotificationCenter.jsx
 * Bell with unread count. Each person only sees notifications meant for them (their requests, their
 * patients, their tasks). Clicking one marks it read and opens the related page. Live across tabs.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Bell, CheckCheck, AlertTriangle, Scissors, MessageSquare, Info, ChevronRight } from 'lucide-react';
import flowApi, { isFlowMock } from '../../api/flowApi.js';
import careApi from '../../api/careApi.js';
import { socketClient } from '../../api/socket.js';
import { liveEmitter } from '../../api/mock/liveEmitter.js';
import { HOSPITAL_CHANGED } from '../../api/mock/hospitalSync.js';
import { useAuthStore } from '../../store/authStore.js';
import { timeAgo } from '../../utils/flowFormat.js';

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
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const list = await src.list();
      setItems(Array.isArray(list) ? list : []);
    } catch {
      /* the bell stays quiet if notifications are unavailable */
    }
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

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
