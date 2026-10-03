/**
 * @file EquipmentPage.jsx
 * Biomedical Equipment Telemetry and Maintenance Tracking.
 * Displays specialized asset cards, battery telemetry alerts, status mix doughnut, and detailed inspection drawer.
 */

import React, { useState } from 'react';
import { Stethoscope, BatteryWarning, CheckCircle2, Wrench, Search } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Drawer from '../components/ui/Drawer.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';
import Select from '../components/ui/Select.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import ProgressBar from '../components/ui/ProgressBar.jsx';
import ChartCard from '../components/charts/ChartCard.jsx';
import StatusDoughnut from '../components/charts/StatusDoughnut.jsx';
import EquipmentCard from '../components/domain/EquipmentCard.jsx';
import { useLiveStore } from '../store/liveStore.js';
import { EQUIPMENT_TYPES } from '../utils/constants.js';

export function EquipmentPage() {
  const equipment = useLiveStore((s) => s.equipment);

  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredEquipment = equipment.filter((eq) => {
    if (typeFilter !== 'all' && eq.type.toLowerCase() !== typeFilter.toLowerCase()) return false;
    if (statusFilter !== 'all' && eq.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        eq.name.toLowerCase().includes(q) ||
        eq.assetTag.toLowerCase().includes(q) ||
        eq.location.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCardClick = (item) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  // Status doughnut counts
  const availableCount = equipment.filter((e) => e.status === 'available').length;
  const inUseCount = equipment.filter((e) => e.status === 'in_use').length;
  const maintCount = equipment.filter((e) => e.status === 'maintenance').length;
  const offlineCount = equipment.filter((e) => e.status === 'offline').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-surface-foreground flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-primary-500" />
          Biomedical Equipment Telemetry & Assets
        </h2>
        <p className="text-xs text-surface-muted mt-0.5">
          Real-time location beacons, battery status, telemetry synchronization, and preventative maintenance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Search, Filters, and Equipment Grid */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 p-3.5 bg-surface-elevated border border-surface-border rounded-xl">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search assets, tag, room location..."
              className="max-w-xs"
            />
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'all', label: 'All Equipment Types' },
                ...EQUIPMENT_TYPES.map((t) => ({ value: t, label: t })),
              ]}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'available', label: 'Available' },
                { value: 'in_use', label: 'In Use' },
                { value: 'maintenance', label: 'Maintenance' },
              ]}
            />
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredEquipment.map((eq) => (
              <EquipmentCard key={eq.id} equipment={eq} onClick={handleCardClick} />
            ))}
          </div>
        </div>

        {/* Right Col: Doughnut & Alerts */}
        <div className="space-y-6">
          <ChartCard
            title="Equipment Operational Mix"
            subtitle="Current active utilization"
            height="h-64"
          >
            <StatusDoughnut
              labels={['Available', 'In Use', 'Maintenance', 'Offline']}
              counts={[availableCount, inUseCount, maintCount, offlineCount]}
              title="15 Assets"
              colors={['#10b981', '#0d9488', '#f59e0b', '#64748b']}
            />
          </ChartCard>

          <Card title="Maintenance Action Needed" className="border-l-4 border-l-amber-500">
            <div className="space-y-3 text-xs text-surface-muted">
              <div className="flex items-center gap-2 text-surface-foreground font-semibold">
                <Wrench className="w-4 h-4 text-amber-500" />
                <span>Defibrillator AST-7007 (Floor 2)</span>
              </div>
              <p>
                Battery level at 15%. Scheduled preventative calibration overdue since yesterday.
              </p>
              <Button variant="outline" size="xs">
                Request Tech Calibration
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Equipment Detail Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedItem?.name || 'Equipment Details'}
        subtitle={`Asset Tag: ${selectedItem?.assetTag}`}
        width="max-w-md"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>
            Close
          </Button>
        }
      >
        {selectedItem && (
          <div className="space-y-6 text-xs">
            <div className="p-4 bg-surface-sunken rounded-xl flex items-center justify-between">
              <div>
                <span className="text-surface-muted block text-[11px]">Current Status</span>
                <div className="mt-1">
                  <StatusBadge status={selectedItem.status} />
                </div>
              </div>
              <div className="text-right">
                <span className="text-surface-muted block text-[11px]">Location</span>
                <span className="font-bold text-surface-foreground mt-1 block">
                  {selectedItem.location}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-surface-foreground block">Battery Telemetry</span>
              <ProgressBar
                value={selectedItem.batteryPercentage}
                showValue
                size="md"
                autoColor={false}
                color={selectedItem.batteryPercentage <= 20 ? 'danger' : 'success'}
              />
            </div>

            <div className="space-y-2 border-t border-surface-border pt-4">
              <span className="font-semibold text-surface-foreground block">Telemetry History (Last 3h)</span>
              <div className="space-y-2">
                <div className="p-2.5 bg-surface-sunken/60 rounded-lg flex justify-between items-center text-[11px]">
                  <span>1 Hour Ago</span>
                  <span className="font-mono text-emerald-500">Connected • Telemetry OK</span>
                </div>
                <div className="p-2.5 bg-surface-sunken/60 rounded-lg flex justify-between items-center text-[11px]">
                  <span>2 Hours Ago</span>
                  <span className="font-mono text-emerald-500">Connected • Telemetry OK</span>
                </div>
                <div className="p-2.5 bg-surface-sunken/60 rounded-lg flex justify-between items-center text-[11px]">
                  <span>3 Hours Ago</span>
                  <span className="font-mono text-emerald-500">Sync Handshake Received</span>
                </div>
              </div>
            </div>

            <div className="border-t border-surface-border pt-4 text-surface-muted">
              <span className="font-semibold text-surface-foreground block mb-1">Assigned Patient</span>
              <span>{selectedItem.assignedPatientId ? `Linked to patient ${selectedItem.assignedPatientId}` : 'Currently unassigned / Standby'}</span>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default EquipmentPage;
