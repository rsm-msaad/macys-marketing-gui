"use client";

import { useState } from "react";
import { LayoutGrid, Play, RotateCcw, Sparkles } from "lucide-react";

import { runLayoutCopy, type LayoutPlacement } from "@/lib/api";
import { ApprovalActions, ContextStack, type StepContentProps } from "./shared";

const PLACEMENT_META: Record<string, { label: string; dimensions: string }> = {
  web_banner: { label: "Web Banner", dimensions: "1200x628" },
  email: { label: "Email", dimensions: "600x800" },
  mobile: { label: "Mobile", dimensions: "414x896" },
  in_store_signage: { label: "In-Store Signage", dimensions: "1080x1920" },
};

const PLACEMENT_ORDER = ["web_banner", "email", "mobile", "in_store_signage"];

function PlacementCard({
  name,
  placement,
}: {
  name: string;
  placement: LayoutPlacement;
}) {
  const meta = PLACEMENT_META[name] ?? { label: name, dimensions: "" };
  return (
    <div className="rounded-md border border-charcoal/10 bg-cream/30 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">
          {meta.label}
        </span>
        <span className="text-[10px] text-charcoal/55">{meta.dimensions}</span>
      </div>
      <div className="mt-2 font-serif text-base font-semibold text-charcoal">
        {placement.tagline}
      </div>
      <div className="mt-1 text-[12px] leading-relaxed text-charcoal/70">
        {placement.body}
      </div>
      <div className="mt-2 inline-block rounded-md bg-teal-600 px-3 py-1 text-[11px] font-medium text-white">
        {placement.cta}
      </div>
      <div className="mt-2 border-t border-charcoal/5 pt-2 text-[11px] italic text-charcoal/55">
        {placement.visual_direction}
      </div>
    </div>
  );
}

export function LayoutAssemblyContent({
  context,
  canAct,
  busy,
  onApprove,
  onRequestRevisions,
}: StepContentProps) {
  // Check if layouts were already locked in.
  const existingOutput = context.state.step_outputs["5"] as
    | Record<string, unknown>
    | undefined;
  const hasLockedIn =
    existingOutput && Array.isArray(existingOutput.approved_layouts);

  // Read upstream: segment from Step 2, SKUs from Step 3, assets from Step 4
  const segmentOutput = context.state.step_outputs["2"] as Record<string, unknown> | undefined;
  const skuOutput = context.state.step_outputs["3"] as Record<string, unknown> | undefined;
  const assetOutput = context.state.step_outputs["4"] as Record<string, unknown> | undefined;
  const segmentName = segmentOutput?.name as string | undefined;
  const approvedSkuCount = (skuOutput?.approved_skus as string[] | undefined)?.length ?? 0;
  const approvedAssetCount = (assetOutput?.approved_asset_count as number | undefined) ?? 0;
  const upstreamCategory = (skuOutput?.segment_top_category as string | undefined) ?? null;

  const category = (() => {
    if (upstreamCategory) return upstreamCategory;
    const text = `${context.campaign_brief.name} ${context.campaign_brief.objective}`.toLowerCase();
    if (text.includes("beauty")) return "Beauty";
    if (text.includes("apparel")) return "Apparel";
    if (text.includes("home")) return "Home";
    return "Beauty";
  })();

  const [placements, setPlacements] = useState<Record<string, LayoutPlacement> | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRerun, setShowRerun] = useState(false);

  async function handleGenerate() {
    setRunning(true);
    setError(null);
    setPlacements(null);
    try {
      const brief = context.campaign_brief;
      const result = await runLayoutCopy({
        name: brief.name,
        objective: brief.objective,
        target_customer: brief.target_customer,
        promotional_offer: brief.promotional_offer,
        category,
      });
      setPlacements(result.placements);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  // If already locked in and not re-running, show summary.
  if (hasLockedIn && !showRerun && placements === null) {
    const layouts = existingOutput.approved_layouts as string[];
    return (
      <div className="space-y-3">
        <ContextStack context={context} />
        <div className="rounded-md border border-sage/30 bg-sage/5 p-4">
          <div className="flex items-start gap-2">
            <LayoutGrid className="mt-0.5 h-4 w-4 text-sage" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sage">
                Layouts locked in
              </div>
              <div className="font-serif text-base font-semibold text-charcoal">
                {layouts.length} placements approved
              </div>
            </div>
          </div>
          {canAct && (
            <button
              type="button"
              onClick={() => setShowRerun(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium text-charcoal/65 hover:border-charcoal/30 hover:text-charcoal"
            >
              <RotateCcw className="h-3 w-3" />
              Regenerate layout copy
            </button>
          )}
        </div>
      </div>
    );
  }

  const showingResults = placements !== null;

  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      {/* Upstream context: reading from Steps 2-4 */}
      {(segmentName || approvedSkuCount > 0 || approvedAssetCount > 0) && (
        <div className="rounded-md border border-blue-200/50 bg-blue-50/30 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
            Reading from Steps 2-4
          </div>
          <div className="mt-0.5 text-[11px] text-charcoal/65">
            {segmentName && <>Segment: <strong>{segmentName}</strong> · </>}
            {approvedSkuCount > 0 && <><strong>{approvedSkuCount} SKUs</strong> · </>}
            {approvedAssetCount > 0 && <><strong>{approvedAssetCount} assets</strong> · </>}
            Category: <strong>{category}</strong> — copy generation grounded in upstream selections.
          </div>
        </div>
      )}

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Skill · Layout Copy Generator (LLM, pre-fetch)
          </span>
        </div>
        <p className="text-sm text-charcoal/70">
          Uses Claude to draft copy for 4 placements. Pre-fetches RAG context, single LLM call. No tool calling.
        </p>

        {/* Generate button */}
        {!showingResults && !running && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canAct}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            Generate Layout Copy
          </button>
        )}

        {/* Running */}
        {running && (
          <div className="mt-3 flex items-center gap-2 text-sm text-charcoal/60">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            Generating copy for 4 placements...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-md border border-soft_red/30 bg-soft_red/5 px-3 py-2 text-xs text-soft_red">
            {error}
            <button type="button" onClick={handleGenerate} className="ml-2 underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {/* Placement cards */}
        {showingResults && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {PLACEMENT_ORDER.map((name) => {
              const p = placements[name];
              if (!p) return null;
              return <PlacementCard key={name} name={name} placement={p} />;
            })}
          </div>
        )}

        {/* Regenerate button (after results shown) */}
        {showingResults && canAct && (
          <button
            type="button"
            onClick={handleGenerate}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium text-charcoal/65 hover:border-charcoal/30 hover:text-charcoal"
          >
            <RotateCcw className="h-3 w-3" />
            Regenerate copy
          </button>
        )}
      </div>

      {/* Approval footer */}
      {showingResults && (
        <ApprovalActions
          canAct={canAct}
          busy={busy}
          primaryLabel="Approve layouts"
          secondaryLabel="Request Layout Changes"
          stepNumber={5}
          onPrimary={() =>
            onApprove("Approve Layout", {
              approved_layouts: PLACEMENT_ORDER.filter((n) => n in placements),
              placements,
              segment_used: segmentName ?? null,
              sku_count: approvedSkuCount,
              asset_count: approvedAssetCount,
              category,
            })
          }
          onRequestRevisions={() => onRequestRevisions(5, 4)}
        />
      )}
    </div>
  );
}
