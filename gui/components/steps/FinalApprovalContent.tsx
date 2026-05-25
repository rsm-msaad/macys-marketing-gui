"use client";

import { useState, useMemo } from "react";
import { AlertTriangle } from "lucide-react";

import { type ComplianceResult, type BriefResult } from "@/lib/ai_client";
import { ApprovalActions, ContextStack, StepVideoBackground, type StepContentProps } from "./shared";
import { CompliancePreCheck } from "@/components/CompliancePreCheck";
import { AIBriefCard } from "@/components/AIBriefCard";

function isNonEmpty(obj: unknown): boolean {
  return obj != null && typeof obj === "object" && Object.keys(obj as object).length > 0;
}

export function FinalApprovalContent({
  context,
  canAct,
  busy,
  onApprove,
  onRequestRevisions,
}: StepContentProps) {
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null);
  const [aiRecommendsRevise, setAiRecommendsRevise] = useState(false);
  const [overrideSubmit, setOverrideSubmit] = useState(false);

  // Read cached AI outputs from evidence store (persisted by components after AI call).
  // Keys "6a_output" and "6b_output" hold the raw AI result for replay.
  const cachedCompliance = useMemo(() => {
    const out = context.state.evidence?.["6a_output"];
    return isNonEmpty(out) ? (out as ComplianceResult) : null;
  }, [context.state.evidence]);

  const cachedBrief = useMemo(() => {
    const out = context.state.evidence?.["6b_output"];
    return isNonEmpty(out) ? (out as BriefResult) : null;
  }, [context.state.evidence]);

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
    <StepVideoBackground stepNumber={6}>
      <div className="space-y-3">
        <ContextStack context={context} />

        {/* AI Compliance Pre Check fires first */}
        <CompliancePreCheck
          context={context}
          onComplianceResult={handleComplianceResult}
          cachedOutput={cachedCompliance}
        />

        {/* AI Brief fires after compliance completes (or uses cache) */}
        <AIBriefCard
          context={context}
          complianceCheck={complianceResult}
          cachedOutput={cachedBrief}
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
          busy={busy}
          primaryDisabled={shouldBlockSubmit}
          primaryLabel="Final Approval"
          secondaryLabel="Hold for Revisions"
          stepNumber={6}
          onPrimary={() =>
            onApprove("Final Approval", {
              compliance_check: complianceResult,
            })
          }
          onRequestRevisions={() => onRequestRevisions(6, 5)}
        />
      </div>
    </StepVideoBackground>
  );
}
