"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  ShieldCheck,
  Wrench,
  XCircle,
} from "lucide-react";

import Link from "next/link";
import { X } from "lucide-react";

import { callCompliance, type ComplianceCheckItem, type ComplianceResult } from "@/lib/ai_client";
import type { CampaignContext } from "@/lib/api";
import { storeEvidence } from "@/lib/api";
import { EvidenceSidePanel } from "@/components/EvidenceSidePanel";

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

/* ---- Confidence indicator ---- */

type Confidence = "high" | "medium" | "low";

function computeConfidence(result: ComplianceResult): Confidence {
  const items = [result.brand_alignment, result.disclaimers, result.pricing_cross_check];
  const failCount = items.filter((i) => statusColor(i?.status ?? "warn") === "red").length;
  if (failCount === 0) return "high";
  if (failCount === 1) return "medium";
  return "low";
}

const CONFIDENCE_STYLE: Record<Confidence, { dot: string; text: string; label: string }> = {
  high: { dot: "bg-sage", text: "text-sage", label: "High confidence" },
  medium: { dot: "bg-mustard", text: "text-mustard", label: "Medium confidence" },
  low: { dot: "bg-soft_red", text: "text-soft_red", label: "Low confidence" },
};

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const s = CONFIDENCE_STYLE[confidence];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/* ---- Expandable finding card ---- */

function FindingCard({ label, item }: { label: string; item: ComplianceCheckItem | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const color = statusColor(item?.status ?? "warn");
  const StatusIcon = color === "green" ? CheckCircle2 : color === "red" ? XCircle : AlertTriangle;
  const pillCls =
    color === "green"
      ? "bg-sage/15 text-sage"
      : color === "red"
        ? "bg-soft_red/15 text-soft_red"
        : "bg-mustard/15 text-mustard";

  // Extract first sentence as summary
  const reason = item?.reason ?? "";
  const dotIdx = reason.indexOf(". ");
  const summary = dotIdx > 0 ? reason.slice(0, dotIdx + 1) : reason;
  const details = dotIdx > 0 ? reason.slice(dotIdx + 2) : "";

  return (
    <div className="rounded-md border border-charcoal/5 bg-cream/30">
      <div className="flex items-start gap-3 p-3">
        <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${pillCls}`}>
          <StatusIcon className="h-3 w-3" />
          {color === "green" ? "Pass" : color === "red" ? "Fail" : "Warn"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-charcoal">{label}</div>
          <div className="mt-0.5 text-[12px] text-charcoal/70">{summary}</div>
          {details && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-teal-600 hover:text-teal-700"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? "Hide details" : "Show details"}
            </button>
          )}
        </div>
      </div>
      {expanded && details && (
        <div className="border-t border-charcoal/5 px-3 py-2 text-[11px] leading-relaxed text-charcoal/60">
          {details}
        </div>
      )}
      {item?.cited_doc && (
        <div className="border-t border-charcoal/5 px-3 py-1.5 text-[10px] font-mono text-charcoal/35">
          Cited: {item.cited_doc}
        </div>
      )}
    </div>
  );
}

/* ---- Sources panel ---- */

function SourcesPanel({ docs, tools }: { docs: string[]; tools?: string[] }) {
  const [open, setOpen] = useState(false);
  if (docs.length === 0 && (!tools || tools.length === 0)) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-charcoal/45 hover:text-charcoal/65"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Sources used ({docs.length} docs{tools && tools.length > 0 ? `, ${tools.length} tools` : ""})
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 pl-4">
          {docs.map((d) => (
            <div key={d} className="flex items-center gap-1.5 text-[10px] text-charcoal/50">
              <FileText className="h-3 w-3 text-charcoal/30" />
              {d}
            </div>
          ))}
          {tools?.map((t) => (
            <div key={t} className="flex items-center gap-1.5 text-[10px] text-charcoal/50">
              <Wrench className="h-3 w-3 text-charcoal/30" />
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Main component ---- */

export function CompliancePreCheck({
  context,
  onComplianceResult,
  cachedOutput,
}: {
  context: CampaignContext;
  onComplianceResult?: (result: ComplianceResult | null) => void;
  cachedOutput?: ComplianceResult | null;
}) {
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [loading, setLoading] = useState(!cachedOutput || Object.keys(cachedOutput).length === 0);
  const [error, setError] = useState<string | null>(null);
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    const cid = context.campaign_brief.campaign_id;

    // If we have a non-empty cached output, use it directly — skip the API call.
    if (cachedOutput && Object.keys(cachedOutput).length > 0) {
      setResult(cachedOutput);
      setLoading(false);
      onComplianceResult?.(cachedOutput);
      firedRef.current = cid;
      return;
    }

    // Already have a local result for this campaign? Don't re-fire.
    if (result && firedRef.current === cid) {
      setLoading(false);
      return;
    }

    // Already fired for this campaign (in-flight or done)? Skip.
    if (firedRef.current === cid) return;

    firedRef.current = cid;
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Read upstream outputs: copy from Step 5, SKUs from Step 3
    const layoutOutput = context.state.step_outputs["5"] as Record<string, unknown> | undefined;
    const skuOutput = context.state.step_outputs["3"] as Record<string, unknown> | undefined;

    // Extract actual campaign copy from layout placements
    let copy = context.campaign_brief.objective;
    if (layoutOutput?.placements) {
      const p = layoutOutput.placements as Record<string, { tagline?: string; body?: string }>;
      const parts: string[] = [];
      for (const [, val] of Object.entries(p)) {
        if (val.tagline) parts.push(val.tagline);
        if (val.body) parts.push(val.body);
      }
      if (parts.length > 0) copy = parts.join(" ");
    }

    // Extract actual SKU IDs from step 3
    const skus = (skuOutput?.approved_skus as string[] | undefined) ??
      context.mock_data.sku_suggestions.map((s) => s.name).slice(0, 5);

    const campaign = {
      campaign_id: context.campaign_brief.campaign_id,
      title: context.campaign_brief.name,
      audience_segment: context.campaign_brief.target_customer,
      copy,
      skus,
      discount_pct: 25,
      regions: ["NY", "CA", "FL", "TX"],
    };

    callCompliance(campaign)
      .then((r) => {
        if (!cancelled) {
          setResult(r);
          setLoading(false);
          onComplianceResult?.(r);
          // Capture evidence for the Evidence screen
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rAny = r as any;
          const agenticTrace = rAny._agentic_trace ?? [];
          const agenticToolCalls = (agenticTrace as Array<Record<string, unknown>>).filter(
            (t: Record<string, unknown>) => t.type === "tool_call"
          );
          storeEvidence(context.campaign_brief.campaign_id, "6a", {
            step_name: "Compliance Pre Check",
            skill_name: "compliance-pre-check",
            triggered_by: "Merna (Campaign Manager)",
            mode: agenticTrace.length > 0 ? "agentic" : "pre-fetch",
            rag_docs: (r.retrieved_docs ?? []).map((id: string, i: number) => ({
              doc_id: id,
              relevance: i < 2 ? "high" : "medium",
              passage: `Referenced during compliance scanning`,
            })),
            mcp_tools: agenticToolCalls.length > 0
              ? agenticToolCalls.map((tc: Record<string, unknown>) => ({
                  tool_name: tc.tool_name,
                  inputs: tc.tool_input,
                  output_summary: JSON.stringify(tc.tool_output).slice(0, 200),
                  status: "success",
                  called_by: "Claude (agentic)",
                }))
              : [{ tool_name: "check_pricing_conflicts", inputs: { sku_ids: campaign.skus, proposed_discount_pct: campaign.discount_pct }, status: "success" }],
            agentic_trace: agenticTrace,
            agentic_iterations: rAny._agentic_iterations ?? null,
            agentic_tool_call_count: rAny._agentic_tool_calls ?? 0,
            result_summary: { recommended_action: r.recommended_action, findings: 3 },
            captured_at: new Date().toISOString(),
          }).catch(() => {}); // best effort
          // Also persist output to step_outputs so it's cached for future visits
          storeEvidence(context.campaign_brief.campaign_id, "6a_output", r).catch(() => {});
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
  }, [context.campaign_brief.campaign_id, cachedOutput]);

  const rows: { label: string; item: ComplianceCheckItem | undefined }[] = [
    { label: "Brand Alignment", item: result?.brand_alignment },
    { label: "Disclaimers", item: result?.disclaimers },
    { label: "Pricing Cross Check", item: result?.pricing_cross_check },
  ];

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [floatingUrl, setFloatingUrl] = useState<string | null>(null);
  const confidence = result ? computeConfidence(result) : null;
  const recommendedAction = result?.recommended_action ?? "";
  const actionColor = statusColor(recommendedAction);

  return (
    <div className="relative rounded-md border border-charcoal/10 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Agentic Skill · Compliance Pre Check
          </span>
          {confidence && <ConfidenceBadge confidence={confidence} />}
        </div>
        <AIBadge />
      </div>

      {/* Progress state — robot army working */}
      {loading && (
        <div className="relative overflow-hidden rounded-xl">
          <video autoPlay loop muted playsInline className="h-40 w-full object-cover rounded-xl">
            <source src="/robot-army.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent rounded-xl" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-2 text-white text-xs font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              AI robots scanning for compliance issues...
            </div>
            <div className="mt-2 flex gap-2">
              {["Brand guidelines", "Legal disclaimers", "Pricing rules"].map((label) => (
                <span key={label} className="rounded-full bg-white/15 backdrop-blur-sm px-2.5 py-1 text-[9px] font-medium text-white/80 animate-pulse">
                  {label}
                </span>
              ))}
            </div>
          </div>
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
            <FindingCard key={row.label} label={row.label} item={row.item} />
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

          {/* Sources panel */}
          <SourcesPanel
            docs={result.retrieved_docs ?? []}
            tools={["check_pricing_conflicts"]}
          />

          {/* Action row: Evidence (peek), Full Evidence View, Review */}
          <div className="mt-3 flex items-center gap-3 border-t border-charcoal/5 pt-3">
            <button
              type="button"
              onClick={() => setEvidenceOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-[11px] font-medium text-teal-700 hover:bg-teal-100"
            >
              <BookOpen className="h-3 w-3" />
              Evidence
            </button>
            <button
              type="button"
              onClick={() => setFloatingUrl("/evidence?step=6a")}
              className="text-[11px] font-medium text-charcoal/45 hover:text-charcoal/65 hover:underline"
            >
              Full View &rarr;
            </button>
            <button
              type="button"
              onClick={() => setFloatingUrl(`/review?step=6a&campaign=${context.campaign_brief.campaign_id}`)}
              className="inline-flex items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-3 py-1.5 text-[11px] font-medium text-purple-700 hover:bg-purple-100"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* Evidence side panel */}
      <EvidenceSidePanel
        stepId="6a"
        campaignId={context.campaign_brief.campaign_id}
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
      />

      {/* Floating page overlay */}
      {floatingUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          style={{ backgroundColor: "rgba(25,25,25,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setFloatingUrl(null); }}
        >
          <div className="relative w-full max-w-4xl h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-white/50 bg-white">
            <button
              type="button"
              onClick={() => setFloatingUrl(null)}
              className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-charcoal/10 text-charcoal/60 hover:bg-charcoal/20 hover:text-charcoal transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <iframe src={floatingUrl} className="h-full w-full border-0" />
          </div>
        </div>
      )}
    </div>
  );
}
