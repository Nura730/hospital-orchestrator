/**
 * @file ExplainPanel.jsx
 * Explainable AI decision panel displaying clinical reasoning, safety constraint checks, and expected benefits.
 */

import React from 'react';
import { CheckCircle2, HelpCircle, TrendingUp, ShieldCheck } from 'lucide-react';

export function ExplainPanel({ explain = null }) {
  if (!explain) return null;

  return (
    <div className="space-y-4 p-4 rounded-xl bg-surface-sunken/60 border border-surface-border text-xs">
      {/* Why Section */}
      {explain.why && explain.why.length > 0 && (
        <div>
          <span className="font-bold text-surface-foreground flex items-center gap-1.5 uppercase tracking-wider text-xs mb-2">
            <HelpCircle className="w-3.5 h-3.5 text-primary-500" />
            Clinical Reasoning & Root Cause
          </span>
          <ul className="space-y-1.5 pl-1">
            {explain.why.map((reason, i) => (
              <li key={i} className="text-surface-muted flex items-start gap-2 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Constraints Checked (Green Checks) */}
      {explain.constraintsChecked && explain.constraintsChecked.length > 0 && (
        <div className="pt-3 border-t border-surface-border/60">
          <span className="font-bold text-surface-foreground flex items-center gap-1.5 uppercase tracking-wider text-xs mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Safety Constraints Verified
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {explain.constraintsChecked.map((constraint, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg bg-surface-elevated border border-surface-border text-xs text-surface-muted"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="truncate">{constraint}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expected Benefit */}
      {explain.expectedBenefit && (
        <div className="pt-3 border-t border-surface-border/60 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Expected Clinical & Operational Benefit</span>
          </div>
          <p className="leading-relaxed">
            {explain.expectedBenefit}
          </p>
        </div>
      )}
    </div>
  );
}

export default ExplainPanel;
