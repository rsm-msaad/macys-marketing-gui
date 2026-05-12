"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Shield } from "lucide-react";

import { type ComplianceResult } from "@/lib/ai_client";
import { ApprovalActions, ContextStack, type StepContentProps } from "./shared";
import { CompliancePreCheck } from "@/components/CompliancePreCheck";
import { AIBriefCard } from "@/components/AIBriefCard";

export function FinalApprovalContent({
  context,
  canAct,
  busy,
  onApprove,
  onRequestRevisions,
}: StepContentProps) {
  const checkpoints = context.mock_data.approval_checkpoints;
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null);
  const [aiRecommendsRevise, setAiRecommendsRevise] = useState(false);
  const [overrideSubmit, setOverrideSubmit] = useState(false);

  function handleComplianceResult(result: ComplianceResult | null) {
    setComplianceResult(result);
    if (result) {
      const lower = result.recommended_action.toLowerCase();
      setAiRecommendsRevise(
        lower.includes("revise") || lower.includes("reject") || lower.includes("fail") || lower.includes("block")
      );
    }
  }

  const shouldBlockSubmit = aiRecommendsRevise && !overrideSubmit;

  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      {/* AI Brief Card (Feature 2) */}
      <AIBriefCard context={context} complianceCheck={complianceResult} />

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
          All three checkpoints have signed off. Merna carries this forward as
          a single Final Approval on behalf of the committee, then production
          moves to Localization.
        </p>
      </div>

      {/* AI Compliance Pre Check (Feature 1) */}
      <CompliancePreCheck
        context={context}
        onComplianceResult={handleComplianceResult}
      />

      {/* Warning if AI recommends revisions */}
      {shouldBlockSubmit && canAct && (
        <div className="flex items-start gap-3 rounded-md border border-mustard/30 bg-mustard/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-mustard" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-mustard">
              AI recommends revisions before VP review.
            </div>
            <button
              type="button"
              onClick={() => setOverrideSubmit(true)}
              className="mt-1.5 rounded-md border border-mustard/40 bg-white px-3 py-1.5 text-xs font-medium text-mustard hover:bg-mustard/5"
            >
              Submit Anyway
            </button>
          </div>
        </div>
      )}

      <ApprovalActions
        canAct={canAct}
        busy={busy || shouldBlockSubmit}
        primaryLabel="Final Approval"
        secondaryLabel="Hold for Revisions"
        stepNumber={6}
        onPrimary={() =>
          onApprove("Final Approval", {
            checkpoints: checkpoints.map((c) => c.name),
            compliance_check: complianceResult,
          })
        }
        onRequestRevisions={() => onRequestRevisions(6, 5)}
      />
    </div>
  );
}
