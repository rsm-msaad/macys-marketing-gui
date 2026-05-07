"use client";

import { CheckCircle2, Shield } from "lucide-react";

import { ActionFooter, ContextStack, type StepContentProps } from "./shared";

export function FinalApprovalContent({
  context,
  canAct,
  busy,
  onApprove,
}: StepContentProps) {
  const checkpoints = context.mock_data.approval_checkpoints;

  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Approval checkpoints ({checkpoints.length})
          </span>
        </div>
        <div className="space-y-2">
          {checkpoints.map((c) => (
            <div
              key={c.name}
              className="flex items-start gap-3 rounded-md border border-sage/30 bg-sage/5 p-3"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-sage" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-charcoal">{c.name}</span>
                  <span className="rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sage">
                    {c.status}
                  </span>
                </div>
                <div className="text-[12px] text-charcoal/65">
                  Reviewer: <span className="text-charcoal/85">{c.reviewer}</span>
                </div>
                <div className="mt-1 text-[12px] text-charcoal/70">{c.criteria}</div>
                <div className="mt-1 text-[11px] italic text-charcoal/45">
                  {c.reviewed_at}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-charcoal/65">
          All three checkpoints have signed off. Sarah carries this forward as
          a single Final Approval on behalf of the committee, then production
          moves to Localization.
        </p>
      </div>

      <ActionFooter
        canAct={canAct}
        busy={busy}
        cta="Final Approval"
        ctaKind="approve"
        stepNumber={6}
        onClick={() =>
          onApprove("Final Approval", {
            checkpoints: checkpoints.map((c) => c.name),
          })
        }
      />
    </div>
  );
}
