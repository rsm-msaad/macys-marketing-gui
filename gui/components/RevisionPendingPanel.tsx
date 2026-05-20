"use client";

import { Hourglass } from "lucide-react";

import type { PendingRevision } from "@/lib/api";
import { getStepOwnerName, getStepOwnerTitle } from "@/lib/authorities";

const STEP_NAMES: Record<number, string> = {
  1: "Briefing",
  2: "Segmentation",
  3: "SKU Selection",
  4: "Creative Production",
  5: "Layout Assembly",
  6: "Final Approval",
  7: "Localization",
  8: "Activation",
  9: "Monitoring",
  10: "Reporting",
};

export function RevisionPendingPanel({
  pending,
}: {
  pending: PendingRevision;
}) {
  const redoStepName = STEP_NAMES[pending.step_to_redo] ?? `Step ${pending.step_to_redo}`;
  const redoOwner = getStepOwnerName(pending.step_to_redo);
  const redoTitle = getStepOwnerTitle(pending.step_to_redo);

  return (
    <div className="rounded-lg border border-mustard/40 bg-mustard/5 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-mustard/15 text-mustard">
          <Hourglass className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-mustard">
            Revision Requested · Awaiting resubmission
          </div>
          <h3 className="mt-0.5 font-serif text-lg font-semibold text-charcoal">
            Waiting on {redoOwner} to resubmit Step {pending.step_to_redo}: {redoStepName}
          </h3>
          <p className="mt-1 text-sm text-charcoal/70">
            <strong className="text-charcoal">{redoOwner}</strong>{" "}
            <span className="text-charcoal/55">({redoTitle})</span> needs to
            address the feedback below before this campaign can advance to
            Step {pending.resume_step}.
          </p>
          <blockquote className="mt-3 rounded-md border-l-4 border-mustard bg-white p-3 text-sm italic text-charcoal/80">
            “{pending.comment}”
          </blockquote>
          <p className="mt-3 text-[11px] text-charcoal/55">
            The poll will pick up the resubmit automatically. Switch to{" "}
            {redoOwner}&apos;s view to take the action.
          </p>
        </div>
      </div>
    </div>
  );
}
