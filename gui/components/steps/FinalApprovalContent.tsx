"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

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

      {/* AI Compliance Pre Check fires first */}
      <CompliancePreCheck
        context={context}
        onComplianceResult={handleComplianceResult}
      />

      {/* AI Brief fires after compliance completes */}
      <AIBriefCard context={context} complianceCheck={complianceResult} />

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
  );
}
