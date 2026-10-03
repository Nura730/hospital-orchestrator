/**
 * @file OtFlowWarning.jsx
 * OT dashboard warning below the room cards: ICU overflow risk and cases without a post-op bed.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { AlertOctagon, CheckCircle2, ArrowRight } from 'lucide-react';
import flowApi from '../../api/flowApi.js';
import { useFlowPolling } from '../../hooks/useFlowPolling.js';

export function OtFlowWarning() {
  const { data } = useFlowPolling(() => flowApi.getOtImpact(), { intervalMs: 60000, refreshOn: ['ot.caseCompleted', 'bed.updated'] });
  if (!data) return <div className="flow-skeleton h-16 rounded-2xl" aria-busy="true" />;
  const blocked = data.upcoming.filter((c) => c.availability === 'NO');
  const risky = data.overflow.shortageRisk || blocked.length > 0;
  const Icon = risky ? AlertOctagon : CheckCircle2;

  return (
    <div role={risky ? 'alert' : 'status'} className={clsx('rounded-2xl border-2 p-4 flex flex-wrap items-center gap-3', risky ? 'border-[#EF4444] bg-[#EF4444]/5' : 'border-[#10B981]/50 bg-[#10B981]/5')}>
      <Icon className={clsx('w-6 h-6 shrink-0', risky ? 'text-[#EF4444]' : 'text-[#10B981]')} aria-hidden="true" />
      <div className="flex-1 min-w-[220px]">
        <p className={clsx('text-sm font-bold', risky ? 'text-fg-bad' : 'text-fg-ok')}>{data.overflow.label}</p>
        <p className="text-xs text-ink-500">
          {data.holdingPostOpBeds} surgeries in progress need post-op beds ·{' '}
          {blocked.length ? `${blocked.length} upcoming case${blocked.length > 1 ? 's' : ''} without a bed (${blocked.map((c) => c.caseNumber).join(', ')})` : 'every upcoming case has a bed path'}
        </p>
      </div>
      <Link to="/ot/flow/impact" className="flow-btn-primary">
        Flow impact <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

export default OtFlowWarning;
