"use client";

import { useState } from "react";
import { Clock, Info, MessageSquare, Play, Search, Sparkles, Users, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

import { runSegment, updateCampaign, type Segment, type SegmentResult, type CampaignBrief } from "@/lib/api";
import { ActionFooter, ContextStack, StepVideoBackground, type StepContentProps } from "./shared";

const CLUSTER_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const;

const SEGMENT_ICONS = [Users, Clock, Search, Sparkles, Users, Clock, Search, Sparkles];

const SEGMENT_COLORS = [
  { border: "border-teal-600/30", bg: "bg-teal-50/40", text: "text-teal-600" },
  { border: "border-mustard/30", bg: "bg-mustard/10", text: "text-mustard" },
  { border: "border-violet-500/30", bg: "bg-violet-50/40", text: "text-violet-600" },
  { border: "border-blue-500/30", bg: "bg-blue-50/40", text: "text-blue-600" },
  { border: "border-rose-500/30", bg: "bg-rose-50/40", text: "text-rose-600" },
  { border: "border-emerald-500/30", bg: "bg-emerald-50/40", text: "text-emerald-600" },
  { border: "border-orange-500/30", bg: "bg-orange-50/40", text: "text-orange-600" },
  { border: "border-cyan-500/30", bg: "bg-cyan-50/40", text: "text-cyan-600" },
];

function formatPct(n: number | undefined | null): string {
  const v = typeof n === "number" && !Number.isNaN(n) ? n : 0;
  return `${(v * 100).toFixed(0)}%`;
}

function formatDollars(n: number | undefined | null): string {
  const v = typeof n === "number" && !Number.isNaN(n) ? n : 0;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function LoyaltyBar({ mix }: { mix: Record<string, number> | undefined | null }) {
  if (!mix || typeof mix !== "object") return null;
  const tiers = Object.entries(mix).sort(([, a], [, b]) => b - a);
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-charcoal/55">
      {tiers.slice(0, 3).map(([tier, pct]) => (
        <span key={tier}>
          {tier} {typeof pct === "number" ? `${pct.toFixed(0)}%` : "0%"}
        </span>
      ))}
    </div>
  );
}

function ValueTooltip({ formula }: { formula: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-1 inline-flex items-center text-charcoal/40 hover:text-charcoal/70"
        title="How this value was estimated"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <span className="absolute bottom-full left-0 z-10 mb-1 w-56 rounded border border-charcoal/15 bg-white p-2 text-[10px] leading-snug text-charcoal/70 shadow-md">
          {formula}
        </span>
      )}
    </span>
  );
}

function SegmentCard({
  segment,
  index,
  selected,
  muted,
  recommended,
  onSelect,
}: {
  segment: Segment;
  index: number;
  selected: boolean;
  muted: boolean;
  recommended?: boolean;
  onSelect: () => void;
}) {
  const Icon = SEGMENT_ICONS[index % SEGMENT_ICONS.length];
  const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
  const title = segment.display_name || segment.name;

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        selected
          ? `${color.border} ${color.bg} ring-2 ring-teal-600/40`
          : muted
            ? "border-charcoal/10 bg-charcoal/5 opacity-60"
            : `border-charcoal/10 bg-cream/30 hover:${color.border}`
      }`}
    >
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${selected ? color.text : "text-charcoal/45"}`} />
        <div className="min-w-0 flex-1">
          <div className="font-serif text-base font-semibold text-charcoal">
            {title}
          </div>
          {segment.descriptor && (
            <div className="mt-0.5 text-[11px] italic text-charcoal/55">
              {segment.descriptor}
            </div>
          )}
          <div className="mt-0.5 text-[12px] text-charcoal/55">
            {segment.customer_count.toLocaleString()} customers
          </div>
        </div>
        {selected && (
          <span className="flex-shrink-0 rounded-full bg-teal-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
            Selected
          </span>
        )}
        {recommended && !selected && (
          <span className="flex-shrink-0 rounded-full bg-mustard/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-mustard">
            Recommended
          </span>
        )}
      </div>

      {/* RFM profile */}
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded border border-charcoal/10 bg-white px-1.5 py-1">
          <div className="text-[11px] font-semibold text-charcoal">
            {segment.avg_recency_days}d
          </div>
          <div className="text-xs text-charcoal/50">Recency</div>
        </div>
        <div className="rounded border border-charcoal/10 bg-white px-1.5 py-1">
          <div className="text-[11px] font-semibold text-charcoal">
            {segment.avg_frequency.toFixed(1)}x
          </div>
          <div className="text-xs text-charcoal/50">Frequency</div>
        </div>
        <div className="rounded border border-charcoal/10 bg-white px-1.5 py-1">
          <div className="text-[11px] font-semibold text-charcoal">
            ${segment.avg_monetary.toFixed(0)}
          </div>
          <div className="text-xs text-charcoal/50">Monetary</div>
        </div>
      </div>

      {/* Top category */}
      {segment.top_category && (
        <div className="mt-1.5 text-xs text-charcoal/55">
          Top category: {segment.top_category} (+{(segment.top_category_lift * 100).toFixed(0)}% lift)
        </div>
      )}

      {/* Response likelihood and estimated value */}
      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="rounded border border-charcoal/10 bg-white px-1.5 py-1">
          <div className="text-[11px] font-semibold text-charcoal">
            {formatPct(segment.response_likelihood)}
          </div>
          <div className="text-xs text-charcoal/50">Response rate</div>
        </div>
        <div className="rounded border border-charcoal/10 bg-white px-1.5 py-1">
          <div className="text-[11px] font-semibold text-charcoal">
            {formatDollars(segment.estimated_value)}
            <ValueTooltip formula={segment.value_formula} />
          </div>
          <div className="text-xs text-charcoal/50">Est. value</div>
        </div>
      </div>

      <LoyaltyBar mix={segment.loyalty_mix} />

      {!selected && !muted && (
        <button
          type="button"
          onClick={onSelect}
          className="mt-3 w-full rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700"
        >
          Select this segment
        </button>
      )}
    </div>
  );
}

export function SegmentationContent({
  context,
  canAct,
  busy,
  onApprove,
}: StepContentProps) {
  // Check if a segment was already selected (pre-seeded or from a prior run).
  const existingOutput = context.state.step_outputs["2"] as
    | Record<string, unknown>
    | undefined;
  const hasExistingSelection = existingOutput && "name" in existingOutput;

  const [segmentResult, setSegmentResult] = useState<SegmentResult | null>(null);
  const segments = segmentResult?.segments ?? null;
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRerun, setShowRerun] = useState(false);
  const [overrideComment, setOverrideComment] = useState("");
  const [nClusters, setNClusters] = useState(3);
  const [briefApplied, setBriefApplied] = useState(false);

  // Extract category from brief for context display
  const briefCategory = (() => {
    const text = `${context.campaign_brief.name} ${context.campaign_brief.objective}`.toLowerCase();
    if (text.includes("beauty")) return "Beauty";
    if (text.includes("apparel")) return "Apparel";
    if (text.includes("home")) return "Home";
    return null;
  })();

  async function handleBuildSegments(clusters?: number) {
    const k = clusters ?? nClusters;
    setRunning(true);
    setError(null);
    setSegmentResult(null);
    setSelectedIdx(null);
    setBriefApplied(false);
    try {
      const brief = context.campaign_brief.objective || context.campaign_brief.name;
      const result = await runSegment(brief, k, { timeoutMs: 20_000 });
      setSegmentResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function handleClusterChange(k: number) {
    setNClusters(k);
    if (segments) {
      // Segments already shown, recompute with new cluster count
      handleBuildSegments(k);
    }
  }

  async function handleApplyBriefSuggestion() {
    if (!segmentResult?.brief_suggestion) return;
    try {
      await updateCampaign(context.campaign_brief.campaign_id, {
        name: context.campaign_brief.name,
        objective: context.campaign_brief.objective + " " + segmentResult.brief_suggestion,
      });
      setBriefApplied(true);
    } catch {
      // Silent, user can try again
    }
  }

  // Find the recommended index from the backend response
  function getRecommendedIdx(): number {
    if (!segments || segments.length === 0) return 0;
    if (segmentResult?.recommended_segment) {
      const idx = segments.findIndex((s) => s.name === segmentResult.recommended_segment);
      if (idx >= 0) return idx;
    }
    // Fallback: highest estimated_value
    let best = 0;
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].estimated_value > segments[best].estimated_value) {
        best = i;
      }
    }
    return best;
  }

  // If already selected and not re-running, show the selection summary.
  if (hasExistingSelection && !showRerun && segments === null) {
    const name = String(existingOutput.display_name ?? existingOutput.name ?? "VIP Loyalists");
    const count = Number(existingOutput.customer_count ?? 0);
    const why = String(
      existingOutput.why ??
        existingOutput.descriptor ??
        existingOutput.definition ??
        "Selected by campaign manager.",
    );
    return (
      <StepVideoBackground stepNumber={2}>
        <div className="space-y-3">
          <ContextStack context={context} />

          <div className="rounded-md border border-sage/30 bg-sage/5 p-4">
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 text-sage" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-sage">
                  Selected segment
                </div>
                <div className="font-serif text-base font-semibold text-charcoal">
                  {name}
                  {count > 0 && (
                    <span className="ml-2 text-[12px] font-normal text-charcoal/55">
                      {count.toLocaleString()} customers
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-charcoal/70">
                  {why}
                </p>
                {existingOutput.was_override === true && typeof existingOutput.override_reason === "string" && (
                  <div className="mt-2 rounded border border-mustard/30 bg-mustard/10 px-2.5 py-1.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-mustard">
                      Override reason (recommended: {String(existingOutput.recommended_segment)})
                    </div>
                    <div className="mt-0.5 text-[11px] italic text-charcoal/65">
                      &ldquo;{String(existingOutput.override_reason)}&rdquo;
                    </div>
                  </div>
                )}
              </div>
            </div>
            {canAct && (
              <button
                type="button"
                onClick={() => setShowRerun(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium text-charcoal/65 hover:border-charcoal/30 hover:text-charcoal"
              >
                <RotateCcw className="h-3 w-3" />
                Re run segmentation
              </button>
            )}
          </div>
        </div>
      </StepVideoBackground>
    );
  }

  // Interactive flow: build segments, pick one, approve.
  const selectedSegment = segments && selectedIdx !== null ? segments[selectedIdx] : null;

  return (
    <StepVideoBackground stepNumber={2}>
    <div className="space-y-3">
      <ContextStack context={context} />

      {/* Upstream context: reading from Step 1 brief */}
      {briefCategory && (
        <div className="rounded-md border border-blue-200/50 bg-blue-50/30 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Reading from Step 1: Campaign Brief
          </div>
          <div className="mt-0.5 text-[11px] text-charcoal/65">
            Category: <strong>{briefCategory}</strong> — segmentation will recommend the segment with highest {briefCategory} category lift.
          </div>
        </div>
      )}

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-600">
            Automation · Audience Segment Builder
          </span>
        </div>
        <p className="text-sm text-charcoal/70">
          Runs k means clustering on 50,000 customer RFM profiles. Deterministic: same data produces the same segments every time.
        </p>

        {/* Cluster count selector */}
        <div className="mt-3">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-charcoal/50">
            Number of clusters
          </div>
          <div className="flex gap-1.5">
            {CLUSTER_OPTIONS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleClusterChange(k)}
                disabled={running}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                  nClusters === k
                    ? "bg-teal-600 text-white"
                    : "border border-charcoal/15 bg-white text-charcoal/65 hover:border-charcoal/30 hover:text-charcoal"
                } disabled:opacity-50`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Before segments are built */}
        {!segments && !running && (
          <button
            type="button"
            onClick={() => handleBuildSegments()}
            disabled={!canAct}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            Build Segments
          </button>
        )}

        {/* Running */}
        {running && (
          <div className="mt-3 flex items-center gap-2 text-sm text-charcoal/60">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            Running the segment builder on 50,000 customer profiles...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-md border border-soft_red/30 bg-soft_red/5 px-3 py-2 text-xs text-soft_red">
            {error}
            <button
              type="button"
              onClick={() => handleBuildSegments()}
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Naming source indicator */}
        {segmentResult && (
          <div className="mt-2 flex items-center gap-2">
            {segmentResult.naming_source === "skill" ? (
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-700">
                AI named
              </span>
            ) : (
              <span className="rounded-full bg-charcoal/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal/55">
                Rule based names
              </span>
            )}
          </div>
        )}

        {/* Segment cards */}
        {segments && segments.length > 0 && (() => {
          const recIdx = getRecommendedIdx();
          return (
            <div className={`mt-4 grid gap-3 ${segments.length <= 3 ? "md:grid-cols-3" : segments.length <= 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
              {segments.map((seg, i) => (
                <motion.div
                  key={`${seg.name}-${i}`}
                  initial={{ opacity: 0, y: 40, scale: 0.85, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  transition={{
                    duration: 0.6,
                    delay: 0.15 + i * 0.2,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <SegmentCard
                    segment={seg}
                    index={i}
                    selected={selectedIdx === i}
                    muted={selectedIdx !== null && selectedIdx !== i}
                    recommended={i === recIdx}
                    onSelect={() => setSelectedIdx(i)}
                  />
                </motion.div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Recommendation reason */}
      {segmentResult?.recommendation_reason && segments && segments.length > 0 && (
        <div className="rounded-md border border-teal-200/50 bg-teal-50/30 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-teal-600">
            Recommendation
          </div>
          <div className="mt-0.5 text-[12px] text-charcoal/70">
            {segmentResult.recommendation_reason}
          </div>
        </div>
      )}

      {/* Brief suggestion callout */}
      {segmentResult?.brief_suggestion && !briefApplied && (
        <div className="rounded-md border border-amber-300/50 bg-amber-50/40 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Brief alignment note
          </div>
          <div className="mt-0.5 text-[12px] text-charcoal/70">
            {segmentResult.brief_suggestion}
          </div>
          <button
            type="button"
            onClick={handleApplyBriefSuggestion}
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-100/60 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200/60"
          >
            Apply suggestion
          </button>
        </div>
      )}
      {briefApplied && (
        <div className="rounded-md border border-sage/30 bg-sage/10 px-3 py-2 text-xs text-sage">
          Brief updated successfully. Downstream steps will use the adjusted brief.
        </div>
      )}

      {/* Override comment when picking a non-recommended segment */}
      {selectedSegment && segments && (() => {
        const recIdx = getRecommendedIdx();
        const isOverride = selectedIdx !== recIdx;
        return (
          <>
            {isOverride && (
              <div className="rounded-md border border-mustard/30 bg-mustard/10 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-mustard">
                  <MessageSquare className="h-3 w-3" />
                  Override reason (visible to manager)
                </div>
                <p className="mb-2 text-[11px] text-charcoal/55">
                  You selected <strong>{selectedSegment.display_name || selectedSegment.name}</strong> instead of the recommended <strong>{segments[recIdx].display_name || segments[recIdx].name}</strong>. Please explain why.
                </p>
                <textarea
                  value={overrideComment}
                  onChange={(e) => setOverrideComment(e.target.value)}
                  placeholder="e.g. Lapsed buyers have higher reactivation potential for this campaign window..."
                  rows={2}
                  className="w-full rounded-md border border-charcoal/20 bg-white px-3 py-2 text-[12px] text-charcoal/80 placeholder:text-charcoal/30 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600/30"
                />
              </div>
            )}

            <ActionFooter
              canAct={canAct}
              busy={busy || (isOverride && overrideComment.trim().length < 5)}
              cta={`Approve: ${selectedSegment.display_name || selectedSegment.name}`}
              ctaKind="approve"
              hint={isOverride && overrideComment.trim().length < 5 ? "Add an override reason to continue" : undefined}
              stepNumber={2}
              onClick={() =>
                onApprove("Approve Segment", {
                  name: selectedSegment.name,
                  display_name: selectedSegment.display_name || selectedSegment.name,
                  descriptor: selectedSegment.descriptor || "",
                  definition: selectedSegment.definition,
                  customer_count: selectedSegment.customer_count,
                  avg_recency_days: selectedSegment.avg_recency_days,
                  avg_frequency: selectedSegment.avg_frequency,
                  avg_monetary: selectedSegment.avg_monetary,
                  top_category: selectedSegment.top_category,
                  top_category_lift: selectedSegment.top_category_lift,
                  estimated_value: selectedSegment.estimated_value,
                  response_likelihood: selectedSegment.response_likelihood,
                  override_reason: isOverride ? overrideComment.trim() : null,
                  recommended_segment: segments[recIdx].name,
                  was_override: isOverride,
                })
              }
            />
          </>
        );
      })()}

    </div>
    </StepVideoBackground>
  );
}
