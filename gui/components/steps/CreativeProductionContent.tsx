"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Image as ImageIcon,
  Play,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";

import { API_BASE, runDam, runFindDamAssets, type DamAsset, type DamStats, type FindDamAssetsResult } from "@/lib/api";
import { ActionFooter, ContextStack, type StepContentProps } from "./shared";

function DamAssetCard({
  asset,
  included,
  onToggle,
}: {
  asset: DamAsset;
  included: boolean;
  onToggle: () => void;
}) {
  const imgUrl = `${API_BASE}/images/dam/${asset.filename}`;

  return (
    <div
      className={`overflow-hidden rounded-lg border transition-all ${
        included
          ? "border-teal-600/30 bg-white"
          : "border-charcoal/10 bg-charcoal/5 opacity-60"
      }`}
    >
      <div className="relative aspect-video bg-cream">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgUrl}
          alt={asset.filename}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageIcon className="h-6 w-6 text-charcoal/15" />
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-medium text-charcoal/80">
              {asset.filename}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-charcoal/55">
              <span className="capitalize">{asset.asset_type}</span>
              <span>{asset.resolution}</span>
              <span className="font-semibold text-teal-700">
                {(asset.relevance_score * 100).toFixed(0)}% match
              </span>
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
        {asset.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {asset.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded bg-charcoal/5 px-1.5 py-0.5 text-[9px] text-charcoal/50"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CreativeProductionContent({
  context,
  canAct,
  busy,
  onApprove,
}: StepContentProps) {
  // Check if assets were already locked in from a prior run.
  const existingOutput = context.state.step_outputs["4"] as
    | Record<string, unknown>
    | undefined;
  const hasLockedIn =
    existingOutput &&
    (Array.isArray(existingOutput.approved_assets) ||
      typeof existingOutput.approved_asset_count === "number");

  // Read upstream: SKUs from Step 3
  const skuOutput = context.state.step_outputs["3"] as Record<string, unknown> | undefined;
  const approvedSkus = (skuOutput?.approved_skus as string[] | undefined) ?? [];
  const segmentCategory = (skuOutput?.segment_top_category as string | undefined) ?? null;

  // Derive category from upstream or brief
  const category = (() => {
    if (segmentCategory) return segmentCategory;
    const text = `${context.campaign_brief.name} ${context.campaign_brief.objective}`.toLowerCase();
    if (text.includes("beauty")) return "Beauty";
    if (text.includes("apparel")) return "Apparel";
    if (text.includes("home")) return "Home";
    return "Beauty";
  })();

  const [assets, setAssets] = useState<DamAsset[] | null>(null);
  const [stats, setStats] = useState<DamStats | null>(null);
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [running, setRunning] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRerun, setShowRerun] = useState(false);
  const [batchCount, setBatchCount] = useState(0);
  const [mcpResult, setMcpResult] = useState<FindDamAssetsResult | null>(null);

  async function handleSearch() {
    setRunning(true);
    setError(null);
    setAssets(null);
    setStats(null);
    setMcpResult(null);
    setBatchCount(1);
    try {
      // Deterministic DAM search with category boost
      let brief = context.campaign_brief.objective || context.campaign_brief.name;
      if (approvedSkus.length > 0) {
        brief += ` (${approvedSkus.length} SKUs selected in Step 3)`;
      }
      const result = await runDam(brief, 12, category);
      setAssets(result.results);
      setStats(result.stats);
      setIncluded(new Set(result.results.map((a) => a.asset_id)));

      // MCP helper: find_dam_assets for rights-verified lookup
      try {
        const mcp = await runFindDamAssets(category, "NY", 5);
        setMcpResult(mcp);
      } catch {
        // MCP helper is supplementary; don't block on failure
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function handleFindMore() {
    setLoadingMore(true);
    try {
      const brief = context.campaign_brief.objective || context.campaign_brief.name;
      const nextBatch = batchCount + 1;
      const result = await runDam(brief, 12 * nextBatch, category);
      // Keep only the new assets that are not already in the list
      const existingIds = new Set((assets ?? []).map((a) => a.asset_id));
      const newAssets = result.results.filter((a) => !existingIds.has(a.asset_id));
      if (newAssets.length > 0) {
        setAssets((prev) => [...(prev ?? []), ...newAssets]);
        // Auto-select the new ones
        setIncluded((prev) => {
          const next = new Set(prev);
          for (const a of newAssets) next.add(a.asset_id);
          return next;
        });
      }
      setStats(result.stats);
      setBatchCount(nextBatch);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  function toggleAsset(id: number) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // If already locked in and not re-running, show the summary.
  if (hasLockedIn && !showRerun && assets === null) {
    const count =
      (existingOutput.approved_asset_count as number) ??
      (existingOutput.approved_assets as unknown[])?.length ??
      0;
    return (
      <div className="space-y-3">
        <ContextStack context={context} />
        <div className="rounded-md border border-sage/30 bg-sage/5 p-4">
          <div className="flex items-start gap-2">
            <ImageIcon className="mt-0.5 h-4 w-4 text-sage" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sage">
                Assets locked in
              </div>
              <div className="font-serif text-base font-semibold text-charcoal">
                {count} DAM assets selected
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
              Re-run DAM Asset Finder
            </button>
          )}
        </div>
      </div>
    );
  }

  const includedCount = included.size;
  const showingResults = assets !== null && assets.length > 0;

  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      {/* Upstream context: reading from Step 3 SKU Selection */}
      {approvedSkus.length > 0 && (
        <div className="rounded-md border border-blue-200/50 bg-blue-50/30 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
            Reading from Step 3: SKU Selection
          </div>
          <div className="mt-0.5 text-[11px] text-charcoal/65">
            <strong>{approvedSkus.length} SKUs</strong> locked in — asset search tuned to <strong>{category}</strong> category.
          </div>
        </div>
      )}

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <ShoppingBag className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Automation · DAM Asset Finder
          </span>
        </div>
        <p className="text-sm text-charcoal/70">
          Filters 5,000 DAM assets by category, tags, and quality. Deterministic ranking with category boost.
          Calls <strong>find_dam_assets</strong> helper (exposed via MCP) for rights validation.
        </p>

        {/* Run button */}
        {!showingResults && !running && (
          <button
            type="button"
            onClick={handleSearch}
            disabled={!canAct}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            Run DAM Asset Finder
          </button>
        )}

        {/* Running */}
        {running && (
          <div className="mt-3 flex items-center gap-2 text-sm text-charcoal/60">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            Searching DAM...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-md border border-soft_red/30 bg-soft_red/5 px-3 py-2 text-xs text-soft_red">
            {error}
            <button type="button" onClick={handleSearch} className="ml-2 underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {/* Results grid */}
        {showingResults && (
          <>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-charcoal/55">
                {includedCount} of {assets.length} selected
              </span>
              <button
                type="button"
                onClick={() =>
                  setIncluded(
                    includedCount === assets.length
                      ? new Set()
                      : new Set(assets.map((a) => a.asset_id)),
                  )
                }
                className="text-[11px] font-medium text-teal-600 hover:text-teal-700"
              >
                {includedCount === assets.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {assets.map((asset) => (
                <DamAssetCard
                  key={asset.asset_id}
                  asset={asset}
                  included={included.has(asset.asset_id)}
                  onToggle={() => toggleAsset(asset.asset_id)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleFindMore}
              disabled={loadingMore}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium text-charcoal/65 hover:border-charcoal/30 hover:text-charcoal disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                  Loading...
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  Find More Assets
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Filter stats */}
      {stats && (
        <div className="rounded-md border border-charcoal/10 bg-cream/30 p-3">
          <div className="flex flex-wrap gap-4 text-[11px] text-charcoal/55">
            <span>Searched: {stats.total_searched.toLocaleString()}</span>
            <span>Filtered out: {stats.filtered_total} (degraded {stats.filtered_out.degraded}, expired {stats.filtered_out.expired_rights}, low res {stats.filtered_out.low_resolution})</span>
            <span>Kept: {stats.kept}</span>
            <span>Avg relevance: {(stats.avg_relevance * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* DAM helper: find_dam_assets (deterministic, exposed via MCP) */}
      {mcpResult && (
        <div className={`rounded-md border p-3 ${
          mcpResult.status === "pass"
            ? "border-green-300/40 bg-green-50/30"
            : "border-amber-300/40 bg-amber-50/30"
        }`}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-green-700">
            DAM helper: find_dam_assets — {mcpResult.result_count} rights-verified assets
          </div>
          <div className="text-[11px] text-charcoal/65">
            Queried DAM for <strong>{mcpResult.input.category}</strong> assets in region <strong>{mcpResult.input.region}</strong> with active model releases.
          </div>
          {mcpResult.assets.length > 0 && (
            <div className="mt-1 text-[10px] text-charcoal/50">
              {mcpResult.assets.map((a) => a.filename).join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Approval footer */}
      {showingResults && includedCount > 0 && (
        <ActionFooter
          canAct={canAct}
          busy={busy}
          cta={`Lock in ${includedCount} assets`}
          ctaKind="approve"
          stepNumber={4}
          onClick={() =>
            onApprove("Approve Assets", {
              approved_assets: assets
                .filter((a) => included.has(a.asset_id))
                .map((a) => a.asset_id),
              approved_asset_count: includedCount,
              skus_from_step3: approvedSkus,
              category,
              mcp_find_dam_assets: mcpResult ? {
                mcp_tool: mcpResult.mcp_tool,
                status: mcpResult.status,
                result_count: mcpResult.result_count,
                input: mcpResult.input,
              } : null,
            })
          }
        />
      )}
    </div>
  );
}
