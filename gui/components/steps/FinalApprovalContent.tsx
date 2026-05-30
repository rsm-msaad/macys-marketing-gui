"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, SkipForward } from "lucide-react";

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

  const [briefDone, setBriefDone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const shouldBlockSubmit = aiRecommendsRevise && !overrideSubmit;

  function handleSkipStep6() {
    setSkipped(true);
    // Create a mock compliance result so downstream steps work
    const mockCompliance: ComplianceResult = {
      brand_alignment: { status: "pass", reason: "Skipped - AI unavailable during demo", cited_doc: "N/A" },
      disclaimers: { status: "pass", reason: "Skipped - AI unavailable during demo", cited_doc: "N/A" },
      pricing_cross_check: { status: "pass", reason: "Skipped - AI unavailable during demo", cited_doc: "N/A" },
      recommended_action: "proceed",
      retrieved_docs: [],
    };
    handleComplianceResult(mockCompliance);
    setBriefDone(true);
  }

  if (skipped) {
    return (
      <StepVideoBackground stepNumber={6}>
        <div className="space-y-3">
          <ContextStack context={context} />
          <div className="rounded-md border border-mustard/30 bg-mustard/10 p-4">
            <div className="flex items-start gap-2">
              <SkipForward className="mt-0.5 h-4 w-4 text-mustard" />
              <div>
                <div className="text-sm font-semibold text-mustard">Step 6 skipped - AI temporarily unavailable</div>
                <p className="mt-1 text-xs text-charcoal/60">
                  Compliance and brief checks were bypassed for this demo run. In production, these would be mandatory before proceeding.
                </p>
              </div>
            </div>
          </div>
          <ApprovalActions
            canAct={canAct}
            busy={busy}
            primaryDisabled={false}
            primaryLabel="Continue to Step 7"
            secondaryLabel="Hold for Revisions"
            stepNumber={6}
            onPrimary={() =>
              onApprove("Skipped - AI unavailable", {
                compliance_check: complianceResult,
                skipped: true,
              })
            }
            onRequestRevisions={() => onRequestRevisions(6, 5)}
          />
        </div>
      </StepVideoBackground>
    );
  }

  return (
    <StepVideoBackground stepNumber={6}>
      <div className="space-y-3">
        <ContextStack context={context} />

        {/* Skip button - always visible as fallback */}
        {canAct && !briefDone && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSkipStep6}
              className="inline-flex items-center gap-1.5 rounded-md border border-mustard/30 bg-mustard/10 px-3 py-1.5 text-xs font-medium text-mustard hover:bg-mustard/20 transition-colors"
            >
              <SkipForward className="h-3 w-3" />
              Skip Step 6 (AI unavailable)
            </button>
          </div>
        )}

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
          onBriefDone={setBriefDone}
        />

        {/* Warning + approval only after brief is done */}
        {briefDone && shouldBlockSubmit && canAct && (
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

        {briefDone && (
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
        )}
      </div>
    </StepVideoBackground>
  );
}
