/**
 * @file DigitalTwinPage.jsx
 * Interactive SVG Digital Twin hospital floor map with real-time ward telemetry,
 * predictive +2h forecast recoloring, and slide-out department bed & staff inspection drawer.
 */

import React, { useState } from 'react';
import { Layers, Activity, Users, Clock, Sparkles, AlertTriangle } from 'lucide-react';
import FloorMap from '../components/domain/FloorMap.jsx';
import BedGrid from '../components/domain/BedGrid.jsx';
import Drawer from '../components/ui/Drawer.jsx';
import Toggle from '../components/ui/Toggle.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import { useLiveStore } from '../store/liveStore.js';

export function DigitalTwinPage() {
  const beds = useLiveStore((s) => s.beds);
  const staff = useLiveStore((s) => s.staff);

  const [forecastMode, setForecastMode] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSelectDepartment = (deptId) => {
    setSelectedDept(deptId);
    setDrawerOpen(true);
  };

  // Department specific data for Drawer
  const deptBeds = selectedDept
    ? beds.filter((b) => b.department.toLowerCase() === selectedDept.toLowerCase())
    : [];
  const deptStaff = selectedDept
    ? staff.filter((s) => s.department.toLowerCase() === selectedDept.toLowerCase() && s.status !== 'off_duty')
    : [];

  const occupiedCount = deptBeds.filter((b) => b.status === 'occupied').length;
  const occupancyPct = deptBeds.length ? Math.round((occupiedCount / deptBeds.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-surface-elevated border border-surface-border">
        <div>
          <h2 className="text-base font-bold text-surface-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary-500" />
            Hospital Digital Twin (Floor Map Simulation)
          </h2>
          <p className="text-xs text-surface-muted mt-0.5">
            Real-time telemetry overlay across all 7 hospital operational sectors. Click any zone to inspect bed matrix.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Toggle
            checked={forecastMode}
            onChange={setForecastMode}
            label="Predictive +2h Forecast Overlay"
            description="Recolor zones by AI projected inflow"
          />
        </div>
      </div>

      {/* SVG Floor Map */}
      <FloorMap
        beds={beds}
        forecastMode={forecastMode}
        selectedDepartment={selectedDept}
        onSelectDepartment={handleSelectDepartment}
      />

      {/* Quick Summary Cards below Map */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-surface-muted font-medium">Flow Rate</span>
            <p className="text-sm font-bold text-surface-foreground">Optimal ER → ICU Transit</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-surface-muted font-medium">Turnover Bottleneck</span>
            <p className="text-sm font-bold text-surface-foreground">General Ward 45m Turnaround</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-surface-muted font-medium">Active Digital Sensors</span>
            <p className="text-sm font-bold text-surface-foreground">80 Telemetry Beds Synchronized</p>
          </div>
        </Card>
      </div>

      {/* Department Inspection Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`${selectedDept || 'Department'} Operational Status`}
        subtitle="Live Bed Telemetry & Staff Roster"
        width="max-w-xl"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>
            Close Inspection Panel
          </Button>
        }
      >
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-surface-sunken rounded-xl text-center">
              <span className="text-xs text-surface-muted block">Occupancy</span>
              <span className="text-xl font-bold font-mono text-surface-foreground">
                {occupancyPct}%
              </span>
            </div>
            <div className="p-3 bg-surface-sunken rounded-xl text-center">
              <span className="text-xs text-surface-muted block">Beds In Use</span>
              <span className="text-xl font-bold font-mono text-surface-foreground">
                {occupiedCount} / {deptBeds.length}
              </span>
            </div>
            <div className="p-3 bg-surface-sunken rounded-xl text-center">
              <span className="text-xs text-surface-muted block">Active Staff</span>
              <span className="text-xl font-bold font-mono text-surface-foreground">
                {deptStaff.length}
              </span>
            </div>
          </div>

          {/* Bed Grid */}
          <div>
            <h4 className="text-xs font-bold text-surface-foreground uppercase tracking-wider mb-2.5">
              Live Bed Matrix ({deptBeds.length} Beds)
            </h4>
            <BedGrid beds={deptBeds} columns="grid-cols-4 sm:grid-cols-6" />
          </div>

          {/* On-Duty Staff List */}
          <div>
            <h4 className="text-xs font-bold text-surface-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary-500" />
              Staff on Duty in {selectedDept} ({deptStaff.length})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {deptStaff.map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 bg-surface-sunken/60 border border-surface-border rounded-lg flex items-center justify-between text-xs"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-surface-foreground">{s.name}</span>
                    <span className="text-[11px] text-surface-muted">{s.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-surface-muted">
                      Load: {s.workload}%
                    </span>
                    <StatusBadge status={s.status} size="xs" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

export default DigitalTwinPage;
