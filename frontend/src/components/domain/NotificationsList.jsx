/**
 * @file NotificationsList.jsx
 * Compact notification list: icon + message + time, unread rows get a blue left border, "Mark all read".
 * source="flow" uses the hospital API (real backend aware); source="care" stays in the browser (nurse / patient).
 */

import React from 'react';
import clsx from 'clsx';
import { Bell, AlertTriangle, Scissors, CheckCheck } from 'lucide-react';
import flowApi, { isFlowMock } from '../../api/flowApi.js';
import { useAuthStore } from '../../store/authStore.js';
import careApi from '../../api/careApi.js';
import { useFlowPolling } from '../../hooks/useFlowPolling.js';
import { FlowSkeleton, FlowError } from './FlowUi.jsx';
import { MiniEmpty } from './CareUi.jsx';
import { timeAgo } from '../../utils/flowFormat.js';

const ICON = { alert: [AlertTriangle, '#EF4444'], ot_assigned: [Scissors, '#8B5CF6'] };

function normalise(list) {
  const rows = Array.isArray(list) ? list : list?.notifications || list?.items || [];
  return rows.map((n) => ({
    id: n.id,
    type: n.type || n.notification_type || 'general',
    title: n.title || n.message,
    message: n.title ? n.message : '',
    isRead: Boolean(n.isRead ?? n.is_read),
    createdAt: n.createdAt || n.created_at,
  }));
}

export function NotificationsList({ source = 'flow', max }) {
  const role = useAuthStore((s) => s.role);
  const local = source === 'care' || isFlowMock;
  const api = local ? { list: () => careApi.getNotifications(role), all: () => careApi.markAllRead(role) } : { list: flowApi.getNotifications, all: flowApi.markAllNotificationsRead };
  const q = useFlowPolling(() => api.list(), { intervalMs: 30000, refreshOn: ['notification.new'], toastOnError: false });
  const rows = normalise(q.data);
  const unread = rows.filter((n) => !n.isRead).length;
  const shown = max ? rows.slice(0, max) : rows;

  const markAll = async () => {
    await api.all();
    q.refresh({ silent: true });
  };

  return (
    <section className="flow-card">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-cream-200">
        <h3 className="label-xs">Notifications {unread > 0 && <span className="ml-1 rounded-full bg-royal-500 px-1.5 text-[11px] text-white">{unread}</span>}</h3>
        <button type="button" className="flow-btn-ghost !py-1" onClick={markAll} disabled={!unread}>
          <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" /> Mark all read
        </button>
      </div>
      {q.error && !q.data && (
        <div className="p-3">
          <FlowError message={q.error} onRetry={q.refresh} />
        </div>
      )}
      {q.loading && !q.data && (
        <div className="p-4">
          <FlowSkeleton lines={4} />
        </div>
      )}
      {q.data && !shown.length && <MiniEmpty text="No notifications" icon={Bell} />}
      <ul className="max-h-[520px] overflow-y-auto">
        {shown.map((n) => {
          const [Icon, color] = ICON[n.type] || [Bell, '#014BAA'];
          return (
            <li key={n.id} className={clsx('flex items-start gap-3 px-4 py-2.5 border-b border-cream-200 last:border-0 border-l-2', n.isRead ? 'border-l-transparent' : 'border-l-royal-500 bg-royal-500/5')}>
              <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className={clsx('text-xs truncate', n.isRead ? 'text-ink-500' : 'text-ink-900 font-semibold')}>{n.title}</p>
                {n.message && <p className="text-xs text-ink-500 truncate">{n.message}</p>}
              </div>
              <span className="text-[11px] text-ink-500 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default NotificationsList;
