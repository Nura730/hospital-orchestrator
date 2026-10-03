/**
 * @file PatientRow.jsx
 * Enriched patient queue item card with acuity badge, wait time threshold colors, requirements, and candidate bed recommendation button.
 */

import React from 'react';
import clsx from 'clsx';
import { Clock, ShieldAlert, Bed, HeartPulse, Stethoscope } from 'lucide-react';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import ProgressBar from '../ui/ProgressBar.jsx';
import { THRESHOLDS } from '../../utils/constants.js';

export function PatientRow({ patient, onGetBedSuggestion = null }) {
  if (!patient) return null;

  const isWaitDanger = (patient.waitingTimeMinutes || 0) >= THRESHOLDS.WAIT_TIME_DANGER_MIN;
  const isWaitWarn = (patient.waitingTimeMinutes || 0) >= THRESHOLDS.WAIT_TIME_WARN_MIN;

  const acuityColors = {
    1: 'danger',
    2: 'danger',
    3: 'warning',
    4: 'info',
    5: 'success',
  }[patient.acuity] || 'neutral';

  return (
    <div className="p-4 rounded-xl border border-surface-border bg-surface-elevated flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all hover:border-primary-500/30">
      {/* Patient Identifiers */}
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Badge color={acuityColors} size="sm" className="font-bold shrink-0">
          Acuity {patient.acuity}
        </Badge>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-surface-foreground truncate">
              {patient.name}
            </span>
            <span className="text-xs font-mono text-surface-muted">
              ({patient.mrn})
            </span>
            <span className="text-xs text-surface-muted">
              • {patient.age}y / {patient.gender}
            </span>
          </div>
          <p className="text-xs text-surface-muted mt-0.5 truncate">
            {patient.chiefComplaint}
          </p>
        </div>
      </div>

      {/* Reqs Icons & Telemetry */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {patient.requirements && patient.requirements.length > 0 && (
          <div className="flex items-center gap-1">
            {patient.requirements.map((req, i) => (
              <Badge key={i} color="neutral" size="xs">
                {req}
              </Badge>
            ))}
          </div>
        )}

        {/* Wait Time Indicator */}
        <div
          className={clsx(
            'flex items-center gap-1 font-mono font-bold text-xs px-2.5 py-1 rounded-lg border',
            isWaitDanger
              ? 'bg-danger-500/10 text-danger-600 dark:text-danger-400 border-danger-500/25'
              : isWaitWarn
              ? 'bg-warning-500/10 text-warning-600 dark:text-warning-400 border-warning-500/25'
              : 'bg-surface-sunken text-surface-muted border-surface-border'
          )}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{patient.waitingTimeMinutes || 0}m wait</span>
        </div>

        {/* Admission Probability */}
        <div className="w-32 hidden sm:block">
          <ProgressBar
            value={patient.admissionProbability || 85}
            showValue
            label="Admit Prob"
            size="sm"
          />
        </div>

        {/* Candidate Bed Action */}
        {onGetBedSuggestion && (
          <Button
            variant="outline"
            size="xs"
            icon={Bed}
            onClick={() => onGetBedSuggestion(patient)}
          >
            Get Bed Suggestion
          </Button>
        )}
      </div>
    </div>
  );
}

export default PatientRow;
