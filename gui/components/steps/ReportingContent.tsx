"use client";

import { useState } from "react";
import { FileEdit, Send } from "lucide-react";

import { ActionFooter, ContextStack, type StepContentProps } from "./shared";

const DRAFT_SUMMARY =
  "The Mother's Day Beauty Event generated $1.27M in revenue across 10 days, " +
  "exceeding budget by 12 percent. Email was the strongest channel " +
  "(56x ROAS), while display underperformed (1.1x ROAS) and we recommend " +
  "pausing it next cycle. The Platinum segment over-indexed at +44 percent " +
  "vs the campaign average unique-buyer rate; Bronze under-indexed at " +
  "-17 percent and is the natural target for a Mother's Day winback in 2027. " +
  "Looking ahead to the next 14 days, revenue is forecast to trend up to " +
  "$1.6M (80 percent CI: $1.4M to $1.8M), driven by email and search. " +
  "Recommend the same channel mix for Easter Family Style 2027, with a " +
  "softer paid social allocation.";

export function ReportingContent({
  context,
  canAct,
  busy,
  onApprove,
}: StepContentProps) {
  const [draft, setDraft] = useState(DRAFT_SUMMARY);

  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <FileEdit className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Auto-drafted executive summary
          </span>
        </div>
        <p className="text-[12px] text-charcoal/65">
          AI drafted the readout from the Performance Analyzer output. Anna
          edits in business context (campaign cadence, store-side anecdotes,
          known seasonal effects) before sending up the chain.
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={9}
          disabled={!canAct}
          className="mt-3 w-full rounded-md border border-charcoal/15 bg-cream/30 p-3 font-serif text-[13px] leading-relaxed text-charcoal focus:border-teal-600 focus:outline-none disabled:opacity-70"
        />
        <div className="mt-1 text-[10px] text-charcoal/50">
          {draft.length} characters · keep under 1500 for the leadership
          one-pager.
        </div>
      </div>

      <ActionFooter
        canAct={canAct}
        busy={busy}
        cta="Send to Leadership"
        ctaKind="send"
        stepNumber={10}
        onClick={() =>
          onApprove("Send to Leadership", { summary: draft.slice(0, 4000) })
        }
      />
    </div>
  );
}
