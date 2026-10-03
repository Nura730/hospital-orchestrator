/**
 * @file CommandCenterPage.jsx
 * Master Real-Time Command Center Dashboard (Home).
 * Aggregates 5 core KPI metrics, department occupancy charts, ICU half-gauge,
 * horizon forecast lines, bed demand vs capacity curves, active bottleneck cascade chains,
 * and live acknowledgeable alert feed.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BedDouble,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import KpiCard from '../components/ui/KpiCard.jsx';
import Button from '../components/ui/Button.jsx';
import SegmentedControl from '../components/ui/SegmentedControl.jsx';
import ChartCard from '../components/charts/ChartCard.jsx';
import OccupancyBar from '../components/charts/OccupancyBar.jsx';
import GaugeDoughnut from '../components/charts/GaugeDoughnut.jsx';
import ForecastLine from '../components/charts/ForecastLine.jsx';
import DemandCapacityLine from '../components/charts/DemandCapacityLine.jsx';
import BottleneckCard from '../components/domain/BottleneckCard.jsx';
import AlertItem from '../components/domain/AlertItem.jsx';
import { useLiveStore } from '../store/liveStore.js';
import { getDepartmentOccupancy, getArrivalForecast, getDemandCapacity } from '../api/endpoints.js';
import { FORECAST_HORIZONS } from '../utils/constants.js';

export function CommandCenterPage() {
  const navigate = useNavigate();

  const kpis = useLiveStore((s) => s.kpis);
  const counts = useLiveStore((s) => s.counts);
  const alerts = useLiveStore((s) => s.alerts);
  const bottlenecks = useLiveStore((s) => s.bottlenecks);
  const recommendations = useLiveStore((s) => s.recommendations);
  const optimisticAcknowledgeAlert = useLiveStore((s) => s.optimisticAcknowledgeAlert);

  const [forecastHorizon, setForecastHorizon] = useState(6);
  const [deptOccupancy, setDeptOccupancy] = useState([]);
  const [forecastData, setForecastData] = useState(null);
  const [demandData, setDemandData] = useState(null);
  const [loadingCharts, setLoadingCharts] = useState(true);

  // Load chart datasets
  useEffect(() => {
    let mounted = true;
    async function loadChartData() {
      setLoadingCharts(true);
      try {
        const [occRes, foreRes, demRes] = await Promise.all([
          getDepartmentOccupancy(),
          getArrivalForecast({ horizon: forecastHorizon }),
          getDemandCapacity({ horizon: 6 }),
        ]);

        if (mounted) {
          setDeptOccupancy(occRes?.data || []);
          setForecastData(foreRes?.data || null);
          setDemandData(demRes?.data || null);
          setLoadingCharts(false);
        }
      } catch (err) {
        console.error('Failed to load chart data:', err);
        if (mounted) setLoadingCharts(false);
      }
    }
    loadChartData();
    return () => {
      mounted = false;
    };
  }, [forecastHorizon]);

  const topPendingRec = recommendations.find((r) => r.status === 'pending');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── ROW 1: 5 CORE KPI CARDS ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <KpiCard
          title="ED Wait Time"
          value={kpis.edWaitTimeMinutes}
          unit="min"
          trend={kpis.edWaitTrend}
          status={kpis.edWaitStatus}
          sparklineData={kpis.sparklineEdWait}
          icon={Clock}
          onClick={() => navigate('/beds-patients')}
        />
        <KpiCard
          title="Bed Occupancy"
          value={`${kpis.overallBedOccupancyPct}%`}
          unit={`(${counts.occupiedBeds}/${counts.totalBeds})`}
          trend={kpis.bedOccupancyTrend}
          status={kpis.bedOccupancyStatus}
          sparklineData={kpis.sparklineBed}
          icon={BedDouble}
          onClick={() => navigate('/digital-twin')}
        />
        <KpiCard
          title="ICU Occupancy"
          value={`${kpis.icuOccupancyPct}%`}
          unit="(10/12)"
          trend={kpis.icuOccupancyTrend}
          status={kpis.icuOccupancyStatus}
          sparklineData={kpis.sparklineIcu}
          icon={Activity}
          onClick={() => navigate('/digital-twin')}
        />
        <KpiCard
          title="OT Utilization"
          value={`${kpis.otUtilizationPct}%`}
          unit="active"
          trend={kpis.otTrend}
          status={kpis.otStatus}
          sparklineData={kpis.sparklineOt}
          icon={Activity}
          onClick={() => navigate('/staff-ot')}
        />
        <KpiCard
          title="Staff Overtime"
          value={kpis.staffOvertimeHours}
          unit="hrs"
          trend={kpis.overtimeTrend}
          status={kpis.overtimeStatus}
          sparklineData={kpis.sparklineOvertime}
          icon={Sliders}
          onClick={() => navigate('/staff-ot')}
        />
      </div>

      {/* ── ROW 2: DEPARTMENT OCCUPANCY BAR + ICU GAUGE ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard
            title="Department Bed Occupancy Rate"
            subtitle="Live percentage with 90% threshold danger annotation"
            height="h-64"
            loading={loadingCharts}
          >
            <OccupancyBar data={deptOccupancy} />
          </ChartCard>
        </div>

        <div>
          <ChartCard
            title="ICU Capacity Gauge"
            subtitle="Near-critical capacity buffer"
            height="h-64"
            loading={loadingCharts}
          >
            <GaugeDoughnut value={kpis.icuOccupancyPct} />
          </ChartCard>
        </div>
      </div>

      {/* ── ROW 3: ARRIVAL FORECAST + DEMAND VS CAPACITY ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <ChartCard
            title="Emergency Arrival Horizon Forecast"
            subtitle="Confidence interval band with actual vs predicted"
            height="h-72"
            loading={loadingCharts}
            action={
              <SegmentedControl
                size="xs"
                value={`${forecastHorizon}h`}
                onChange={(val) => setForecastHorizon(Number(val.replace('h', '')))}
                options={FORECAST_HORIZONS.map((h) => ({ value: h.label, label: h.label }))}
              />
            }
          >
            <ForecastLine forecastData={forecastData} />
          </ChartCard>
        </div>

        <div>
          <ChartCard
            title="Next 6-Hour Bed Demand vs Capacity"
            subtitle="Projected patient inflow vs available staffed beds"
            height="h-72"
            loading={loadingCharts}
          >
            <DemandCapacityLine demandData={demandData} />
          </ChartCard>
        </div>
      </div>

      {/* ── ROW 4: BOTTLENECKS PANEL + LIVE ALERT FEED ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Bottlenecks & Cascades */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-surface-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-danger-500" />
              Active System Bottlenecks ({bottlenecks.length})
            </h3>
            <span className="text-xs text-surface-muted">
              Live AI Root-Cause Tracking
            </span>
          </div>

          <div className="space-y-3">
            {bottlenecks.map((btn) => (
              <BottleneckCard key={btn.id} bottleneck={btn} />
            ))}
          </div>
        </div>

        {/* Live Alerts Feed */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-surface-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-warning-500" />
              Recent Critical Alerts ({alerts.filter((a) => a.status === 'open').length})
            </h3>
            <button
              type="button"
              onClick={() => navigate('/alerts')}
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
            >
              View All Alerts
            </button>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {alerts.slice(0, 5).map((alt) => (
              <AlertItem
                key={alt.id}
                alert={alt}
                onAcknowledge={optimisticAcknowledgeAlert}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 5: PENDING RECOMMENDATIONS STRIP ───────────────────────────── */}
      {topPendingRec && (
        <div className="p-4 rounded-xl border border-primary-500/30 bg-gradient-to-r from-primary-500/10 via-primary-500/5 to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-primary-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                  AI Recommendation Advisory ({counts.pendingRecommendations} Pending)
                </span>
              </div>
              <p className="text-xs font-medium text-surface-foreground mt-0.5">
                {topPendingRec.title}
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            iconRight={ArrowRight}
            onClick={() => navigate('/recommendations')}
          >
            Review & Approve
          </Button>
        </div>
      )}
    </div>
  );
}

export default CommandCenterPage;
