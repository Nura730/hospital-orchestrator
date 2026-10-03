/**
 * @file BottleneckCard.jsx
 * Operational bottleneck card featuring summary, impacted patient count, and expandable cascade chain.
 */

import React from 'react';
import { AlertOctagon, Users } from 'lucide-react';
import Card from '../ui/Card.jsx';
import SeverityBadge from '../ui/SeverityBadge.jsx';
import CascadeChain from './CascadeChain.jsx';

export function BottleneckCard({ bottleneck }) {
  if (!bottleneck) return null;

  return (
    <Card className="border-l-4 border-l-danger-500 bg-surface-elevated">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-danger-500/10 text-danger-500 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-surface-foreground">
                {bottleneck.title}
              </h4>
              <span className="text-xs text-surface-muted font-medium">
                {bottleneck.department}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {bottleneck.impactedPatients !== undefined && (
              <span className="inline-flex items-center gap-1 text-xs font-mono text-surface-muted bg-surface-sunken px-2 py-0.5 rounded-full border border-surface-border">
                <Users className="w-3 h-3" />
                {bottleneck.impactedPatients} Impacted
              </span>
            )}
            <SeverityBadge severity={bottleneck.severity || 'high'} size="xs" />
          </div>
        </div>

        {/* Summary Description */}
        <p className="text-xs text-surface-muted leading-relaxed">
          {bottleneck.summary}
        </p>

        {/* Cascade Chain */}
        {bottleneck.cascadeChain && (
          <CascadeChain chain={bottleneck.cascadeChain} />
        )}
      </div>
    </Card>
  );
}

export default BottleneckCard;
