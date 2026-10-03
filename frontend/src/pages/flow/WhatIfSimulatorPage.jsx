/**
 * @file WhatIfSimulatorPage.jsx
 * /admin/flow/simulator
 * Left: presets + sliders + Run. Right: scenario cards A (red) / B (amber) / C (green, RECOMMENDED),
 * grouped bar chart behind "View chart", recommended actions + "Apply Recommended Plan", last-5 history, AI report.
 */

import React, { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Sliders, Play, BarChart3, CheckCircle2, History, Award } from 'lucide-react';
import FlowPageHeader from '../../components/domain/FlowPageHeader.jsx';
import ChartPopup from '../../components/domain/ChartPopup.jsx';
import WaitTimeImpactBadge from '../../components/domain/WaitTimeImpactBadge.jsx';
import AiReportButton from '../../components/domain/AiReportButton.jsx';
import RawDataTable from '../../components/domain/RawDataTable.jsx';
import { SectionHeader, FlowEmpty } from '../../components/domain/FlowUi.jsx';
import flowApi from '../../api/flowApi.js';
import { useLiveStore } from '../../store/liveStore.js';
import { useFlowPolling, errorText } from '../../hooks/useFlowPolling.js';
import { dateTime } from '../../utils/flowFormat.js';

const PRESETS = [
  { label: 'Mass Casualty', arrivalIncreasePct: 80, nursesAbsent: 3, icuBedsClosed: 0 },
  { label: 'Flu Outbreak', arrivalIncreasePct: 40, nursesAbsent: 2, icuBedsClosed: 0 },
  { label: 'Staff Strike', arrivalIncreasePct: 0, nursesAbsent: 5, icuBedsClosed: 2 },
  { label: 'Normal Day', arrivalIncreasePct: 0, nursesAbsent: 0, icuBedsClosed: 0 },
];

const SCENARIO_STYLE = {
  A: { border: 'border-[#EF4444]', head: 'bg-[#EF4444]', text: 'text-fg-bad' },
  B: { border: 'border-[#F59E0B]', head: 'bg-[#F59E0B]', text: 'text-fg-warn' },
  C: { border: 'border-[#10B981]', head: 'bg-[#10B981]', text: 'text-fg-ok' },
};

function SliderRow({ id, label, value, min, max, step = 1, unit, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={id} className="text-xs font-semibold text-ink-900">
          {label}
        </label>
        <span className="text-sm font-extrabold text-royal-500 tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#014BAA]" />
      <div className="flex justify-between text-[10px] text-ink-500">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

function ScenarioCard({ id, s, recommended }) {
  const st = SCENARIO_STYLE[id];
  return (
    <div className={clsx('rounded-2xl border-2 bg-cream-50 overflow-hidden flex flex-col', st.border, recommended && 'shadow-soft ring-4 ring-[#10B981]/15')}>
      <div className={clsx('px-4 py-2 text-white flex items-center justify-between', st.head)}>
        <span className="text-xs font-bold">
          Scenario {id} · {s.label}
        </span>
        {recommended && (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-white/25 rounded-full px-2 py-0.5">
            <Award className="w-3 h-3" aria-hidden="true" /> RECOMMENDED
          </span>
        )}
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <div className="text-[10px] uppercase font-semibold text-ink-500">Avg wait</div>
          <div className={clsx('text-4xl font-extrabold tabular-nums', st.text)}>
            {s.avgWaitMin}
            <span className="text-base font-semibold"> min</span>
          </div>
        </div>
        {[
          ['Bed shortage', s.bedShortage],
          ['Nurse shortage', s.nurseShortage],
          ['ICU overflow', s.icuOverflow],
          ['Effective beds', s.effectiveCapacity],
        ].map(([l, v]) => (
          <div key={l}>
            <div className="text-[10px] uppercase font-semibold text-ink-500">{l}</div>
            <div className={clsx('text-xl font-extrabold tabular-nums', v > 0 && l !== 'Effective beds' ? 'text-fg-bad' : 'text-ink-900')}>{v}</div>
          </div>
        ))}
        <div className="col-span-2 text-[10px] text-ink-500 border-t border-cream-200 pt-2">
          Demand {s.demand} · staff {s.effectiveStaff} nurses
          {s.extraBeds ? ` · +${s.extraBeds} beds` : ''}
          {s.extraNurses ? ` · +${s.extraNurses} nurse${s.extraNurses > 1 ? 's' : ''}` : ''}
          {s.deferredElective ? ` · ${s.deferredElective} elective deferred` : ''}
        </div>
      </div>
    </div>
  );
}

export default function WhatIfSimulatorPage() {
  const [params, setParams] = useState(PRESETS[1]);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const setFlowState = useLiveStore((s) => s.setFlowState);
  const result = useLiveStore((s) => s.flowState.activeSimulation);
  const history = useFlowPolling(() => flowApi.getSimulationHistory(5), { intervalMs: 0 });

  const set = (k) => (v) => setParams((p) => ({ ...p, label: 'Custom', [k]: v }));

  const run = async () => {
    setRunning(true);
    try {
      const [r] = await Promise.all([flowApi.simulate(params), new Promise((res) => setTimeout(res, 700))]);
      setFlowState({ activeSimulation: r });
      history.refresh({ silent: true });
    } catch (e) {
      toast.error(errorText(e, 'Simulation failed'));
    } finally {
      setRunning(false);
    }
  };

  const applyPlan = async () => {
    if (!result) return;
    setApplying(true);
    try {
      const r = await flowApi.applySimulation(result.id);
      toast.success(`Plan submitted for approval · ${r.recommendationsCreated} actions · ${r.notificationsSent} notifications${r.nudges ? ` · ${r.nudges} discharge nudges` : ''}`);
      setFlowState({ activeSimulation: { ...result, applied: true } });
      history.refresh({ silent: true });
    } catch (e) {
      toast.error(errorText(e, 'Could not apply the plan'));
    } finally {
      setApplying(false);
    }
  };

  const grouped = result && {
    labels: ['A · Do Nothing', 'B · Partial', 'C · Full'],
    datasets: [
      { label: 'Avg wait (min)', data: [result.scenarioA.avgWaitMin, result.scenarioB.avgWaitMin, result.scenarioC.avgWaitMin], color: '#014BAA' },
      { label: 'Bed shortage', data: [result.scenarioA.bedShortage, result.scenarioB.bedShortage, result.scenarioC.bedShortage], color: '#EF4444' },
      { label: 'Nurse shortage', data: [result.scenarioA.nurseShortage, result.scenarioB.nurseShortage, result.scenarioC.nurseShortage], color: '#F59E0B' },
      { label: 'ICU overflow', data: [result.scenarioA.icuOverflow, result.scenarioB.icuOverflow, result.scenarioC.icuOverflow], color: '#014BAA' },
    ],
  };

  return (
    <div className="flow-page">
      <FlowPageHeader
        title="What-If Simulator"
        subtitle="Stress-test the next 6 hours from the live hospital state"
        crumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Flow Intelligence' }, { label: 'Simulator' }]}
        actions={<AiReportButton scope="admin" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <aside className="flow-card-pad space-y-5 h-fit" aria-label="Simulation inputs">
          <SectionHeader title="Scenario" subtitle="Pick a preset or tune the sliders" icon={Sliders} />
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setParams(p)}
                aria-pressed={params.label === p.label}
                className={clsx('rounded-xl border-2 px-3 py-2 text-left transition-colors', params.label === p.label ? 'border-royal-500 bg-royal-100' : 'border-cream-200 hover:border-royal-500/40')}
              >
                <span className="block text-xs font-bold text-royal-900">{p.label}</span>
                <span className="block text-[10px] text-ink-500">
                  +{p.arrivalIncreasePct}% · -{p.nursesAbsent} nurses{p.icuBedsClosed ? ` · -${p.icuBedsClosed} ICU` : ''}
                </span>
              </button>
            ))}
          </div>
          <SliderRow id="arr" label="Arrival increase" value={params.arrivalIncreasePct} min={0} max={100} step={5} unit="%" onChange={set('arrivalIncreasePct')} />
          <SliderRow id="nurse" label="Nurses absent" value={params.nursesAbsent} min={0} max={10} onChange={set('nursesAbsent')} />
          <SliderRow id="icu" label="ICU beds closed" value={params.icuBedsClosed} min={0} max={5} onChange={set('icuBedsClosed')} />
          <button type="button" className="flow-btn-primary w-full !py-3 !text-sm" onClick={run} disabled={running}>
            <Play className={clsx('w-4 h-4', running && 'animate-pulse')} aria-hidden="true" />
            {running ? 'Simulating hospital state...' : 'Run Simulation'}
          </button>
        </aside>

        <section className="lg:col-span-2 space-y-5" aria-label="Simulation results" aria-busy={running}>
          {!result ? (
            <div className="flow-card-pad">
              <FlowEmpty icon={Sliders} title="No simulation yet" message='Choose a preset such as "Flu Outbreak" and press Run Simulation.' />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <WaitTimeImpactBadge before={result.scenarioA.avgWaitMin} after={result.scenarioC.avgWaitMin} size="lg" />
                <button type="button" className="flow-btn-secondary" onClick={() => setChartOpen(true)}>
                  <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /> View chart
                </button>
              </div>
              <div className={clsx('grid grid-cols-1 md:grid-cols-3 gap-4 transition-opacity', running && 'opacity-50')}>
                <ScenarioCard id="A" s={result.scenarioA} />
                <ScenarioCard id="B" s={result.scenarioB} />
                <ScenarioCard id="C" s={result.scenarioC} recommended />
              </div>

              <div className="flow-card-pad">
                <SectionHeader
                  title="Recommended plan (Scenario C)"
                  subtitle={`Expected: ${result.expectedWaitReduction} (${result.waitReductionPct}% less waiting)`}
                  icon={CheckCircle2}
                  actions={
                    <>
                      <AiReportButton scope="admin" label="Explain plan" variant="secondary" />
                      <button type="button" className="flow-btn-primary" onClick={applyPlan} disabled={applying || result.applied || !result.actions.length}>
                        {result.applied ? 'Plan submitted' : applying ? 'Submitting…' : 'Apply Recommended Plan'}
                      </button>
                    </>
                  }
                />
                <ol className="space-y-2">
                  {result.actions.map((a, i) => (
                    <li key={a.text} className="flex items-start gap-3 rounded-xl border border-cream-200 bg-cream-50 px-3 py-2">
                      <span className="w-6 h-6 rounded-full bg-royal-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="flex-1 text-xs font-medium text-ink-900">{a.text}</span>
                      <span className="text-[11px] font-semibold text-fg-ok whitespace-nowrap">{a.impact}</span>
                    </li>
                  ))}
                  {!result.actions.length && <li className="text-xs text-ink-500">No extra actions needed.</li>}
                </ol>
                <p className="text-[10px] text-ink-500 mt-3">
                  Baseline: {result.baseline.currentPatients}/{result.baseline.totalBeds} beds, {result.baseline.totalNurses} nurses, {result.baseline.forecastArrivals} ED arrivals forecast (6h), admission rate{' '}
                  {Math.round(result.baseline.admissionRate * 100)}%, {result.baseline.dirtyBeds} dirty beds, {result.baseline.dischargeReadyCount} discharge-ready.
                </p>
              </div>
            </>
          )}

          <div className="flow-card-pad">
            <SectionHeader title="Last 5 simulations" icon={History} />
            <RawDataTable
              rows={history.data || []}
              exportName="simulation_history"
              emptyText="No simulations recorded yet"
              columns={[
                { key: 'createdAt', label: 'When', render: (r) => dateTime(r.createdAt), csv: (r) => r.createdAt },
                { key: 'params', label: 'Inputs', render: (r) => `+${r.params.arrivalIncreasePct}% · -${r.params.nursesAbsent} nurses · -${r.params.icuBedsClosed} ICU`, csv: (r) => JSON.stringify(r.params) },
                { key: 'a', label: 'A wait', align: 'right', render: (r) => `${r.scenarioA.avgWaitMin} min`, csv: (r) => r.scenarioA.avgWaitMin },
                { key: 'c', label: 'C wait', align: 'right', render: (r) => `${r.scenarioC.avgWaitMin} min`, csv: (r) => r.scenarioC.avgWaitMin },
                { key: 'waitReductionPct', label: 'Reduction', align: 'right', render: (r) => `${r.waitReductionPct}%` },
                { key: 'applied', label: 'Applied', render: (r) => (r.applied ? 'Yes' : 'No') },
              ]}
            />
          </div>
        </section>
      </div>

      {result && <ChartPopup open={chartOpen} onClose={() => setChartOpen(false)} title="Scenario comparison" chartType="groupedBar" grouped={grouped} />}
    </div>
  );
}
