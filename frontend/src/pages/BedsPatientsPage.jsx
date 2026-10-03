/**
 * @file BedsPatientsPage.jsx
 * Operational Bed Allocation and Patient Queue Management.
 * Features triage waiting queue, candidate bed AI matcher modal, and bed status distribution charts.
 */

import React, { useState } from 'react';
import { BedDouble, Users, Sparkles, CheckCircle2, Clock, Search } from 'lucide-react';
import Tabs from '../components/ui/Tabs.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Select from '../components/ui/Select.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import ChartCard from '../components/charts/ChartCard.jsx';
import StatusDoughnut from '../components/charts/StatusDoughnut.jsx';
import PatientRow from '../components/domain/PatientRow.jsx';
import { useLiveStore } from '../store/liveStore.js';
import { DEPARTMENTS, BED_STATUS } from '../utils/constants.js';
import { mockGetBedSuggestions } from '../api/mock/beds.js';

export function BedsPatientsPage() {
  const beds = useLiveStore((s) => s.beds);
  const patients = useLiveStore((s) => s.patients);
  const optimisticUpdateBed = useLiveStore((s) => s.optimisticUpdateBed);

  const [activeTab, setActiveTab] = useState('beds');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Bed Suggestion Modal state
  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
  const [selectedPatientForBed, setSelectedPatientForBed] = useState(null);
  const [candidates, setCandidates] = useState([]);

  // Filtered beds
  const filteredBeds = beds.filter((b) => {
    if (deptFilter !== 'all' && b.department.toLowerCase() !== deptFilter.toLowerCase()) return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        b.bedNumber.toLowerCase().includes(q) ||
        b.department.toLowerCase().includes(q) ||
        (b.patientName && b.patientName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Waiting Queue patients
  const waitingPatients = patients.filter((p) => p.status === 'waiting' || !p.bedId);

  // Status Doughnut counts
  const bedStatusCounts = [
    beds.filter((b) => b.status === BED_STATUS.AVAILABLE).length,
    beds.filter((b) => b.status === BED_STATUS.OCCUPIED).length,
    beds.filter((b) => b.status === BED_STATUS.CLEANING).length,
    beds.filter((b) => b.status === BED_STATUS.MAINTENANCE).length,
    beds.filter((b) => b.status === BED_STATUS.RESERVED).length,
  ];

  const handleOpenBedSuggestion = (patient) => {
    setSelectedPatientForBed(patient);
    const suggested = mockGetBedSuggestions(patient.id);
    setCandidates(suggested);
    setSuggestionModalOpen(true);
  };

  const handleAllocateBed = (bedId) => {
    optimisticUpdateBed(bedId, BED_STATUS.OCCUPIED);
    setSuggestionModalOpen(false);
  };

  const bedColumns = [
    { key: 'bedNumber', label: 'Bed Code', sortable: true },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'type', label: 'Type' },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'patientName',
      label: 'Occupant',
      render: (v, r) => (v ? `${v} (${r.patientAcuity ? `Acuity ${r.patientAcuity}` : ''})` : '—'),
    },
    {
      key: 'expectedReleaseTime',
      label: 'Est. Discharge',
      render: (v) => (v ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-surface-foreground flex items-center gap-2">
            <BedDouble className="w-5 h-5 text-primary-500" />
            Beds & Patients Management
          </h2>
          <p className="text-xs text-surface-muted mt-0.5">
            Real-time census, triage queue priority routing, and AI bed candidate matching.
          </p>
        </div>

        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'beds', label: 'Beds Inventory', count: beds.length },
            { id: 'queue', label: 'Waiting Queue', count: waitingPatients.length },
            { id: 'patients', label: 'All Patients', count: patients.length },
          ]}
        />
      </div>

      {/* ── TAB 1: BEDS INVENTORY ─────────────────────────────────────────── */}
      {activeTab === 'beds' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* Filter Strip */}
              <div className="flex flex-wrap items-center gap-3 p-3.5 bg-surface-elevated border border-surface-border rounded-xl">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Filter by bed, ward, occupant..."
                  className="max-w-xs"
                />
                <Select
                  value={deptFilter}
                  onChange={setDeptFilter}
                  options={[
                    { value: 'all', label: 'All Departments' },
                    ...DEPARTMENTS.map((d) => ({ value: d, label: d })),
                  ]}
                />
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'available', label: 'Available' },
                    { value: 'occupied', label: 'Occupied' },
                    { value: 'cleaning', label: 'Cleaning' },
                    { value: 'maintenance', label: 'Maintenance' },
                  ]}
                />
              </div>

              {/* Data Table */}
              <DataTable
                columns={bedColumns}
                data={filteredBeds}
                pageSize={12}
                keyExtractor={(b) => b.id}
              />
            </div>

            {/* Status Doughnut */}
            <div>
              <ChartCard
                title="Bed Status Breakdown"
                subtitle="Capacity distribution across all wards"
                height="h-72"
              >
                <StatusDoughnut counts={bedStatusCounts} title="80 Beds" />
              </ChartCard>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: WAITING QUEUE ──────────────────────────────────────────── */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-surface-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning-500" />
              Active Triage Queue ({waitingPatients.length} Patients Waiting for Bed)
            </h3>
            <span className="text-xs text-surface-muted">
              Auto-sorted by Acuity (1 Critical first) then Wait Duration
            </span>
          </div>

          <div className="space-y-3">
            {waitingPatients.map((patient) => (
              <PatientRow
                key={patient.id}
                patient={patient}
                onGetBedSuggestion={handleOpenBedSuggestion}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: ALL PATIENTS ───────────────────────────────────────────── */}
      {activeTab === 'patients' && (
        <div>
          <DataTable
            searchable
            columns={[
              { key: 'name', label: 'Patient Name', sortable: true },
              { key: 'mrn', label: 'MRN', sortable: true },
              {
                key: 'acuity',
                label: 'Acuity',
                render: (v) => <span className="font-mono font-bold">Acuity {v}</span>,
              },
              { key: 'department', label: 'Department' },
              { key: 'bedCode', label: 'Assigned Bed', render: (v) => v || 'In Queue' },
              {
                key: 'status',
                label: 'Status',
                render: (v) => <StatusBadge status={v} />,
              },
            ]}
            data={patients}
            pageSize={10}
            keyExtractor={(p) => p.id}
          />
        </div>
      )}

      {/* ── AI BED SUGGESTION MODAL ───────────────────────────────────────── */}
      <Modal
        isOpen={suggestionModalOpen}
        onClose={() => setSuggestionModalOpen(false)}
        title="AI Bed Allocation Matcher"
        subtitle={`Top Candidate Beds for ${selectedPatientForBed?.name || 'Patient'} (Acuity ${selectedPatientForBed?.acuity})`}
        size="lg"
        footer={
          <Button variant="ghost" onClick={() => setSuggestionModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-surface-muted">
            The AI engine evaluates department acuity protocols, infection controls, and current turnover times to suggest the most optimal bed candidates:
          </p>

          <div className="space-y-3">
            {candidates.map((cand, idx) => (
              <div
                key={cand.bedId}
                className="p-3.5 rounded-xl border border-surface-border bg-surface-sunken/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-600/10 text-primary-600 dark:text-primary-400 font-bold flex items-center justify-center text-xs shrink-0">
                    #{idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-surface-foreground">
                        Bed {cand.bedNumber}
                      </span>
                      <span className="text-xs text-surface-muted">
                        • {cand.department} (Floor {cand.floor})
                      </span>
                      <StatusBadge status={cand.status} size="xs" />
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {cand.reasons.map((r, i) => (
                        <li key={i} className="text-xs text-surface-muted flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-border">
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-mono font-bold text-primary-600 dark:text-primary-400">
                      {cand.score}% Fit
                    </span>
                    <span className="text-[11px] text-surface-muted">Match Score</span>
                  </div>
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={() => handleAllocateBed(cand.bedId)}
                  >
                    Assign Bed
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default BedsPatientsPage;
