"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCcw,
  ShoppingBag,
  ShieldAlert,
} from "lucide-react";

import {
  runSkuRecommend,
  runCheckPricing,
  type RecommendedSku,
  type ExcludedSku,
  type CheckPricingResult,
} from "@/lib/api";
import { ApprovalActions, ContextStack, type StepContentProps } from "./shared";

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  in_stock: { bg: "#dcfce7", text: "#15803d" },
  low_stock: { bg: "#fef9c3", text: "#854d0e" },
  out_of_stock: { bg: "#fee2e2", text: "#991b1b" },
};

function inventoryLabel(level: number): string {
  if (level >= 1000) return "in_stock";
  if (level >= 300) return "low_stock";
  return "out_of_stock";
}

function SkuCard({
  sku,
  discountPct,
  included,
  onToggle,
}: {
  sku: RecommendedSku;
  discountPct: number;
  included: boolean;
  onToggle: () => void;
}) {
  const invLabel = inventoryLabel(sku.inventory_level);
  const badge = STATUS_BADGE[invLabel];
  const discounted = sku.msrp * (1 - discountPct / 100);

  return (
    <div
      className={`rounded-lg border p-3 transition-all ${
        included
          ? "border-teal-600/30 bg-white"
          : "border-charcoal/10 bg-charcoal/5 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/45">
            {sku.brand}
          </div>
          <div className="font-serif text-sm font-semibold leading-tight text-charcoal">
            {sku.name}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
            included
              ? "border-teal-600 bg-teal-600 text-white"
              : "border-charcoal/25 bg-white text-transparent hover:border-charcoal/40"
          }`}
        >
          {included && <CheckCircle2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px]">
        <span className="font-semibold text-charcoal">${discounted.toFixed(0)}</span>
        <span className="text-charcoal/40 line-through">${sku.msrp.toFixed(0)}</span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
          style={{ backgroundColor: badge.bg, color: badge.text }}
        >
          {sku.inventory_level.toLocaleString()} units
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-charcoal/55">
        <span>Margin {(sku.margin_pct * 100).toFixed(0)}%</span>
        <span>Score {sku.score_pct.toFixed(0)}</span>
      </div>

      <div className="mt-1.5 text-[10px] italic text-teal-700">
        {sku.top_reason}
      </div>

      {sku.map_protected && (
        <div className="mt-1 flex items-center gap-1 text-[9px] text-amber-600">
          <ShieldAlert className="h-3 w-3" />
          MAP protected
        </div>
      )}
    </div>
  );
}

export function SKUSelectionContent({
  context,
  canAct,
  busy,
  onApprove,
  onRequestRevisions,
}: StepContentProps) {
  // Check if SKUs were already locked in from a prior run.
  const existingOutput = context.state.step_outputs["3"] as
    | Record<string, unknown>
    | undefined;
  const hasLockedIn = existingOutput && Array.isArray(existingOutput.approved_skus);

  // Read upstream: segment from Step 2
  const segmentOutput = context.state.step_outputs["2"] as
    | Record<string, unknown>
    | undefined;
  const segmentName = segmentOutput?.name as string | undefined;
  const segmentTopCategory = segmentOutput?.top_category as string | undefined;
  const segmentCustomerCount = segmentOutput?.customer_count as number | undefined;

  const [recommended, setRecommended] = useState<RecommendedSku[] | null>(null);
  const [excluded, setExcluded] = useState<ExcludedSku[]>([]);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRerun, setShowRerun] = useState(false);
  const [pricingCheck, setPricingCheck] = useState<CheckPricingResult | null>(null);
  const [pricingRunning, setPricingRunning] = useState(false);

  // Derive category from upstream segment or brief
  const category = (() => {
    if (segmentTopCategory) return segmentTopCategory;
    const text = `${context.campaign_brief.name} ${context.campaign_brief.objective}`.toLowerCase();
    if (text.includes("beauty")) return "Beauty";
    if (text.includes("apparel")) return "Apparel";
    if (text.includes("home")) return "Home";
    return "Beauty";
  })();

  async function handleRecommend() {
    setRunning(true);
    setError(null);
    setRecommended(null);
    setExcluded([]);
    setPricingCheck(null);
    try {
      const brief = context.campaign_brief;
      const nameLC = (brief.name + " " + brief.objective).toLowerCase();
      let season = "";
      if (nameLC.includes("mother")) season = "mothers-day";
      else if (nameLC.includes("spring")) season = "spring";
      else if (nameLC.includes("summer")) season = "summer";
      else if (nameLC.includes("holiday")) season = "holiday";

      const result = await runSkuRecommend(category, 25, "Q2 2026", season, 18, segmentTopCategory ?? undefined);
      setRecommended(result.recommended_skus);
      setExcluded(result.excluded_skus);
      setIncluded(new Set(result.recommended_skus.map((s) => s.sku_id)));

      // Auto-fire MCP tool: check_pricing_conflicts on all recommended SKUs
      setPricingRunning(true);
      try {
        const skuIds = result.recommended_skus.map((s) => s.sku_id);
        const pricing = await runCheckPricing(skuIds, 25);
        setPricingCheck(pricing);
      } finally {
        setPricingRunning(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function toggleSku(skuId: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(skuId)) next.delete(skuId);
      else next.add(skuId);
      return next;
    });
  }

  // If already locked in and not re-running, show the locked summary.
  if (hasLockedIn && !showRerun && recommended === null) {
    const ids = existingOutput.approved_skus as string[];
    return (
      <div className="space-y-3">
        <ContextStack context={context} />
        <div className="rounded-md border border-sage/30 bg-sage/5 p-4">
          <div className="flex items-start gap-2">
            <ShoppingBag className="mt-0.5 h-4 w-4 text-sage" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sage">
                SKUs locked in
              </div>
              <div className="font-serif text-base font-semibold text-charcoal">
                {ids.length} SKUs selected via SKU Recommender
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
              Re-run SKU Recommender
            </button>
          )}
        </div>
      </div>
    );
  }

  const includedCount = included.size;
  const showingRecommended = recommended !== null && recommended.length > 0;

  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      {/* Upstream context: reading from Step 2 Segmentation */}
      {segmentName && (
        <div className="rounded-md border border-blue-200/50 bg-blue-50/30 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
            Reading from Step 2: Segmentation
          </div>
          <div className="mt-0.5 text-[11px] text-charcoal/65">
            Segment: <strong>{segmentName}</strong>
            {segmentCustomerCount != null && <> ({segmentCustomerCount.toLocaleString()} customers)</>}
            {segmentTopCategory && <> — top category: <strong>{segmentTopCategory}</strong>, biasing SKU selection</>}
          </div>
        </div>
      )}

      {/* Automation panel */}
      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <ShoppingBag className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Automation: SKU Recommender
          </span>
        </div>
        <p className="text-sm text-charcoal/70">
          Scores 61 catalog SKUs by inventory, margin, vendor commitment, and seasonality.
          Excludes SKUs that would violate MAP at the campaign discount. Category: <strong>{category}</strong>.
        </p>

        {/* Run button */}
        {!showingRecommended && !running && (
          <button
            type="button"
            onClick={handleRecommend}
            disabled={!canAct}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            Recommend SKUs
          </button>
        )}

        {/* Running spinner */}
        {running && (
          <div className="mt-3 flex items-center gap-2 text-sm text-charcoal/60">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            Scoring catalog...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-md border border-soft_red/30 bg-soft_red/5 px-3 py-2 text-xs text-soft_red">
            {error}
            <button type="button" onClick={handleRecommend} className="ml-2 underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {/* Recommended SKU grid */}
        {showingRecommended && (
          <>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-charcoal/55">
                {includedCount} of {recommended.length} selected
              </span>
              <button
                type="button"
                onClick={() =>
                  setIncluded(
                    includedCount === recommended.length
                      ? new Set()
                      : new Set(recommended.map((s) => s.sku_id)),
                  )
                }
                className="text-[11px] font-medium text-teal-600 hover:text-teal-700"
              >
                {includedCount === recommended.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recommended.map((sku) => (
                <SkuCard
                  key={sku.sku_id}
                  sku={sku}
                  discountPct={25}
                  included={included.has(sku.sku_id)}
                  onToggle={() => toggleSku(sku.sku_id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* MAP exclusions panel */}
      {excluded.length > 0 && (
        <div className="rounded-md border border-amber-300/40 bg-amber-50/30 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            Excluded due to MAP ({excluded.length})
          </div>
          <ul className="space-y-0.5 text-[11px] text-charcoal/65">
            {excluded.map((s) => (
              <li key={s.sku_id}>
                <span className="font-medium text-charcoal/80">{s.brand} {s.name}</span>{" "}
                <span className="text-charcoal/45">{s.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* MCP Tool: check_pricing_conflicts results */}
      {pricingRunning && (
        <div className="flex items-center gap-2 rounded-md border border-charcoal/10 bg-white px-3 py-2 text-sm text-charcoal/60">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          Running MCP tool: check_pricing_conflicts...
        </div>
      )}
      {pricingCheck && (
        <div className={`rounded-md border p-3 ${
          pricingCheck.status === "pass"
            ? "border-green-300/40 bg-green-50/30"
            : pricingCheck.status === "warn"
              ? "border-amber-300/40 bg-amber-50/30"
              : "border-red-300/40 bg-red-50/30"
        }`}>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
            <ShieldAlert className="h-3 w-3" />
            <span className={
              pricingCheck.status === "pass" ? "text-green-700" :
              pricingCheck.status === "warn" ? "text-amber-700" : "text-red-700"
            }>
              MCP Tool: check_pricing_conflicts — {pricingCheck.status.toUpperCase()}
            </span>
          </div>
          <div className="text-[11px] text-charcoal/65">
            Checked {pricingCheck.checked_count} SKUs at {pricingCheck.input.proposed_discount_pct}% discount against PRICE-RULES-2026-001.
          </div>
          {pricingCheck.conflicts.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-[11px]">
              {pricingCheck.conflicts.map((c) => (
                <li key={c.sku_id} className={c.severity === "fail" ? "text-red-700" : "text-amber-700"}>
                  <span className="font-medium">[{c.severity.toUpperCase()}]</span> {c.sku_id}{c.brand ? ` (${c.brand})` : ""}: {c.issue}
                </li>
              ))}
            </ul>
          )}
          {pricingCheck.status === "pass" && (
            <div className="mt-1 text-[11px] text-green-700">No pricing conflicts detected.</div>
          )}
        </div>
      )}

      {/* Approval footer — block if pricing check has hard failures on included SKUs */}
      {showingRecommended && includedCount > 0 && (() => {
        const failedSkuIds = new Set(
          (pricingCheck?.conflicts ?? [])
            .filter((c) => c.severity === "fail")
            .map((c) => c.sku_id)
        );
        const includedFailures = [...included].filter((id) => failedSkuIds.has(id));
        const hasBlockingFailures = includedFailures.length > 0;

        return (
          <>
            {hasBlockingFailures && (
              <div className="rounded-md border border-red-300/40 bg-red-50/30 px-3 py-2 text-[11px] text-red-700">
                <strong>{includedFailures.length} selected SKU(s)</strong> have pricing rule violations.
                Deselect them or request different SKUs to proceed.
              </div>
            )}
            <ApprovalActions
              canAct={canAct && !hasBlockingFailures}
              busy={busy}
              primaryLabel={`Lock in ${includedCount} SKUs`}
              secondaryLabel="Request Different SKUs"
              stepNumber={3}
              onPrimary={() =>
                onApprove("Approve SKU List", {
                  approved_skus: recommended
                    .filter((s) => included.has(s.sku_id))
                    .map((s) => s.sku_id),
                  total_recommended: recommended.length,
                  excluded_count: excluded.length,
                  segment_used: segmentName ?? null,
                  segment_top_category: segmentTopCategory ?? null,
                  pricing_check: pricingCheck ? {
                    mcp_tool: pricingCheck.mcp_tool,
                    status: pricingCheck.status,
                    conflicts: pricingCheck.conflicts,
                    checked_count: pricingCheck.checked_count,
                  } : null,
                })
              }
              onRequestRevisions={() => onRequestRevisions(3, 2)}
            />
          </>
        );
      })()}
    </div>
  );
}
