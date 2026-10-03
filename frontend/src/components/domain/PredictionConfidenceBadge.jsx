/**
 * @file PredictionConfidenceBadge.jsx
 * High > 0.8 (green), Medium 0.5-0.8 (amber), Low < 0.5 (red).
 */

import React from 'react';
import clsx from 'clsx';
import { ShieldCheck } from 'lucide-react';
import { confidenceBand, BAND_STYLES } from '../../utils/flowFormat.js';

export function PredictionConfidenceBadge({ confidence, showValue = true, className = '' }) {
  const { label, band } = confidenceBand(confidence);
  const s = BAND_STYLES[band];
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap', s.bg, s.text, s.border, className)}
      title={confidence != null ? `Model confidence ${Math.round(confidence * 100)}%` : 'Confidence unknown'}
    >
      <ShieldCheck className="w-3 h-3" aria-hidden="true" />
      {label}
      {showValue && confidence != null && <span className="font-semibold normal-case">{Math.round(confidence * 100)}%</span>}
    </span>
  );
}

export default PredictionConfidenceBadge;
