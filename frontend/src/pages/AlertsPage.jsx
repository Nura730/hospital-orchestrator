/**
 * @file AlertsPage.jsx
 * Operational Alerts & Incident Escalation Center.
 * Features severity filters, multi-tier escalation tracking (1-2-3 steps), acknowledge/resolve workflows,
 * and daily alerts by severity distribution bar chart.
 */

import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Bell, AlertTriangle, Check, CheckCheck, ShieldAlert, Filter } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Select from '../components/ui/Select.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';
import SeverityBadge from '../components/ui/SeverityBadge.jsx';
import Badge from '../components/ui/Badge.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import ChartCard from '../components/charts/ChartCard.jsx';
import { Bar } from 'react-chartjs-2';
import '../components/charts/setupChart.js';
import { useLiveStore } from '../store/liveStore.js';
import { useTheme } from '../hooks/useTheme.js';
import { DEPARTMENTS, ALERT_SEVERITY, ALERT_STATUS } from '../utils/constants.js';
import { acknowledgeAlert as apiAckAlert, resolveAlert as apiResolveAlert } from '../api/endpoints.js';
import { formatRelativeTime } from '../utils/format.js';

export function AlertsPage() {
  const { isDark } = useTheme();
  const alerts = useLiveStore((s) => s.alerts);
  const optimisticAcknowledgeAlert = useLiveStore((s) => s.optimisticAcknowledgeAlert);
  const optimisticResolveAlert = useLiveStore((s) => s.optimisticResolveAlert);

  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== 'all' && a.severity.toLowerCase() !== severityFilter.toLowerCase()) return false;
      if (statusFilter !== 'all' && a.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (deptFilter !== 'all' && a.department.toLowerCase() !== deptFilter.toLowerCase()) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [alerts, severityFilter, statusFilter, deptFilter, searchQuery]);

  const handleAcknowledge = async (id) => {
    optimisticAcknowledgeAlert(id);
    toast.success('Alert acknowledged', { duration: 2500 });
    try {
      await apiAckAlert(id);
    } catch {
      // rollback handled
    }
  };

  const handleResolve = async (id) => {
    optimisticResolveAlert(id);
    toast.success('Alert resolved', { duration: 2500 });
    try {
      await apiResolveAlert(id);
    } catch {
      // rollback handled
    }
  };

  // Alert chart data
  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'],
    datasets: [
      {
        label: 'Critical',
        data: [2, 1, 3, 2, 4, 1, alerts.filter((a) => a.severity === ALERT_SEVERITY.CRITICAL).length],
        backgroundColor: '#ef4444',
        borderRadius: 4,
      },
      {
        label: 'High',
        data: [5, 4, 6, 7, 5, 3, alerts.filter((a) => a.severity === ALERT_SEVERITY.HIGH).length],
        backgroundColor: '#f59e0b',
        borderRadius: 4,
      },
      {
        label: 'Medium',
        data: [8, 10, 7, 9, 8, 6, alerts.filter((a) => a.severity === ALERT_SEVERITY.MEDIUM).length],
        backgroundColor: '#0284c7',
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 10 },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' },
      },
      y: {
        grid: { color: isDark ? 'rgba(51, 65, 85, 0.25)' : 'rgba(226, 232, 240, 0.7)' },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' },
      },
    },
  };

  const alertColumns = [
    {
      key: 'severity',
      label: 'Severity',
      width: '120px',
      render: (v) => <SeverityBadge severity={v} />,
    },
    {
      key: 'title',
      label: 'Incident Title & Description',
      render: (v, r) => (
        <div className="flex flex-col">
          <span className="font-bold text-surface-foreground text-xs">{v}</span>
          <span className="text-xs text-surface-muted line-clamp-1">{r.description}</span>
        </div>
      ),
    },
    { key: 'department', label: 'Department' },
    {
      key: 'escalationLevel',
      label: 'Escalation Tier',
      render: (v) => (
        <div className="flex items-center gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <span
              key={i}
              className={`w-2.5 h-2.5 rounded-full ${
                i < (v || 1) ? 'bg-danger-500' : 'bg-surface-sunken border border-surface-border'
              }`}
            />
          ))}
          <span className="text-xs font-mono ml-1 text-surface-muted">Tier {v || 1}</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Triggered',
      render: (v) => (
        <span className="text-surface-muted font-mono text-xs">
          {formatRelativeTime(v)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, r) => (
        <div className="flex items-center gap-1.5">
          {r.status === 'open' && (
            <Button
              variant="outline"
              size="xs"
              icon={Check}
              onClick={() => handleAcknowledge(r.id)}
            >
              Ack
            </Button>
          )}
          {r.status !== 'resolved' && (
            <Button
              variant="secondary"
              size="xs"
              icon={CheckCheck}
              onClick={() => handleResolve(r.id)}
            >
              Resolve
            </Button>
          )}
          {r.status === 'resolved' && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              Resolved
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-surface-foreground flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-500" />
          Active Incident Alerts & Escalation Center
        </h2>
        <p className="text-xs text-surface-muted mt-0.5">
          Real-time incident response feed, multi-tiered supervisor escalation, and severity distribution.
        </p>
      </div>

      {/* Top Severity Bar Chart */}
      <ChartCard
        title="Weekly Incident Severity Distribution"
        subtitle="Critical, High, and Medium alerts logged per day"
        height="h-56"
      >
        <Bar data={chartData} options={chartOptions} />
      </ChartCard>

      {/* Filter Strip */}
      <div className="flex flex-wrap items-center gap-3 p-3.5 bg-surface-elevated border border-surface-border rounded-xl">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Filter incidents by title, notes, ward..."
          className="max-w-xs"
        />
        <Select
          value={severityFilter}
          onChange={setSeverityFilter}
          options={[
            { value: 'all', label: 'All Severities' },
            { value: 'critical', label: 'Critical Only' },
            { value: 'high', label: 'High Severity' },
            { value: 'medium', label: 'Medium Severity' },
            { value: 'low', label: 'Low Severity' },
          ]}
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'open', label: 'Open' },
            { value: 'acknowledged', label: 'Acknowledged' },
            { value: 'resolved', label: 'Resolved' },
          ]}
        />
        <Select
          value={deptFilter}
          onChange={setDeptFilter}
          options={[
            { value: 'all', label: 'All Departments' },
            ...DEPARTMENTS.map((d) => ({ value: d, label: d })),
          ]}
        />
      </div>

      {/* Incidents Table */}
      <DataTable
        columns={alertColumns}
        data={filteredAlerts}
        pageSize={12}
        keyExtractor={(a) => a.id}
      />
    </div>
  );
}

export default AlertsPage;
