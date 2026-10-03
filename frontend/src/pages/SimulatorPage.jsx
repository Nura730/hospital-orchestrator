/**
 * @file SimulatorPage.jsx
 * Hospital Scenario & Surge Stress-Testing Simulator.
 * Features stress sliders, preset surge scenarios, Before vs After charts,
 * shortage impact summary tiles, and AI mitigation plan generation with Apply Plan action.
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Sliders, Play, AlertTriangle, ShieldCheck, Clock, History, Check } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Slider from '../components/ui/Slider.jsx';
import ChartCard from '../components/charts/ChartCard.jsx';
import BeforeAfterBar from '../components/charts/BeforeAfterBar.jsx';
import PresetScenarioButtons from '../components/domain/PresetScenarioButtons.jsx';
import { runSimulation, getSimulationHistory } from '../api/endpoints.js';
import { useLiveStore } from '../store/liveStore.js';

export function SimulatorPage() {
  const [arrivalIncrease, setArrivalIncrease] = useState(40);
  const [nursesAbsent, setNursesAbsent] = useState(4);
  const [icuBedsClosed, setIcuBedsClosed] = useState(1);
  const [scenarioName, setScenarioName] = useState('Winter Flu Epidemic');

  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [history, setHistory] = useState([]);

  const optimisticApproveRec = useLiveStore((s) => s.optimisticApproveRec);

  const handleApplyPreset = (params) => {
    setArrivalIncrease(params.arrivalIncreasePct);
    setNursesAbsent(params.nursesAbsent);
    setIcuBedsClosed(params.icuBedsClosed);
    setScenarioName(params.scenarioName);
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      const res = await runSimulation({
        arrivalIncreasePct: arrivalIncrease,
        nursesAbsent,
        icuBedsClosed,
        scenarioName,
      });

      if (res.ok && res.data) {
        setCurrentResult(res.data);
      }
      const histRes = await getSimulationHistory();
      if (histRes.ok) setHistory(histRes.data || []);
      setLoading(false);
    } catch (err) {
      console.error('Simulation error:', err);
      setLoading(false);
    }
  };

  const handleApplyPlan = (plan) => {
    toast.success(`Surge plan applied: ${plan.title}`, { duration: 4000 });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-surface-foreground flex items-center gap-2">
          <Sliders className="w-5 h-5 text-primary-500" />
          Surge & Scenario Stress Simulator
        </h2>
        <p className="text-xs text-surface-muted mt-0.5">
          Model catastrophic arrivals, staffing deficits, and bed closures to stress-test capacity and generate automated mitigation plans.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── LEFT: SIMULATION CONTROL PANEL (5 Cols) ─────────────────────── */}
        <div className="lg:col-span-5 space-y-6">
          <Card title="Simulation Stress Parameters">
            <div className="space-y-5">
              <PresetScenarioButtons onSelectPreset={handleApplyPreset} />

              <div className="pt-3 border-t border-surface-border space-y-4">
                <Slider
                  label="Emergency Patient Arrival Surge"
                  value={arrivalIncrease}
                  onChange={setArrivalIncrease}
                  min={0}
                  max={100}
                  step={5}
                  unit="%"
                />

                <Slider
                  label="Unplanned Nurse Absences"
                  value={nursesAbsent}
                  onChange={setNursesAbsent}
                  min={0}
                  max={10}
                  step={1}
                  unit=" staff"
                />

                <Slider
                  label="Closed / Quarantined ICU Beds"
                  value={icuBedsClosed}
                  onChange={setIcuBedsClosed}
                  min={0}
                  max={10}
                  step={1}
                  unit=" beds"
                />
              </div>

              <Button
                variant="primary"
                size="md"
                loading={loading}
                icon={Play}
                onClick={handleRunSimulation}
                className="w-full mt-2"
              >
                Run Stress Simulation Engine
              </Button>
            </div>
          </Card>

          {/* Past History Runs */}
          {history.length > 0 && (
            <Card title="Recent Simulation Runs">
              <div className="space-y-2">
                {history.slice(0, 4).map((h) => (
                  <div
                    key={h.id}
                    onClick={() => setCurrentResult(h)}
                    className="p-2.5 rounded-lg bg-surface-sunken/60 hover:bg-surface-sunken border border-surface-border flex items-center justify-between text-xs cursor-pointer"
                  >
                    <div>
                      <span className="font-semibold text-surface-foreground block">{h.scenarioName}</span>
                      <span className="text-[11px] text-surface-muted">
                        +{h.inputs.arrivalIncreasePct}% Arr, {h.inputs.nursesAbsent} Absent, {h.inputs.icuBedsClosed} Closed
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-danger-500">
                      {h.results.after.avgWaitTimeMins}m wait
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ── RIGHT: SIMULATION RESULTS & MITIGATION PLAN (7 Cols) ─────────── */}
        <div className="lg:col-span-7 space-y-6">
          {currentResult ? (
            <>
              {/* Shortage Summary Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-surface-elevated border border-surface-border rounded-xl">
                  <span className="text-xs text-surface-muted block">Projected Wait</span>
                  <span className="text-2xl font-bold font-mono text-danger-500">
                    {currentResult.results.after.avgWaitTimeMins}m
                  </span>
                  <span className="text-[11px] text-surface-muted block">
                    (+{currentResult.results.shortageSummary.edWaitDeltaMins}m delta)
                  </span>
                </div>

                <div className="p-3.5 bg-surface-elevated border border-surface-border rounded-xl">
                  <span className="text-xs text-surface-muted block">Bed Shortage</span>
                  <span className="text-2xl font-bold font-mono text-amber-500">
                    {currentResult.results.shortageSummary.bedDeficit}
                  </span>
                  <span className="text-[11px] text-surface-muted block">Unplaced beds</span>
                </div>

                <div className="p-3.5 bg-surface-elevated border border-surface-border rounded-xl">
                  <span className="text-xs text-surface-muted block">Staff Shortage</span>
                  <span className="text-2xl font-bold font-mono text-amber-500">
                    {currentResult.results.shortageSummary.nurseDeficit}
                  </span>
                  <span className="text-[11px] text-surface-muted block">Nurses needed</span>
                </div>

                <div className="p-3.5 bg-surface-elevated border border-surface-border rounded-xl">
                  <span className="text-xs text-surface-muted block">Overcapacity Risk</span>
                  <span className="text-xs font-bold text-danger-500 mt-2 block">
                    {currentResult.results.shortageSummary.overcapacityRisk ? 'CRITICAL TIER 3' : 'MANAGEABLE'}
                  </span>
                </div>
              </div>

              {/* Before vs After Chart */}
              <ChartCard
                title="Baseline vs Simulated Scenario Impact"
                subtitle="Comparative metric stress test"
                height="h-64"
              >
                <BeforeAfterBar
                  labels={['Wait Time (min)', 'Bed Shortage', 'Staff Shortfall']}
                  beforeData={[
                    currentResult.results.before.avgWaitTimeMins,
                    currentResult.results.before.bedShortageCount,
                    currentResult.results.before.nurseShortageCount,
                  ]}
                  afterData={[
                    currentResult.results.after.avgWaitTimeMins,
                    currentResult.results.after.bedShortageCount,
                    currentResult.results.after.nurseShortageCount,
                  ]}
                />
              </ChartCard>

              {/* Generated AI Mitigation Plan */}
              {currentResult.results.generatedPlan && (
                <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-500/5 to-transparent">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        AI Automated Mitigation Plan
                      </span>
                      <Button
                        variant="primary"
                        size="xs"
                        icon={Check}
                        onClick={() => handleApplyPlan(currentResult.results.generatedPlan)}
                      >
                        Apply Mitigation Plan
                      </Button>
                    </div>

                    <h4 className="font-bold text-sm text-surface-foreground">
                      {currentResult.results.generatedPlan.title}
                    </h4>

                    <p className="text-xs text-surface-muted leading-relaxed">
                      {currentResult.results.generatedPlan.summary}
                    </p>

                    <div className="p-2.5 rounded-lg bg-surface-sunken/60 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                      {currentResult.results.generatedPlan.expectedBenefit}
                    </div>
                  </div>
                </Card>
              )}
            </>
          ) : (
            <div className="p-16 text-center bg-surface-elevated border border-surface-border rounded-xl">
              <Sliders className="w-10 h-10 text-primary-500/60 mx-auto mb-3" />
              <h3 className="font-bold text-sm text-surface-foreground">Simulation Ready</h3>
              <p className="text-xs text-surface-muted max-w-sm mx-auto mt-1">
                Configure surge sliders or pick a quick scenario preset on the left, then click <strong>Run Stress Simulation Engine</strong>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SimulatorPage;
