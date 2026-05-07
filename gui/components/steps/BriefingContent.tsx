"use client";

import { ApprovalActions, BriefCard, type StepContentProps } from "./shared";

export function BriefingContent({
  context,
  canAct,
  busy,
  onApprove,
  onRequestRevisions,
}: StepContentProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-charcoal/70">
        Marketing leadership has filed the campaign brief below. Review the
        strategy, offer, and constraints, then approve to begin segmentation.
      </p>
      <BriefCard brief={context.campaign_brief} />
      <ApprovalActions
        canAct={canAct}
        busy={busy}
        primaryLabel="Approve Brief"
        primaryKind="approve"
        secondaryLabel="Request Revisions"
        stepNumber={1}
        onPrimary={() => onApprove("Approve Brief", { approved: true })}
        onRequestRevisions={() => onRequestRevisions(1, 1)}
      />
    </div>
  );
}
