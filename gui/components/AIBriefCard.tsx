"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, XCircle } from "lucide-react";

import { callBrief, type BriefResult, type ComplianceResult } from "@/lib/ai_client";
import type { CampaignContext } from "@/lib/api";

function AIBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: "#D4A8431A", color: "#B8922E", border: "1px solid #D4A84330" }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-gold" />
      AI Skill
    </span>
  );
}

function SkeletonField() {
  return (
    <div className="space-y-2 py-3">
      <div className="h-2.5 w-20 animate-pulse rounded bg-charcoal/8" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-charcoal/6" />
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
    <div className="relative rounded-panel border border-charcoal/[0.06] bg-white p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-600">
            Approval Brief
          </span>
        </div>
        <AIBadge />
      </div>

      {loading && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-stone">
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
        <div className="rounded-card border border-amber/30 bg-amber/5 p-4 text-xs text-charcoal/70">
          AI temporarily unavailable. You may review the campaign manually.
          <div className="mt-1.5 text-[10px] text-stone/60">{error}</div>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-0 divide-y divide-charcoal/[0.05]">
          {[
            { label: "Campaign Goal", value: result.campaign_goal },
            { label: "Target Audience", value: result.target_audience },
            { label: "Expected ROI", value: result.expected_roi },
          ].map((field) => (
            <div key={field.label} className="py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone">
                {field.label}
              </div>
              <div className="ai-generated mt-1 text-[14px] text-charcoal/80">
                {field.value}
              </div>
            </div>
          ))}

          <div className="py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone">
              Risk Flags
            </div>
            {result.risk_flags && result.risk_flags.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {result.risk_flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-charcoal/75">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose" />
                    <span className="ai-generated line-clamp-2">{flag}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs italic text-stone/50">No risk flags identified</p>
            )}
          </div>

          {/* AI Recommendation banner */}
          {(() => {
            const color = recommendationColor(result.ai_recommendation);
            const styles = {
              green: { border: "#8DA67E40", bg: "#8DA67E10", text: "#6B8A5E" },
              yellow: { border: "#D49B4340", bg: "#D49B4310", text: "#B8842E" },
              red: { border: "#C9737340", bg: "#C9737310", text: "#B55A5A" },
            }[color];
            const Icon =
              color === "green" ? CheckCircle2 : color === "red" ? XCircle : AlertTriangle;
            return (
              <div
                className="mt-3 flex items-center gap-2.5 rounded-card p-4 text-sm font-medium"
                style={{
                  border: `1px solid ${styles.border}`,
                  backgroundColor: styles.bg,
                  color: styles.text,
                }}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="ai-generated">{result.ai_recommendation}</span>
              </div>
            );
          })()}

          {/* Retrieved docs */}
          {result.retrieved_docs && result.retrieved_docs.length > 0 && (
            <div className="pt-3 font-mono text-[10px] text-stone/40">
              Sources: {result.retrieved_docs.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
