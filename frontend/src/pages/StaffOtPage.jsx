/**
 * @file StaffOtPage.jsx
 * Operational Staff Roster & Operating Theatres Gantt Management.
 * Features staff fatigue monitoring, OT Gantt timelines, and emergency surgical case insertion modal.
 */

import React, { useState } from 'react';
import { Users2, Activity, PlusCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import Tabs from '../components/ui/Tabs.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Select from '../components/ui/Select.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';
import ChartCard from '../components/charts/ChartCard.jsx';
import WorkloadBar from '../components/charts/WorkloadBar.jsx';
import OtGantt from '../components/charts/OtGantt.jsx';
import StaffRow from '../components/domain/StaffRow.jsx';
import { useLiveStore } from '../store/liveStore.js';
import { mockGetStaffMetrics } from '../api/mock/staff.js';
import { emergencyInsertCase } from '../api/endpoints.js';

export function StaffOtPage() {
  const staff = useLiveStore((s) => s.staff);
  const otRooms = useLiveStore((s) => s.otRooms);

  const [activeTab, setActiveTab] = useState('staff');
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Emergency Insert Modal
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('1');
  const [patientName, setPatientName] = useState('');
  const [procedure, setProcedure] = useState('');
  const [durationMins, setDurationMins] = useState(90);

  const staffMetrics = mockGetStaffMetrics();

  const filteredStaff = staff.filter((s) => {
    if (roleFilter !== 'all' && s.role.toLowerCase() !== roleFilter.toLowerCase()) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleEmergencyInsert = async (e) => {
    e.preventDefault();
    try {
      await emergencyInsertCase({
        roomId: Number(selectedRoomId),
        patientName: patientName || 'Trauma Arrival (Acuity 1)',
        procedure: procedure || 'Emergency Exploratory Laparotomy',
        surgeonName: 'Dr. Rachel Green, MD',
        durationMinutes: durationMins,
      });
      setEmergencyModalOpen(false);
      setPatientName('');
      setProcedure('');
    } catch (err) {
      console.error('Failed to insert emergency case:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-surface-foreground flex items-center gap-2">
            <Users2 className="w-5 h-5 text-primary-500" />
            Staff Roster & Operating Theatres
          </h2>
          <p className="text-xs text-surface-muted mt-0.5">
            Workforce load balancing, fatigue threshold tracking, and multi-room surgical schedules.
          </p>
        </div>

        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'staff', label: 'Staff Roster & Workload', count: staff.length },
            { id: 'ot', label: 'Operating Theatres (4 Rooms)' },
          ]}
        />
      </div>

      {/* ── TAB 1: STAFF ROSTER & WORKLOAD ────────────────────────────────── */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          {/* Top Workload Bar Chart */}
          <ChartCard
            title="Highest Loaded Clinical Staff"
            subtitle="Staff members exceeding workload thresholds (>75% warning, >90% critical)"
            height="h-64"
          >
            <WorkloadBar workloadData={staffMetrics.topWorkload} />
          </ChartCard>

          {/* Filters Strip */}
          <div className="flex flex-wrap items-center gap-3 p-3.5 bg-surface-elevated border border-surface-border rounded-xl">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search staff by name, title, department..."
              className="max-w-xs"
            />
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: 'all', label: 'All Roles' },
                { value: 'Doctor', label: 'Doctors & Specialists' },
                { value: 'Nurse', label: 'Nurses & Triage' },
                { value: 'Surgeon', label: 'Surgeons' },
                { value: 'Anesthetist', label: 'Anesthesiologists' },
                { value: 'Technician', label: 'Technicians & Orderlies' },
              ]}
            />
          </div>

          {/* Staff Roster List */}
          <div className="space-y-3">
            {filteredStaff.map((staffMember) => (
              <StaffRow key={staffMember.id} staffMember={staffMember} />
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 2: OPERATING THEATRES ─────────────────────────────────────── */}
      {activeTab === 'ot' && (
        <div className="space-y-6">
          {/* Action Header */}
          <div className="flex items-center justify-between p-4 bg-surface-elevated border border-surface-border rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-600/10 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-surface-foreground">
                  Real-time Surgical Timeline
                </h3>
                <span className="text-xs text-surface-muted">
                  Coordinated turnover cycles, elective surgeries, and overrun tracking
                </span>
              </div>
            </div>

            <Button
              variant="danger"
              size="sm"
              icon={PlusCircle}
              onClick={() => setEmergencyModalOpen(true)}
            >
              Emergency Insert Case
            </Button>
          </div>

          {/* OtGantt Component */}
          <Card title="Operating Theatre Daily Schedule Matrix">
            <OtGantt otRooms={otRooms} />
          </Card>
        </div>
      )}

      {/* ── EMERGENCY SURGERY INSERTION MODAL ──────────────────────────────── */}
      <Modal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        title="Immediate Emergency Case Insertion"
        subtitle="Diverts scheduled elective slots to clear immediate emergency trauma"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEmergencyModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleEmergencyInsert}>
              Execute Emergency Insert
            </Button>
          </>
        }
      >
        <form onSubmit={handleEmergencyInsert} className="space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-700 dark:text-danger-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Downstream scheduled electives will automatically be pushed forward.</span>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-surface-foreground">Select Operating Theatre</label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full bg-surface-elevated border border-surface-border rounded-lg p-2 text-xs text-surface-foreground"
            >
              <option value="1">OT-1 (Emergency & Trauma)</option>
              <option value="2">OT-2 (Cardiothoracic & Vascular)</option>
              <option value="3">OT-3 (Orthopedic Surgery)</option>
              <option value="4">OT-4 (Neurosurgery & Day Surgery)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-surface-foreground">Patient Name / Identifier</label>
            <input
              type="text"
              required
              placeholder="e.g. Unidentified Trauma MVC"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full bg-surface-elevated border border-surface-border rounded-lg p-2 text-xs text-surface-foreground"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-surface-foreground">Surgical Procedure</label>
            <input
              type="text"
              required
              placeholder="e.g. Exploratory Laparotomy / Splenectomy"
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              className="w-full bg-surface-elevated border border-surface-border rounded-lg p-2 text-xs text-surface-foreground"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-surface-foreground">Estimated Duration (Minutes)</label>
            <input
              type="number"
              min="30"
              max="360"
              step="15"
              value={durationMins}
              onChange={(e) => setDurationMins(Number(e.target.value))}
              className="w-full bg-surface-elevated border border-surface-border rounded-lg p-2 text-xs text-surface-foreground"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default StaffOtPage;
