"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { springSmooth } from "@/lib/motion";

import { callCompliance, type ComplianceCheckItem, type ComplianceResult } from "@/lib/ai_client";
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

function statusColor(status: string): "green" | "yellow" | "red" {
  const lower = status.toLowerCase();
  if (lower === "pass" || lower === "approved" || lower === "ok") return "green";
  if (lower === "fail" || lower === "reject" || lower === "block") return "red";
  return "yellow";
}

function StatusPill({ status }: { status: string }) {
  const color = statusColor(status);
  const styles = {
    green: { bg: "#8DA67E1A", text: "#6B8A5E" },
    yellow: { bg: "#D49B431A", text: "#B8842E" },
    red: { bg: "#C973731A", text: "#B55A5A" },
  }[color];

  const Icon =
    color === "green" ? CheckCircle2 : color === "red" ? XCircle : AlertTriangle;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: styles.bg, color: styles.text }}
    >
      <Icon className="h-3 w-3" />
      {color === "green" ? "Pass" : color === "red" ? "Fail" : "Warn"}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-card border border-charcoal/[0.04] bg-cream/40 p-4">
      <div className="h-5 w-14 animate-pulse rounded-full bg-charcoal/8" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-3/4 animate-pulse rounded bg-charcoal/8" />
        <div className="h-2 w-1/2 animate-pulse rounded bg-charcoal/6" />
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
    <div className="relative rounded-panel border border-charcoal/[0.06] bg-white p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-600">
            Compliance Pre Check
          </span>
        </div>
        <AIBadge />
      </div>

      {loading && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-stone">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
            AI compliance check running...
          </div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {error && (
        <div className="rounded-card border border-amber/30 bg-amber/5 p-4 text-xs text-charcoal/70">
          AI temporarily unavailable. You may proceed manually.
          <div className="mt-1.5 text-[10px] text-stone/60">{error}</div>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <motion.div
              key={row.label}
              className="flex items-start gap-3 rounded-card border border-charcoal/[0.04] bg-cream/40 p-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springSmooth, delay: i * 0.1 }}
            >
              <StatusPill status={row.item?.status ?? "warn"} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-charcoal">{row.label}</div>
                <div className="ai-accent mt-1 text-[12px] text-charcoal/65">
                  {row.item?.reason}
                </div>
                {row.item?.cited_doc && (
                  <div className="mt-1 font-mono text-[10px] text-stone/40">
                    {row.item.cited_doc}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Recommended action banner */}
          <div
            className={`mt-4 flex items-center justify-between rounded-card p-4 ${
              actionColor === "green"
                ? "border border-sage/30 bg-sage/10"
                : actionColor === "red"
                  ? "border border-rose/30 bg-rose/10"
                  : "border border-amber/30 bg-amber/10"
            }`}
          >
            <span
              className="text-sm font-bold uppercase tracking-wide"
              style={{
                color:
                  actionColor === "green"
                    ? "#6B8A5E"
                    : actionColor === "red"
                      ? "#B55A5A"
                      : "#B8842E",
              }}
            >
              {recommendedAction.toUpperCase()}
            </span>
            <span className="text-[12px] text-charcoal/60">
              {actionColor === "green"
                ? "All checks passed. Safe to advance."
                : actionColor === "red"
                  ? "Blocking issues found. Must fix before approval."
                  : "Issues flagged. Review before advancing."}
            </span>
          </div>

          {/* Retrieved docs citation */}
          {result.retrieved_docs && result.retrieved_docs.length > 0 && (
            <div className="mt-2 font-mono text-[10px] text-stone/40">
              Sources: {result.retrieved_docs.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
