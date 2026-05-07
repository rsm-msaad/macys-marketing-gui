"use client";

import { ActionFooter, BriefCard, type StepContentProps } from "./shared";

export function BriefingContent({
  context,
  canAct,
  busy,
  onApprove,
}: StepContentProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-charcoal/70">
        Marketing leadership has filed the campaign brief below. Review the
        strategy, offer, and constraints, then approve to begin segmentation.
      </p>
      <BriefCard brief={context.campaign_brief} />
      <ActionFooter
        canAct={canAct}
        busy={busy}
        cta="Approve Brief"
        ctaKind="approve"
        stepNumber={1}
        onClick={() => onApprove("Approve Brief", { approved: true })}
      />
    </div>
  );
}
