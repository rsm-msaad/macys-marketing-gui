"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";

import { callCompliance, type ComplianceCheckItem, type ComplianceResult } from "@/lib/ai_client";
import type { CampaignContext } from "@/lib/api";

function AIBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-600">
      AI
    </span>
  );
}

function statusColor(status: string): "green" | "yellow" | "red" {
  const lower = status.toLowerCase();
  if (lower === "pass" || lower === "approved" || lower === "ok") return "green";
  if (lower === "fail" || lower === "reject" || lower === "block") return "red";
  return "yellow";
}

function StatusPill({ status }: { status: string }) {
  const color = statusColor(status);
  const cls =
    color === "green"
      ? "bg-sage/15 text-sage"
      : color === "red"
        ? "bg-soft_red/15 text-soft_red"
        : "bg-mustard/15 text-mustard";

  const Icon =
    color === "green" ? CheckCircle2 : color === "red" ? XCircle : AlertTriangle;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      <Icon className="h-3 w-3" />
      {color === "green" ? "Pass" : color === "red" ? "Fail" : "Warn"}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-charcoal/5 bg-cream/30 p-3">
      <div className="h-5 w-14 animate-pulse rounded-full bg-charcoal/10" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-3/4 animate-pulse rounded bg-charcoal/10" />
        <div className="h-2 w-1/2 animate-pulse rounded bg-charcoal/8" />
      </div>
    </div>
  );
}

export function CompliancePreCheck({
  context,
  onComplianceResult,
}: {
  context: CampaignContext;
  onComplianceResult?: (result: ComplianceResult | null) => void;
}) {
  const [result, setResult] = useState<ComplianceResult | null>(null);
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
    };

    callCompliance(campaign)
      .then((r) => {
        if (!cancelled) {
          setResult(r);
          setLoading(false);
          onComplianceResult?.(r);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
          onComplianceResult?.(null);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.campaign_brief.campaign_id]);

  const rows: { label: string; item: ComplianceCheckItem | undefined }[] = [
    { label: "Brand Alignment", item: result?.brand_alignment },
    { label: "Disclaimers", item: result?.disclaimers },
    { label: "Pricing Cross Check", item: result?.pricing_cross_check },
  ];

  const recommendedAction = result?.recommended_action ?? "";
  const actionColor = statusColor(recommendedAction);

  return (
    <div className="relative rounded-md border border-charcoal/10 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            AI Compliance Pre Check
          </span>
        </div>
        <AIBadge />
      </div>

      {loading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-charcoal/55">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
            AI compliance check running...
          </div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {error && (
        <div className="rounded-md border border-mustard/30 bg-mustard/5 p-3 text-xs text-charcoal/70">
          AI temporarily unavailable. You may proceed manually.
          <div className="mt-1 text-[10px] text-charcoal/45">{error}</div>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-start gap-3 rounded-md border border-charcoal/5 bg-cream/30 p-3"
            >
              <StatusPill status={row.item?.status ?? "warn"} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-charcoal">{row.label}</div>
                <div className="mt-0.5 text-[12px] text-charcoal/70">{row.item?.reason}</div>
                {row.item?.cited_doc && (
                  <div className="mt-0.5 text-[10px] font-mono text-charcoal/40">
                    {row.item.cited_doc}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Recommended action banner */}
          <div
            className={`mt-3 flex items-center justify-between rounded-md p-3 ${
              actionColor === "green"
                ? "border border-green-200 bg-green-50 text-green-900"
                : actionColor === "red"
                  ? "border border-red-200 bg-red-50 text-red-900"
                  : "border border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <span className="text-sm font-bold uppercase tracking-wide">
              {recommendedAction.toUpperCase()}
            </span>
            <span className="text-xs">
              {actionColor === "green"
                ? "All checks passed. Safe to advance."
                : actionColor === "red"
                  ? "Blocking issues found. Must fix before approval."
                  : "Issues flagged. Review before advancing."}
            </span>
          </div>

          {/* Retrieved docs citation */}
          {result.retrieved_docs && result.retrieved_docs.length > 0 && (
            <div className="mt-1 text-[10px] font-mono text-charcoal/40">
              Sources: {result.retrieved_docs.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
