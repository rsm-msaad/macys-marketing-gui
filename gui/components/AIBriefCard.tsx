"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${s.text}`}>
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
        className="inline-flex items-center gap-1 text-[10px] font-medium text-charcoal/45 hover:text-charcoal/65"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Sources used ({docs.length} docs)
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 pl-4">
          {docs.map((d) => (
            <div key={d} className="flex items-center gap-1.5 text-[10px] text-charcoal/50">
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
}: {
  context: CampaignContext;
  complianceCheck: ComplianceResult | null;
}) {
  const [result, setResult] = useState<BriefResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableBrief | null>(null);
  const [wasEdited, setWasEdited] = useState(false);
  const [aiOriginal, setAiOriginal] = useState<BriefResult | null>(null);

  useEffect(() => {
    if (!complianceCheck) {
      setLoading(true);
      return;
    }

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
          setAiOriginal(r);
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
  }, [context.campaign_brief.campaign_id, complianceCheck]);

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
    <div className="relative rounded-md border border-charcoal/10 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            AI Approval Brief
          </span>
          {result && !loading && <BriefConfidence result={result} />}
          {wasEdited && (
            <span className="text-[10px] italic text-charcoal/45">
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

      {loading && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-charcoal/55">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
            Drafting approval brief from compliance findings...
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

      {/* Edit mode */}
      {editing && draft && (
        <div className="space-y-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">
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

          {/* View Evidence link */}
          <div className="pt-2">
            <Link
              href="/evidence?step=6b"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-600 hover:text-teal-700 hover:underline"
            >
              <BookOpen className="h-3 w-3" />
              View full evidence
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
