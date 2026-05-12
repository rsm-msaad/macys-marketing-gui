"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, XCircle } from "lucide-react";

import { callBrief, type BriefResult, type ComplianceResult } from "@/lib/ai_client";
import type { CampaignContext } from "@/lib/api";

function AIBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-600">
      AI
    </span>
  );
}

function SkeletonField() {
  return (
    <div className="space-y-1.5 py-2">
      <div className="h-2.5 w-20 animate-pulse rounded bg-charcoal/10" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-charcoal/8" />
    </div>
  );
}

function recommendationColor(rec: string): "green" | "yellow" | "red" {
  const lower = rec.toLowerCase();
  if (lower.includes("approve") || lower.includes("proceed")) return "green";
  if (lower.includes("reject") || lower.includes("deny")) return "red";
  return "yellow";
}

export function AIBriefCard({
  context,
  complianceCheck,
}: {
  context: CampaignContext;
  complianceCheck: ComplianceResult | null;
}) {
  const [result, setResult] = useState<BriefResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const campaign = {
      campaign_id: context.campaign_brief.campaign_id,
      title: context.campaign_brief.name,
      audience_segment: context.campaign_brief.target_customer,
      copy: context.campaign_brief.objective,
      skus: context.mock_data.sku_suggestions.map((s) => s.name).slice(0, 5),
      discount_pct: 15,
      regions: ["NY", "CA", "FL", "TX"],
      compliance_check: complianceCheck,
    };

    callBrief(campaign)
      .then((r) => {
        if (!cancelled) {
          setResult(r);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.campaign_brief.campaign_id]);

  return (
    <div className="relative rounded-md border border-charcoal/10 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            AI Approval Brief
          </span>
        </div>
        <AIBadge />
      </div>

      {loading && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-charcoal/55">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
            AI brief generating...
          </div>
          <SkeletonField />
          <SkeletonField />
          <SkeletonField />
          <SkeletonField />
          <SkeletonField />
        </div>
      )}

      {error && (
        <div className="rounded-md border border-mustard/30 bg-mustard/5 p-3 text-xs text-charcoal/70">
          AI temporarily unavailable. You may review the campaign manually.
          <div className="mt-1 text-[10px] text-charcoal/45">{error}</div>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-0 divide-y divide-charcoal/5">
          <div className="py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">Campaign Goal</div>
            <div className="mt-0.5 text-sm text-charcoal/80">{result.campaign_goal}</div>
          </div>
          <div className="py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">Target Audience</div>
            <div className="mt-0.5 text-sm text-charcoal/80">{result.target_audience}</div>
          </div>
          <div className="py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">Expected ROI</div>
            <div className="mt-0.5 text-sm text-charcoal/80">{result.expected_roi}</div>
          </div>
          <div className="py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">Risk Flags</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {result.risk_flags && result.risk_flags.length > 0 ? (
                result.risk_flags.map((flag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-soft_red/10 px-2 py-0.5 text-[10px] font-semibold text-soft_red"
                  >
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {flag}
                  </span>
                ))
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-sage/10 px-2 py-0.5 text-[10px] font-semibold text-sage">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  No flags
                </span>
              )}
            </div>
          </div>

          {/* AI Recommendation banner */}
          {(() => {
            const color = recommendationColor(result.ai_recommendation);
            const cls =
              color === "green"
                ? "border border-sage/30 bg-sage/10 text-sage"
                : color === "red"
                  ? "border border-soft_red/30 bg-soft_red/10 text-soft_red"
                  : "border border-mustard/30 bg-mustard/10 text-mustard";
            const Icon =
              color === "green" ? CheckCircle2 : color === "red" ? XCircle : AlertTriangle;
            return (
              <div className={`mt-2 flex items-center gap-2 rounded-md p-3 text-sm font-medium ${cls}`}>
                <Icon className="h-4 w-4 flex-shrink-0" />
                {result.ai_recommendation}
              </div>
            );
          })()}

          {/* Retrieved docs */}
          {result.retrieved_docs && result.retrieved_docs.length > 0 && (
            <div className="pt-2 text-[10px] font-mono text-charcoal/40">
              Sources: {result.retrieved_docs.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
