"use client";

import { useState } from "react";
import { Clock, MessageSquare, Play, Search, Sparkles, Users, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

import { runSegment, type Segment, type CampaignBrief } from "@/lib/api";
import { ActionFooter, ContextStack, StepVideoBackground, type StepContentProps } from "./shared";

/**
 * Pick the segment whose top_category best matches the campaign brief.
 * Falls back to highest overall lift, then highest monetary value.
 */
function pickRecommendedIndex(segments: Segment[], brief: CampaignBrief): number {
  if (segments.length === 0) return 0;
  const text = `${brief.name} ${brief.objective}`.toLowerCase();

  // Find segments whose top_category appears in the campaign text.
  const matches: { idx: number; lift: number; monetary: number }[] = [];
  for (let i = 0; i < segments.length; i++) {
    const cat = segments[i].top_category;
    if (cat && text.includes(cat.toLowerCase())) {
      matches.push({ idx: i, lift: segments[i].top_category_lift, monetary: segments[i].avg_monetary });
    }
  }

  if (matches.length > 0) {
    // Pick the one with the highest lift for the matching category.
    // Tie-break by monetary value.
    matches.sort((a, b) => b.lift - a.lift || b.monetary - a.monetary);
    return matches[0].idx;
  }

  // No category match: fall back to highest overall lift, then monetary.
  let best = 0;
  for (let i = 1; i < segments.length; i++) {
    const curr = segments[i];
    const prev = segments[best];
    if (
      curr.top_category_lift > prev.top_category_lift ||
      (curr.top_category_lift === prev.top_category_lift && curr.avg_monetary > prev.avg_monetary)
    ) {
      best = i;
    }
  }
  return best;
}

const SEGMENT_ICONS = [Users, Clock, Search];

const SEGMENT_COLORS = [
  { border: "border-teal-600/30", bg: "bg-teal-50/40", text: "text-teal-600" },
  {
    border: "border-mustard/30",
    bg: "bg-mustard/10",
    text: "text-mustard",
  },
  {
    border: "border-violet-500/30",
    bg: "bg-violet-50/40",
    text: "text-violet-600",
  },
];

function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function LoyaltyBar({ mix }: { mix: Record<string, number> }) {
  const tiers = Object.entries(mix).sort(([, a], [, b]) => b - a);
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-charcoal/55">
      {tiers.slice(0, 3).map(([tier, pct]) => (
        <span key={tier}>
          {tier} {formatPct(pct)}
        </span>
      ))}
    </div>
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
            {segment.name}
          </div>
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

      <p className="mt-2 text-[12px] leading-relaxed text-charcoal/70">
        {segment.definition}
      </p>

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

      {segment.top_category && (
        <div className="mt-1.5 text-xs text-charcoal/55">
          Top category: {segment.top_category} (+{(segment.top_category_lift * 100).toFixed(0)}% lift)
        </div>
      )}

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

  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRerun, setShowRerun] = useState(false);
  const [overrideComment, setOverrideComment] = useState("");

  // Extract category from brief for context display
  const briefCategory = (() => {
    const text = `${context.campaign_brief.name} ${context.campaign_brief.objective}`.toLowerCase();
    if (text.includes("beauty")) return "Beauty";
    if (text.includes("apparel")) return "Apparel";
    if (text.includes("home")) return "Home";
    return null;
  })();

  async function handleBuildSegments() {
    setRunning(true);
    setError(null);
    setSegments(null);
    setSelectedIdx(null);
    try {
      const brief = context.campaign_brief.objective || context.campaign_brief.name;
      const result = await runSegment(brief);
      setSegments(result.segments);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  // If already selected and not re-running, show the selection summary.
  if (hasExistingSelection && !showRerun && segments === null) {
    const name = String(existingOutput.name ?? "VIP Loyalists");
    const count = Number(existingOutput.customer_count ?? 0);
    const why = String(
      existingOutput.why ??
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
                Re-run segmentation
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
          Runs k-means clustering on 50,000 customer RFM profiles. Deterministic — same data produces the same 3 segments every time.
        </p>

        {/* Before segments are built */}
        {!segments && !running && (
          <button
            type="button"
            onClick={handleBuildSegments}
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
            Running RFM clustering...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-md border border-soft_red/30 bg-soft_red/5 px-3 py-2 text-xs text-soft_red">
            {error}
            <button
              type="button"
              onClick={handleBuildSegments}
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Segment cards — staggered entrance animation */}
        {segments && segments.length > 0 && (() => {
          const recIdx = pickRecommendedIndex(segments, context.campaign_brief);
          return (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {segments.map((seg, i) => (
                <motion.div
                  key={seg.name}
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

      {/* Override comment when picking a non-recommended segment */}
      {selectedSegment && segments && (() => {
        const recIdx = pickRecommendedIndex(segments, context.campaign_brief);
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
                  You selected <strong>{selectedSegment.name}</strong> instead of the recommended <strong>{segments[recIdx].name}</strong>. Please explain why.
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
              cta={`Approve: ${selectedSegment.name}`}
              ctaKind="approve"
              hint={isOverride && overrideComment.trim().length < 5 ? "Add an override reason to continue" : undefined}
              stepNumber={2}
              onClick={() =>
                onApprove("Approve Segment", {
                  name: selectedSegment.name,
                  definition: selectedSegment.definition,
                  customer_count: selectedSegment.customer_count,
                  avg_recency_days: selectedSegment.avg_recency_days,
                  avg_frequency: selectedSegment.avg_frequency,
                  avg_monetary: selectedSegment.avg_monetary,
                  top_category: selectedSegment.top_category,
                  top_category_lift: selectedSegment.top_category_lift,
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
