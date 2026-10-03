/**
 * @file AuditLogPage.jsx
 * Compliance and Security Audit Trail (Admin Restricted).
 * Searchable, filterable, and paginated logs of user logins, triage assignments, bed status changes, and AI approvals.
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Download, Filter } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';
import Select from '../components/ui/Select.jsx';
import Badge from '../components/ui/Badge.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import { getAuditLogs } from '../api/endpoints.js';

export function AuditLogPage() {
  const [roleFilter, setRoleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      try {
        const res = await getAuditLogs({
          userRole: roleFilter,
          action: actionFilter,
          search: searchQuery,
        });
        if (res.ok) {
          setLogs(res.data?.data || res.data || []);
        }
        setLoading(false);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
        setLoading(false);
      }
    }
    loadLogs();
  }, [roleFilter, actionFilter, searchQuery]);

  const auditColumns = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      width: '180px',
      render: (v) => (
        <span className="font-mono text-xs text-surface-muted">
          {new Date(v).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'userName',
      label: 'Operator',
      render: (v, r) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-surface-foreground">{v}</span>
          <Badge color="neutral" size="xs">
            {r.userRole}
          </Badge>
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (v) => (
        <span className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400">
          {v}
        </span>
      ),
    },
    { key: 'details', label: 'Audit Trail Details' },
    {
      key: 'ip',
      label: 'Client IP',
      width: '120px',
      render: (v) => <span className="font-mono text-xs text-surface-muted">{v}</span>,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-surface-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary-500" />
            Compliance & Security Audit Trail
          </h2>
          <p className="text-xs text-surface-muted mt-0.5">
            Immutable log of all clinical approvals, patient admissions, bed reassignments, and system overrides.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={Download}
          onClick={() => alert('Audit log exported to CSV')}
        >
          Export CSV Audit Log
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3.5 bg-surface-elevated border border-surface-border rounded-xl">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Filter by operator name, action, details..."
          className="max-w-xs"
        />
        <Select
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: 'all', label: 'All Roles' },
            { value: 'admin', label: 'Hospital Admin' },
            { value: 'bed_manager', label: 'Bed Manager' },
            { value: 'nurse_manager', label: 'Nurse Manager' },
            { value: 'doctor', label: 'Doctor / Surgeon' },
          ]}
        />
        <Select
          value={actionFilter}
          onChange={setActionFilter}
          options={[
            { value: 'all', label: 'All Actions' },
            { value: 'PATIENT_TRIAGED', label: 'Patient Triaged' },
            { value: 'PATIENT_ADMITTED', label: 'Patient Admitted' },
            { value: 'BED_STATUS_CHANGED', label: 'Bed Status Changed' },
            { value: 'RECOMMENDATION_APPROVED', label: 'Recommendation Approved' },
            { value: 'OT_EMERGENCY_INSERT', label: 'OT Emergency Insert' },
            { value: 'ALERT_ACKNOWLEDGED', label: 'Alert Acknowledged' },
          ]}
        />
      </div>

      {/* Audit Table */}
      <DataTable
        columns={auditColumns}
        data={logs}
        pageSize={12}
        keyExtractor={(l) => l.id}
      />
    </div>
  );
}

export default AuditLogPage;
