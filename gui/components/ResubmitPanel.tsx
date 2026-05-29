"use client";

import { useState } from "react";
import { ArrowRightCircle, Loader2, RefreshCw } from "lucide-react";

import { resubmitStep, type PendingRevision } from "@/lib/api";
import { getStepOwnerName } from "@/lib/authorities";

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

export function ResubmitPanel({
  campaignId,
  pending,
  onResubmitted,
}: {
  campaignId: string;
  pending: PendingRevision;
  onResubmitted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepName = STEP_NAMES[pending.step_to_redo] ?? `Step ${pending.step_to_redo}`;
  const requesterName = getStepOwnerName(pending.requested_from_step);

  async function handleResubmit() {
    setBusy(true);
    setError(null);
    try {
      await resubmitStep(campaignId, pending.step_to_redo);
      onResubmitted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-mustard/50 bg-mustard/5 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-mustard/15 text-mustard">
          <RefreshCw className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-mustard">
            Revision Requested · Step {pending.step_to_redo} of 10
          </div>
          <h3 className="mt-0.5 font-serif text-lg font-semibold text-charcoal">
            Resubmit {stepName}
          </h3>
          <p className="mt-1 text-sm text-charcoal/70">
            <strong className="text-charcoal">{requesterName}</strong> sent this
            back from Step {pending.requested_from_step} with the following
            note:
          </p>

          <blockquote className="mt-3 rounded-md border-l-4 border-mustard bg-white p-3 text-sm italic text-charcoal/80">
            “{pending.comment}”
          </blockquote>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResubmit}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-mustard px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRightCircle className="h-3.5 w-3.5" />
              )}
              Resubmit {stepName}
            </button>
            <span className="text-[11px] text-charcoal/55">
              Returns the campaign to Step {pending.resume_step} for{" "}
              {requesterName} to review again.
            </span>
          </div>

          {error && <p className="mt-2 text-xs text-soft_red">{error}</p>}
        </div>
      </div>
    </div>
  );
}
