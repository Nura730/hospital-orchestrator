/**
 * @file RecommendationCard.jsx
 * Operational recommendation card with risk tags, multi-step action preview, and approval workflow triggers.
 */

import React from 'react';
import clsx from 'clsx';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Clock,
  Layers,
} from 'lucide-react';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import { formatRelativeTime } from '../../utils/format.js';
import { RISK_LEVELS, RECOMMENDATION_STATUS } from '../../utils/constants.js';

export function RecommendationCard({
  recommendation,
  onApprove,
  onReject,
  onInspect,
}) {
  if (!recommendation) return null;

  const isPending = recommendation.status === RECOMMENDATION_STATUS.PENDING;
  const isApproved = recommendation.status === RECOMMENDATION_STATUS.APPROVED;
  const isRejected = recommendation.status === RECOMMENDATION_STATUS.REJECTED;

  const riskColors = {
    [RISK_LEVELS.LOW]: 'success',
    [RISK_LEVELS.MEDIUM]: 'warning',
    [RISK_LEVELS.HIGH]: 'danger',
  }[recommendation.risk] || 'neutral';

  return (
    <Card
      className={clsx(
        'transition-all',
        isPending && 'border-l-4 border-l-primary-500 hover:border-primary-500/50',
        isApproved && 'border-l-4 border-l-emerald-500 opacity-90',
        isRejected && 'border-l-4 border-l-slate-400 opacity-70'
      )}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-600/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-surface-foreground">
                {recommendation.title}
              </h4>
              <span className="text-xs text-surface-muted flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                Created {formatRelativeTime(recommendation.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge color={riskColors} size="xs" dot>
              {recommendation.risk?.toUpperCase()} RISK
            </Badge>
          </div>
        </div>

        {/* Summary Description */}
        <p className="text-xs text-surface-muted leading-relaxed">
          {recommendation.summary}
        </p>

        {/* Action Steps Preview */}
        {recommendation.actions && recommendation.actions.length > 0 && (
          <div className="p-3 rounded-lg bg-surface-sunken/60 border border-surface-border space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-surface-muted block">
              Execution Sequence ({recommendation.actions.length} Steps)
            </span>
            <div className="space-y-1.5">
              {recommendation.actions.map((act, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-surface-foreground">
                  <span className="w-4 h-4 rounded-full bg-primary-500/20 text-primary-600 dark:text-primary-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="font-semibold">{act.patientName || act.staffName || act.type}</span>
                  {act.from && (
                    <span className="text-surface-muted text-xs flex items-center gap-1">
                      ({act.from} <ArrowRight className="w-3 h-3 text-primary-500" /> {act.to})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-surface-border text-xs">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onInspect && onInspect(recommendation)}
          >
            Inspect AI Rationale & Constraints
          </Button>

          {isPending && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                icon={X}
                onClick={() => onReject && onReject(recommendation)}
              >
                Reject
              </Button>
              <Button
                variant="primary"
                size="xs"
                icon={Check}
                onClick={() => onApprove && onApprove(recommendation)}
              >
                Approve Action
              </Button>
            </div>
          )}

          {isApproved && (
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-xs">
              <ShieldCheck className="w-4 h-4" /> Executed & Dispatched
            </span>
          )}

          {isRejected && (
            <span className="text-surface-muted italic text-xs">
              Rejected: {recommendation.rejectionReason || 'Declined by clinician'}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

export default RecommendationCard;
