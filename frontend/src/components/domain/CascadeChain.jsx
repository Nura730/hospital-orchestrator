/**
 * @file CascadeChain.jsx
 * Multi-stage propagation chain visualizer showing Root Cause -> Immediate Impact -> Downstream Risk.
 */

import React from 'react';
import { ArrowRight, AlertTriangle, Flame, ShieldAlert, Cpu } from 'lucide-react';
import Badge from '../ui/Badge.jsx';

export function CascadeChain({ chain = [] }) {
  if (!chain || chain.length === 0) return null;

  const stageIcons = {
    'Root Cause': Flame,
    'Immediate Impact': AlertTriangle,
    'Upstream Choke': ShieldAlert,
    'Downstream Risk': Cpu,
    'Downstream Impact': AlertTriangle,
  };

  return (
    <div className="flex flex-col gap-2 pt-2">
      <span className="text-xs font-semibold text-surface-muted uppercase tracking-wider">
        Propagation Cascade Chain
      </span>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {chain.map((step, idx) => {
          const Icon = stageIcons[step.stage] || AlertTriangle;
          const isLast = idx === chain.length - 1;

          return (
            <React.Fragment key={idx}>
              <div className="flex-1 min-w-[170px] p-2.5 rounded-xl bg-surface-sunken/60 border border-surface-border flex flex-col justify-between gap-1 shadow-2xs">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-surface-muted flex items-center gap-1">
                    <Icon className="w-3 h-3 text-amber-500" />
                    {step.stage}
                  </span>
                  {step.dept && (
                    <Badge color="info" size="xs">
                      {step.dept}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-surface-foreground leading-snug">
                  {step.description}
                </p>
              </div>

              {!isLast && (
                <div className="hidden sm:flex items-center justify-center text-surface-muted shrink-0">
                  <ArrowRight className="w-4 h-4 text-primary-500/80" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default CascadeChain;
