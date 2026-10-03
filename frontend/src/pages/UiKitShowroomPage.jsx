/**
 * @file UiKitShowroomPage.jsx
 * Internal showroom page (route /_kit) displaying every UI component in all variants, themes, and interactive states.
 */

import React, { useState } from 'react';
import {
  Activity,
  BedDouble,
  Bell,
  CheckCircle2,
  Heart,
  Shield,
  Stethoscope,
  Users,
} from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import SeverityBadge from '../components/ui/SeverityBadge.jsx';
import KpiCard from '../components/ui/KpiCard.jsx';
import DataTable from '../components/ui/DataTable.jsx';
import Drawer from '../components/ui/Drawer.jsx';
import Modal from '../components/ui/Modal.jsx';
import Tabs from '../components/ui/Tabs.jsx';
import ProgressBar from '../components/ui/ProgressBar.jsx';
import LiveDot from '../components/ui/LiveDot.jsx';
import Toggle from '../components/ui/Toggle.jsx';
import SegmentedControl from '../components/ui/SegmentedControl.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';
import Select from '../components/ui/Select.jsx';
import Slider from '../components/ui/Slider.jsx';
import Tooltip from '../components/ui/Tooltip.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import Skeleton, { SkeletonCard, SkeletonTable } from '../components/ui/Skeleton.jsx';

export function UiKitShowroomPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tab-1');
  const [toggleState, setToggleState] = useState(true);
  const [segmentVal, setSegmentVal] = useState('6h');
  const [searchVal, setSearchVal] = useState('');
  const [selectVal, setSelectVal] = useState('Emergency');
  const [sliderVal, setSliderVal] = useState(40);

  const sampleTableCols = [
    { key: 'code', label: 'Bed Code', sortable: true },
    { key: 'dept', label: 'Department', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'occupancy',
      label: 'Occupancy',
      render: (v) => <ProgressBar value={v} showValue size="sm" />,
    },
  ];

  const sampleTableData = [
    { id: 1, code: 'ICU-01', dept: 'ICU', status: 'occupied', occupancy: 95 },
    { id: 2, code: 'ER-04', dept: 'Emergency', status: 'available', occupancy: 0 },
    { id: 3, code: 'GW-12', dept: 'General Ward', status: 'cleaning', occupancy: 50 },
    { id: 4, code: 'HDU-02', dept: 'HDU', status: 'occupied', occupancy: 82 },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-surface-foreground">
          MediOrchestra Design System Showroom
        </h2>
        <p className="text-xs text-surface-muted mt-1">
          Complete living catalog of clinical tokens, components, and layout primitives.
        </p>
      </div>

      {/* Buttons */}
      <Card title="Buttons & Actions">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={Activity}>Primary Action</Button>
          <Button variant="secondary" icon={Stethoscope}>Secondary Action</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="danger" icon={Bell}>Danger Action</Button>
          <Button variant="ghost">Ghost Action</Button>
          <Button variant="primary" loading>Loading...</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="secondary" size="icon" icon={Heart} />
        </div>
      </Card>

      {/* Badges & Statuses */}
      <Card title="Badges & Clinical Status Indicators">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="primary">Primary Badge</Badge>
            <Badge color="success" dot>Success Active</Badge>
            <Badge color="warning" dot>Warning Pending</Badge>
            <Badge color="danger" dot>Critical Alert</Badge>
            <Badge color="info">Informational</Badge>
            <Badge color="neutral">Neutral System</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-surface-border">
            <StatusBadge status="available" />
            <StatusBadge status="occupied" />
            <StatusBadge status="cleaning" />
            <StatusBadge status="maintenance" />
            <StatusBadge status="reserved" />
            <StatusBadge status="on_duty" />
            <StatusBadge status="in_surgery" />
            <StatusBadge status="waiting" />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-surface-border">
            <SeverityBadge severity="critical" />
            <SeverityBadge severity="high" />
            <SeverityBadge severity="medium" />
            <SeverityBadge severity="low" />
            <LiveDot isConnected={true} />
            <LiveDot isConnected={false} />
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <div>
        <h3 className="text-sm font-semibold text-surface-foreground mb-3">KPI Cards</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="ED Wait Time"
            value="38"
            unit="min"
            trend="+6m vs 1h ago"
            status="warning"
            sparklineData={[22, 25, 29, 34, 38]}
          />
          <KpiCard
            title="Overall Occupancy"
            value="75"
            unit="%"
            trend="+2.4% vs 1h ago"
            status="warning"
            sparklineData={[68, 70, 71, 72, 75]}
          />
          <KpiCard
            title="ICU Occupancy"
            value="83.3"
            unit="%"
            trend="+8.3% vs 1h ago"
            status="danger"
            sparklineData={[66, 75, 75, 83, 83]}
          />
          <KpiCard
            title="Active Operating Theatres"
            value="3/4"
            unit="OTs"
            trend="Normal Pace"
            status="success"
            sparklineData={[3, 3, 2, 4, 3]}
          />
        </div>
      </div>

      {/* Form Controls */}
      <Card title="Interactive Form & Filter Controls">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <SearchInput
              value={searchVal}
              onChange={setSearchVal}
              placeholder="Search patients or beds..."
            />
            <Select
              label="Department Filter"
              value={selectVal}
              onChange={setSelectVal}
              options={[
                { value: 'Emergency', label: 'Emergency Department' },
                { value: 'ICU', label: 'Intensive Care Unit (ICU)' },
                { value: 'General Ward', label: 'General Medicine Ward' },
              ]}
            />
          </div>

          <div className="space-y-4">
            <Toggle
              checked={toggleState}
              onChange={setToggleState}
              label="Real-time Stream Auto-Apply"
              description="Instantly update active cards on websocket events"
            />
            <div className="pt-2">
              <span className="text-xs font-medium text-surface-muted block mb-1.5">Horizon Selector</span>
              <SegmentedControl
                value={segmentVal}
                onChange={setSegmentVal}
                options={[
                  { value: '3h', label: '3h' },
                  { value: '6h', label: '6h' },
                  { value: '12h', label: '12h' },
                  { value: '24h', label: '24h' },
                ]}
              />
            </div>
          </div>

          <div className="space-y-4">
            <Slider
              label="Simulated Surge Increase"
              value={sliderVal}
              onChange={setSliderVal}
              unit="%"
            />
            <ProgressBar value={sliderVal} showValue label="Occupancy Impact" />
          </div>
        </div>
      </Card>

      {/* Tabs & Modals Trigger */}
      <Card title="Navigation Tabs & Overlays">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Tabs
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: 'tab-1', label: 'Overview', icon: Activity, count: 12 },
                { id: 'tab-2', label: 'Patients Queue', icon: Users, count: 7 },
                { id: 'tab-3', label: 'Bed Inventory', icon: BedDouble },
              ]}
            />

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(true)}>Open Modal</Button>
              <Button variant="outline" onClick={() => setDrawerOpen(true)}>Open Drawer</Button>
            </div>
          </div>

          <div className="p-4 bg-surface-sunken/40 rounded-xl text-xs text-surface-muted">
            Currently active tab: <strong className="text-surface-foreground font-mono">{activeTab}</strong>
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <div>
        <h3 className="text-sm font-semibold text-surface-foreground mb-3">Data Table Component</h3>
        <DataTable columns={sampleTableCols} data={sampleTableData} searchable />
      </div>

      {/* Skeletons & Fallbacks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Loading Skeleton States">
          <div className="space-y-4">
            <SkeletonCard />
          </div>
        </Card>

        <Card title="Empty & Error Fallbacks">
          <EmptyState title="No Alerts Pending" message="All active incidents have been acknowledged." />
        </Card>
      </div>

      {/* Modal Demo */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Candidate Bed Suggestion Match"
        subtitle="AI Ranked Top Bed Candidates for Patient"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>Confirm Allocation</Button>
          </>
        }
      >
        <p className="text-xs text-surface-muted leading-relaxed">
          Bed <strong className="text-surface-foreground">GW-08</strong> is sanitized and matches patient telemetry profile with 94% compatibility.
        </p>
      </Modal>

      {/* Drawer Demo */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Emergency Trauma Bay Inspection"
        subtitle="Department Operational Status"
      >
        <div className="space-y-4 text-xs text-surface-muted">
          <div className="p-3 bg-surface-sunken rounded-xl flex justify-between items-center">
            <span>Occupied Beds</span>
            <span className="font-bold text-surface-foreground">12 / 15</span>
          </div>
          <div className="p-3 bg-surface-sunken rounded-xl flex justify-between items-center">
            <span>Staff on Duty</span>
            <span className="font-bold text-surface-foreground">4 Nurses, 2 Doctors</span>
          </div>
          <p>
            Trauma Bay 1 in surgery for patient Arthur Pendelton. Expected release at 11:30.
          </p>
        </div>
      </Drawer>
    </div>
  );
}

export default UiKitShowroomPage;
