/**
 * @file AutonomyModeSwitch.jsx
 * Operational toggle for AI autonomy level: Advisory | Approval Required | Auto-Execute.
 */

import React from 'react';
import clsx from 'clsx';
import { Shield, Sparkles, CheckCheck } from 'lucide-react';
import { useUiStore } from '../../store/uiStore.js';
import { setAutonomyMode as apiSetAutonomyMode } from '../../api/endpoints.js';
import { AUTONOMY_MODES } from '../../utils/constants.js';

export function AutonomyModeSwitch() {
  const autonomyMode = useUiStore((s) => s.autonomyMode);
  const setAutonomyMode = useUiStore((s) => s.setAutonomyMode);

  const handleSelectMode = async (mode) => {
    setAutonomyMode(mode);
    try {
      await apiSetAutonomyMode(mode);
    } catch (e) {
      console.error('Failed to sync autonomy mode:', e);
    }
  };

  const descriptions = {
    [AUTONOMY_MODES.ADVISORY]:
      'Advisory Mode: AI proposes recommendations for clinical review; human clinicians initiate all bed moves and shifts manually.',
    [AUTONOMY_MODES.APPROVAL]:
      'Approval Required Mode: AI prepares complete multi-stage execution actions; human operator 1-click approval required.',
    [AUTONOMY_MODES.AUTO]:
      'Autonomous Execution Mode: Low and Medium risk recommendations execute automatically with audit log; High risk still requires human approval.',
  };

  const modes = [
    { id: AUTONOMY_MODES.ADVISORY, label: 'Advisory Only', icon: Shield },
    { id: AUTONOMY_MODES.APPROVAL, label: 'Approval Required', icon: CheckCheck },
    { id: AUTONOMY_MODES.AUTO, label: 'Autonomous Execute', icon: Sparkles },
  ];

  return (
    <div className="p-4 rounded-xl border border-surface-border bg-surface-elevated flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <span className="text-xs font-bold text-surface-foreground uppercase tracking-wider">
          AI Orchestration Autonomy Mode
        </span>

        {/* Mode Selector Buttons */}
        <div className="inline-flex p-1 bg-surface-sunken rounded-xl border border-surface-border gap-1">
          {modes.map((m) => {
            const Icon = m.icon;
            const isSelected = autonomyMode === m.id;

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelectMode(m.id)}
                className={clsx(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer',
                  isSelected
                    ? 'bg-surface-elevated text-primary-600 dark:text-primary-400 font-bold shadow-xs border border-surface-border'
                    : 'text-surface-muted hover:text-surface-foreground'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-surface-muted italic">
        {descriptions[autonomyMode]}
      </p>
    </div>
  );
}

export default AutonomyModeSwitch;
