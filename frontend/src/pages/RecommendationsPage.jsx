/**
 * @file RecommendationsPage.jsx
 * AI Resource Orchestration Recommendations Management.
 * Features Autonomy Mode Switch, explainable AI drawer, high-risk confirmation modal, and tabbed status feeds.
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Sparkles, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import Tabs from '../components/ui/Tabs.jsx';
import Modal from '../components/ui/Modal.jsx';
import Drawer from '../components/ui/Drawer.jsx';
import Button from '../components/ui/Button.jsx';
import AutonomyModeSwitch from '../components/domain/AutonomyModeSwitch.jsx';
import RecommendationCard from '../components/domain/RecommendationCard.jsx';
import ExplainPanel from '../components/domain/ExplainPanel.jsx';
import { useLiveStore } from '../store/liveStore.js';
import { approveRecommendation, rejectRecommendation } from '../api/endpoints.js';
import { RECOMMENDATION_STATUS, RISK_LEVELS } from '../utils/constants.js';

export function RecommendationsPage() {
  const recommendations = useLiveStore((s) => s.recommendations);
  const optimisticApproveRec = useLiveStore((s) => s.optimisticApproveRec);
  const optimisticRejectRec = useLiveStore((s) => s.optimisticRejectRec);

  const [activeTab, setActiveTab] = useState('pending');
  const [inspectRec, setInspectRec] = useState(null);
  const [rejectModalRec, setRejectModalRec] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const pendingRecs = recommendations.filter((r) => r.status === RECOMMENDATION_STATUS.PENDING);
  const approvedRecs = recommendations.filter((r) => r.status === RECOMMENDATION_STATUS.APPROVED);
  const rejectedRecs = recommendations.filter((r) => r.status === RECOMMENDATION_STATUS.REJECTED);

  const handleApprove = async (rec) => {
    try {
      optimisticApproveRec(rec.id);
      toast.success(`Approved: ${rec.title}`, { duration: 3500 });
      await approveRecommendation(rec.id);
      if (inspectRec?.id === rec.id) setInspectRec(null);
    } catch (err) {
      toast.error('Failed to approve recommendation');
    }
  };

  const handleRejectPrompt = (rec) => {
    setRejectModalRec(rec);
    setRejectReason('Clinical discretion / contraindication');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalRec) return;
    try {
      optimisticRejectRec(rejectModalRec.id, rejectReason);
      toast.error(`Declined: ${rejectModalRec.title}`, { duration: 3500 });
      await rejectRecommendation(rejectModalRec.id, rejectReason);
      setRejectModalRec(null);
      if (inspectRec?.id === rejectModalRec.id) setInspectRec(null);
    } catch (err) {
      toast.error('Failed to reject recommendation');
    }
  };

  const displayedList =
    activeTab === 'pending'
      ? pendingRecs
      : activeTab === 'executed'
      ? approvedRecs
      : rejectedRecs;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-surface-foreground flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-500" />
          AI Orchestration Recommendations
        </h2>
        <p className="text-xs text-surface-muted mt-0.5">
          Proactive bed step-downs, float nurse reassignments, and surgical slot de-confliction.
        </p>
      </div>

      {/* Autonomy Level Controller */}
      <AutonomyModeSwitch />

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'pending', label: 'Pending Review', count: pendingRecs.length },
            { id: 'executed', label: 'Executed & Dispatched', count: approvedRecs.length },
            { id: 'rejected', label: 'Rejected Log', count: rejectedRecs.length },
          ]}
        />
      </div>

      {/* Recommendations Feed */}
      <div className="space-y-4">
        {displayedList.map((rec) => (
          <RecommendationCard
            key={rec.id}
            recommendation={rec}
            onApprove={handleApprove}
            onReject={handleRejectPrompt}
            onInspect={(r) => setInspectRec(r)}
          />
        ))}

        {displayedList.length === 0 && (
          <div className="p-12 text-center bg-surface-elevated border border-surface-border rounded-xl">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-surface-foreground">No Recommendations</p>
            <p className="text-xs text-surface-muted mt-0.5">All clinical operations are balanced under current threshold protocols.</p>
          </div>
        )}
      </div>

      {/* Rationale & Explanation Drawer */}
      <Drawer
        isOpen={!!inspectRec}
        onClose={() => setInspectRec(null)}
        title={inspectRec?.title || 'Recommendation Rationale'}
        subtitle="Clinical Explainability & Safety Constraints Check"
        width="max-w-xl"
        footer={
          inspectRec?.status === RECOMMENDATION_STATUS.PENDING ? (
            <div className="flex items-center gap-2 w-full justify-end">
              <Button variant="ghost" size="sm" onClick={() => setInspectRec(null)}>
                Close
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRejectPrompt(inspectRec)}
              >
                Reject
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleApprove(inspectRec)}
              >
                Approve Recommendation
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setInspectRec(null)}>
              Close
            </Button>
          )
        }
      >
        {inspectRec && (
          <div className="space-y-6">
            <ExplainPanel explain={inspectRec.explain} />

            <div className="space-y-2">
              <span className="text-xs font-bold text-surface-foreground uppercase tracking-wider block">
                Detailed Action Sequences
              </span>
              <div className="space-y-2">
                {inspectRec.actions.map((act, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-surface-sunken/60 border border-surface-border rounded-lg text-xs"
                  >
                    <span className="font-bold text-surface-foreground block">
                      Step {idx + 1}: {act.type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-surface-muted mt-1 block">
                      Target: {act.patientName || act.staffName || act.caseId || 'System entity'}
                    </span>
                    {act.from && (
                      <span className="text-[11px] text-primary-600 dark:text-primary-400 font-mono mt-1 block">
                        Source: {act.from} → Destination: {act.to}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Reject Reason Confirmation Modal */}
      <Modal
        isOpen={!!rejectModalRec}
        onClose={() => setRejectModalRec(null)}
        title="Confirm Recommendation Rejection"
        subtitle="Please document the clinical reasoning for rejecting this automated advisory"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectModalRec(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmReject}>
              Confirm Rejection
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-surface-muted">
            You are rejecting recommendation: <strong className="text-surface-foreground">{rejectModalRec?.title}</strong>
          </p>

          <div className="space-y-1">
            <label className="font-semibold text-surface-foreground block">
              Clinical Contraindication / Reason
            </label>
            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-surface-elevated border border-surface-border rounded-lg p-2.5 text-xs text-surface-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default RecommendationsPage;
