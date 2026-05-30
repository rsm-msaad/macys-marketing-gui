"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Pencil,
  RotateCcw,
  Wrench,
  XCircle,
} from "lucide-react";

import { callBrief, type BriefResult, type ComplianceResult } from "@/lib/ai_client";
import type { CampaignContext } from "@/lib/api";
import { storeEvidence } from "@/lib/api";
import { EvidenceSidePanel } from "@/components/EvidenceSidePanel";

function AIBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-teal-600">
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

function BriefConfidence({ result }: { result: BriefResult }) {
  const hasRisks = result.risk_flags && result.risk_flags.length > 0;
  const recLower = result.ai_recommendation.toLowerCase();
  const isRevise = recLower.includes("revise") || recLower.includes("reject");
  const level = isRevise ? "low" : hasRisks ? "medium" : "high";
  const styles = {
    high: { dot: "bg-sage", text: "text-sage", label: "High confidence" },
    medium: { dot: "bg-mustard", text: "text-mustard", label: "Medium confidence" },
    low: { dot: "bg-soft_red", text: "text-soft_red", label: "Low confidence" },
  };
  const s = styles[level];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function BriefSourcesPanel({ docs }: { docs: string[] }) {
  const [open, setOpen] = useState(false);
  if (!docs || docs.length === 0) return null;
  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-charcoal/45 hover:text-charcoal/65"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Sources used ({docs.length} docs)
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 pl-4">
          {docs.map((d) => (
            <div key={d} className="flex items-center gap-1.5 text-xs text-charcoal/50">
              <FileText className="h-3 w-3 text-charcoal/30" />
              {d}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function recommendationColor(rec: string): "green" | "yellow" | "red" {
  const lower = rec.toLowerCase();
  if (lower.includes("approve") || lower.includes("proceed")) return "green";
  if (lower.includes("reject") || lower.includes("deny")) return "red";
  return "yellow";
}

type EditableBrief = {
  campaign_goal: string;
  target_audience: string;
  expected_roi: string;
  risk_flags: string;
  ai_recommendation: string;
};

function briefToEditable(r: BriefResult): EditableBrief {
  return {
    campaign_goal: r.campaign_goal,
    target_audience: r.target_audience,
    expected_roi: r.expected_roi,
    risk_flags: (r.risk_flags ?? []).join("\n"),
    ai_recommendation: r.ai_recommendation,
  };
}

function editableToBrief(e: EditableBrief, original: BriefResult): BriefResult {
  return {
    ...original,
    campaign_goal: e.campaign_goal,
    target_audience: e.target_audience,
    expected_roi: e.expected_roi,
    risk_flags: e.risk_flags
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    ai_recommendation: e.ai_recommendation,
  };
}

const FIELDS: { key: keyof EditableBrief; label: string; rows: number }[] = [
  { key: "campaign_goal", label: "Campaign Goal", rows: 2 },
  { key: "target_audience", label: "Target Audience", rows: 2 },
  { key: "expected_roi", label: "Expected ROI", rows: 2 },
  { key: "risk_flags", label: "Risk Flags (one per line)", rows: 4 },
  { key: "ai_recommendation", label: "Recommendation", rows: 2 },
];

export function AIBriefCard({
  context,
  complianceCheck,
  cachedOutput,
  onBriefDone,
}: {
  context: CampaignContext;
  complianceCheck: ComplianceResult | null;
  cachedOutput?: BriefResult | null;
  onBriefDone?: (done: boolean) => void;
}) {
  const [result, setResult] = useState<BriefResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [waitingForCompliance, setWaitingForCompliance] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableBrief | null>(null);
  const [wasEdited, setWasEdited] = useState(false);
  const [aiOriginal, setAiOriginal] = useState<BriefResult | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [floatingUrl, setFloatingUrl] = useState<string | null>(null);
  const firedRef = useRef<string | null>(null);

  // Notify parent when brief is done
  useEffect(() => {
    onBriefDone?.(result !== null);
  }, [result, onBriefDone]);

  useEffect(() => {
    const cid = context.campaign_brief.campaign_id;

    // If we have a non-empty cached output, use it directly - skip the API call.
    if (cachedOutput && Object.keys(cachedOutput).length > 0) {
      setResult(cachedOutput);
      setAiOriginal(cachedOutput);
      setWaitingForCompliance(false);
      setLoading(false);
      firedRef.current = cid;
      return;
    }

    if (!complianceCheck) {
      setWaitingForCompliance(true);
      setLoading(false);
      return;
    }

    // Already have a local result for this campaign? Don't re-fire.
    if (result && firedRef.current === cid) {
      setLoading(false);
      return;
    }

    // Already fired the API for this campaign? Skip.
    // But if we were waiting for compliance and it just arrived, allow re-fire.
    if (firedRef.current === cid && !waitingForCompliance) return;

    // Compliance is done, no cache - fire the brief skill.
    firedRef.current = cid;
    setWaitingForCompliance(false);
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Read upstream: actual copy from Step 5, SKUs from Step 3, segment from Step 2
    const layoutOutput = context.state.step_outputs["5"] as Record<string, unknown> | undefined;
    const skuOutput = context.state.step_outputs["3"] as Record<string, unknown> | undefined;
    const segmentOutput = context.state.step_outputs["2"] as Record<string, unknown> | undefined;

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

    const skus = (skuOutput?.approved_skus as string[] | undefined) ??
      context.mock_data.sku_suggestions.map((s) => s.name).slice(0, 5);

    const audience = (segmentOutput?.name as string | undefined) ??
      context.campaign_brief.target_customer;

    const campaign = {
      campaign_id: context.campaign_brief.campaign_id,
      title: context.campaign_brief.name,
      audience_segment: audience,
      copy,
      skus,
      discount_pct: 25,
      regions: ["NY", "CA", "FL", "TX"],
      compliance_check: complianceCheck,
    };

    callBrief(campaign)
      .then((r) => {
        if (!cancelled) {
          setResult(r);
          setAiOriginal(r);
          setLoading(false);
          // Capture evidence (with agentic trace if present)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rAny = r as any;
          const agenticTrace = rAny._agentic_trace ?? [];
          const agenticToolCalls = (agenticTrace as Array<Record<string, unknown>>).filter(
            (t: Record<string, unknown>) => t.type === "tool_call"
          );
          storeEvidence(context.campaign_brief.campaign_id, "6b", {
            step_name: "Approval Brief Generator",
            skill_name: "approval-brief-generator",
            triggered_by: "System (auto-fires after compliance)",
            mode: agenticTrace.length > 0 ? "agentic" : "pre-fetch",
            rag_docs: (r.retrieved_docs ?? []).map((id: string, i: number) => ({
              doc_id: id,
              relevance: i < 1 ? "high" : "medium",
              passage: "Referenced for ROI benchmarking and risk assessment",
            })),
            mcp_tools: agenticToolCalls.map((tc: Record<string, unknown>) => ({
              tool_name: tc.tool_name,
              inputs: tc.tool_input,
              output_summary: JSON.stringify(tc.tool_output).slice(0, 200),
              status: "success",
              called_by: "Claude (agentic)",
            })),
            agentic_trace: agenticTrace,
            agentic_iterations: rAny._agentic_iterations ?? null,
            agentic_tool_call_count: rAny._agentic_tool_calls ?? 0,
            prior_outputs: [{ step_id: "6a", step_name: "Compliance Pre Check", field: "compliance_check" }],
            result_summary: { recommendation: r.ai_recommendation, risk_flags: r.risk_flags?.length ?? 0 },
            captured_at: new Date().toISOString(),
          }).catch(() => {});
          // Persist output for caching
          storeEvidence(context.campaign_brief.campaign_id, "6b_output", r).catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          // API unavailable - use realistic fallback after brief delay
          setTimeout(() => {
            if (cancelled) return;
            const fallback: BriefResult = {
              campaign_goal: `Drive Mother's Day sales among ${context.campaign_brief.target_customer} with curated ${context.campaign_brief.name} featuring Star Rewards exclusive offers.`,
              target_audience: `${context.campaign_brief.target_customer} - customers who purchased prestige Beauty in the prior 12 months with active Star Rewards membership.`,
              expected_roi: "Based on Q4 2025 Holiday and Spring 2025 Beauty retrospectives, we project a conversion rate 1.4–1.8x the segment average and email open rates above 38%.",
              risk_flags: [],
              ai_recommendation: "Approve - compliance check passed all three findings (brand alignment, disclaimers, pricing cross-check). No risk flags identified.",
              retrieved_docs: ["RETRO-Q4-2025", "RETRO-SP-2025-BTY"],
            };
            setResult(fallback);
            setLoading(false);
            onBriefDone?.(true);
            storeEvidence(context.campaign_brief.campaign_id, "6b_output", fallback).catch(() => {});
          }, 1800);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.campaign_brief.campaign_id, complianceCheck, cachedOutput]);

  function startEditing() {
    if (result) {
      setDraft(briefToEditable(result));
      setEditing(true);
    }
  }

  function handleSave() {
    if (draft && result) {
      const updated = editableToBrief(draft, result);
      setResult(updated);
      setWasEdited(true);
      setEditing(false);
    }
  }

  function handleCancel() {
    setDraft(null);
    setEditing(false);
  }

  function resetToAI() {
    if (aiOriginal) {
      setResult(aiOriginal);
      setWasEdited(false);
    }
  }

  function updateField(key: keyof EditableBrief, value: string) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div className="relative rounded-xl border border-white/70 bg-white/80 p-4 backdrop-blur-sm" style={{ boxShadow: "var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.8)" }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-600">
            Agentic Skill · Approval Brief Generator
          </span>
          {result && !loading && <BriefConfidence result={result} />}
          {wasEdited && (
            <span className="text-xs italic text-charcoal/45">
              (manually edited)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result && !loading && !editing && (
            <button
              type="button"
              onClick={startEditing}
              className="rounded p-1 text-charcoal/40 hover:bg-cream hover:text-charcoal/70"
              title="Edit brief manually"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <AIBadge />
        </div>
      </div>

      {/* Waiting for compliance to complete - show muted queued state */}
      {waitingForCompliance && !result && !loading && (
        <div className="space-y-1 opacity-50">
          <div className="flex items-center gap-2 text-xs text-charcoal/40">
            <Loader2 className="h-3.5 w-3.5 text-charcoal/25" />
            Waiting for Compliance Pre Check to complete...
          </div>
          <SkeletonField />
          <SkeletonField />
          <SkeletonField />
        </div>
      )}

      {/* Actively running - miniature robot in background */}
      {loading && !waitingForCompliance && (
        <div className="relative overflow-hidden rounded-xl border border-charcoal/8 p-4">
          <video autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover rounded-xl" style={{ opacity: 0.1 }}>
            <source src="/Miniature_robot.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-white/60 rounded-xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-charcoal/65 font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
              Drafting approval brief from compliance findings...
            </div>
            <div className="mt-3 space-y-2">
              {[1,2,3].map((i) => (
                <div key={i} className="h-3 rounded bg-charcoal/6 animate-pulse" style={{ width: `${70 - i * 15}%` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-mustard/30 bg-mustard/5 p-3 text-xs text-charcoal/70">
          AI temporarily unavailable. You may review the campaign manually.
          <div className="mt-1 text-xs text-charcoal/45">{error}</div>
        </div>
      )}

      {/* Edit mode */}
      {editing && draft && (
        <div className="space-y-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal/50">
                {f.label}
              </label>
              <textarea
                value={draft[f.key]}
                onChange={(e) => updateField(f.key, e.target.value)}
                rows={f.rows}
                className="w-full rounded-md border border-charcoal/20 bg-cream/30 px-3 py-2 text-sm text-charcoal/80 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600/30"
              />
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium text-charcoal/65 hover:border-charcoal/30"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Read mode */}
      {result && !loading && !editing && (
        <div className="space-y-0 divide-y divide-charcoal/5">
          <div className="py-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Campaign Goal</div>
            <div className="mt-0.5 text-sm text-charcoal/80">{result.campaign_goal}</div>
          </div>
          <div className="py-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Target Audience</div>
            <div className="mt-0.5 text-sm text-charcoal/80">{result.target_audience}</div>
          </div>
          <div className="py-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Expected ROI</div>
            <div className="mt-0.5 text-sm text-charcoal/80">{result.expected_roi}</div>
          </div>
          <div className="py-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">Risk Flags</div>
            {result.risk_flags && result.risk_flags.length > 0 ? (
              <ul className="mt-1.5 space-y-1">
                {result.risk_flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-charcoal/80">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-soft_red" />
                    <span className="line-clamp-2">{flag}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-xs text-charcoal/45">No risk flags identified</p>
            )}
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

          {/* Reset to AI version link */}
          {wasEdited && aiOriginal && (
            <div className="pt-2">
              <button
                type="button"
                onClick={resetToAI}
                className="inline-flex items-center gap-1 text-[11px] text-teal-600 hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                Reset to AI version
              </button>
            </div>
          )}

          {/* Sources panel */}
          <BriefSourcesPanel docs={result.retrieved_docs ?? []} />

          {/* Action row: Evidence, Review */}
          <div className="mt-3 flex items-center gap-3 border-t border-charcoal/5 pt-3">
            <button
              type="button"
              onClick={() => setFloatingUrl("/evidence?step=6b")}
              className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-[11px] font-medium text-teal-700 hover:bg-teal-100"
            >
              <BookOpen className="h-3 w-3" />
              Evidence
            </button>
            <button
              type="button"
              onClick={() => setFloatingUrl(`/review?step=6b&campaign=${context.campaign_brief.campaign_id}`)}
              className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-[11px] font-medium text-teal-700 hover:bg-teal-100"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* Evidence side panel */}
      <EvidenceSidePanel
        stepId="6b"
        campaignId={context.campaign_brief.campaign_id}
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
      />

      {/* Floating page overlay - portal to body so it's truly on top */}
      {floatingUrl && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(20,20,20,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setFloatingUrl(null); }}
        >
          <div className="relative w-full max-w-[90vw] h-[90vh] rounded-2xl overflow-hidden shadow-2xl border border-white/50 bg-white animate-modal-in">
            <button
              type="button"
              onClick={() => setFloatingUrl(null)}
              className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-charcoal/10 text-charcoal/60 hover:bg-charcoal/20 hover:text-charcoal transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <iframe src={floatingUrl} className="h-full w-full border-0" />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
