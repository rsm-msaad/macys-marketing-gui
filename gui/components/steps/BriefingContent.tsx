"use client";

import { updateCampaign } from "@/lib/api";
import { ApprovalActions, BriefCard, type StepContentProps } from "./shared";

export function BriefingContent({
  context,
  canAct,
  busy,
  onApprove,
  onRequestRevisions,
}: StepContentProps) {
  async function handleSaveBrief(updated: typeof context.campaign_brief) {
    try {
      await updateCampaign(updated.campaign_id, {
        name: updated.name,
        objective: updated.objective,
        target_customer: updated.target_customer,
        promotional_offer: updated.promotional_offer,
        constraints: updated.constraints,
      });
    } catch {
      // Best effort; the local state already shows the edit.
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-charcoal/70">
        Marketing leadership has filed the campaign brief below. Review the
        strategy, offer, and constraints, then approve to begin segmentation.
      </p>
      <BriefCard
        brief={context.campaign_brief}
        editable={canAct}
        onSave={handleSaveBrief}
      />
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
