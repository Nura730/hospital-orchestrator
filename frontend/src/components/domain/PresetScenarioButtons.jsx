/**
 * @file PresetScenarioButtons.jsx
 * Preset surge scenario chips for quick simulator stress testing.
 */

import React from 'react';
import { Flame, ShieldAlert, Users, CheckCircle2 } from 'lucide-react';
import Button from '../ui/Button.jsx';

export const SCENARIO_PRESETS = [
  {
    id: 'mass_casualty',
    label: 'Mass Casualty',
    icon: Flame,
    color: 'danger',
    params: { arrivalIncreasePct: 80, nursesAbsent: 2, icuBedsClosed: 0, scenarioName: 'Mass Casualty Surge' },
  },
  {
    id: 'flu_outbreak',
    label: 'Flu Outbreak Wave',
    icon: ShieldAlert,
    color: 'warning',
    params: { arrivalIncreasePct: 40, nursesAbsent: 6, icuBedsClosed: 1, scenarioName: 'Winter Flu Epidemic' },
  },
  {
    id: 'staff_strike',
    label: 'Staff Shortage / Strike',
    icon: Users,
    color: 'warning',
    params: { arrivalIncreasePct: 5, nursesAbsent: 10, icuBedsClosed: 2, scenarioName: 'Staffing Shortfall' },
  },
  {
    id: 'normal',
    label: 'Normal Flow Baseline',
    icon: CheckCircle2,
    color: 'success',
    params: { arrivalIncreasePct: 0, nursesAbsent: 0, icuBedsClosed: 0, scenarioName: 'Nominal Operations' },
  },
];

export function PresetScenarioButtons({ onSelectPreset }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-surface-muted uppercase tracking-wider">
        Quick Simulation Presets
      </span>
      <div className="grid grid-cols-2 gap-2">
        {SCENARIO_PRESETS.map((p) => {
          const Icon = p.icon;
          return (
            <Button
              key={p.id}
              variant="secondary"
              size="xs"
              icon={Icon}
              onClick={() => onSelectPreset(p.params)}
              className="justify-start truncate"
            >
              {p.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export default PresetScenarioButtons;
