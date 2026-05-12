"use client";

import { Sparkles, Users } from "lucide-react";

import { ActionFooter, ContextStack, type StepContentProps } from "./shared";

const PRESELECTED_SEGMENT = {
  name: "VIP Loyalists",
  customer_count: 9590,
  why: "Highest monetary, lowest recency, highest frequency. Skews 53% Gold + 15% Platinum tiers, exactly the audience the brief targets.",
};

export function SegmentationContent({
  context,
  canAct,
  busy,
  onApprove,
  onLaunchSkill,
}: StepContentProps) {
  const segmentRunCompleted = "1" in context.state.step_outputs ||
    Object.keys(context.state.step_outputs).length > 0;
  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Skill: Audience Segment Builder
          </span>
        </div>
        <p className="text-sm text-charcoal/70">
          Run RFM clustering on 50,000 customers. Returns 3 segments. Merna
          picks the one that best matches the brief, then approves.
        </p>

        <div className="mt-3 rounded-md border border-teal-600/30 bg-teal-50/40 p-3">
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 text-teal-600" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
                Recommended segment
              </div>
              <div className="font-serif text-base font-semibold text-charcoal">
                {PRESELECTED_SEGMENT.name}
                <span className="ml-2 text-[12px] font-normal text-charcoal/55">
                  ≈{PRESELECTED_SEGMENT.customer_count.toLocaleString()} customers
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-charcoal/70">
                {PRESELECTED_SEGMENT.why}
              </p>
            </div>
          </div>
        </div>

        {!segmentRunCompleted && canAct && (
          <button
            type="button"
            onClick={() => onLaunchSkill("segment")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-teal-600 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
          >
            Open the skill to see all 3 segments side by side →
          </button>
        )}
      </div>

      <ActionFooter
        canAct={canAct}
        busy={busy}
        cta={`Approve ${PRESELECTED_SEGMENT.name}`}
        ctaKind="approve"
        stepNumber={2}
        onClick={() =>
          onApprove("Approve Segment", PRESELECTED_SEGMENT)
        }
      />
    </div>
  );
}
