/**
 * @file MobileAlertsPage.jsx
 * Streamlined mobile alerts view (route /m) for clinicians and nurse managers on mobile devices.
 */

import React from 'react';
import { Bell, ShieldAlert, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import AlertItem from '../components/domain/AlertItem.jsx';
import Button from '../components/ui/Button.jsx';
import { useLiveStore } from '../store/liveStore.js';
import { acknowledgeAlert as apiAckAlert } from '../api/endpoints.js';

export function MobileAlertsPage() {
  const alerts = useLiveStore((s) => s.alerts);
  const optimisticAcknowledgeAlert = useLiveStore((s) => s.optimisticAcknowledgeAlert);

  const handleAcknowledge = async (id) => {
    optimisticAcknowledgeAlert(id);
    toast.success('Alert acknowledged', { duration: 2000 });
    try {
      await apiAckAlert(id);
    } catch {
      // rollback handled
    }
  };

  const openAlerts = alerts.filter((a) => a.status !== 'resolved');

  return (
    <div className="space-y-4 max-w-md mx-auto pb-16">
      <div className="flex items-center justify-between p-4 bg-surface-elevated rounded-xl border border-surface-border">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-500" />
          <h2 className="font-bold text-sm text-surface-foreground">
            Mobile Incident Feed
          </h2>
        </div>
        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-danger-500 text-white">
          {openAlerts.length} Active
        </span>
      </div>

      <div className="space-y-3">
        {openAlerts.map((alt) => (
          <AlertItem
            key={alt.id}
            alert={alt}
            onAcknowledge={handleAcknowledge}
          />
        ))}

        {openAlerts.length === 0 && (
          <div className="p-8 text-center text-xs text-surface-muted bg-surface-elevated rounded-xl border border-surface-border">
            No active alerts pending response.
          </div>
        )}
      </div>
    </div>
  );
}

export default MobileAlertsPage;
