"use client";

import { useState } from "react";
import { Globe, Play, RotateCcw } from "lucide-react";

import { runLocalize, runGenerateLocaleVariants, type Variant, type LocalizeStats, type GenerateLocaleResult } from "@/lib/api";
import { ActionFooter, ContextStack, type StepContentProps } from "./shared";

function VariantCard({ variant }: { variant: Variant }) {
  return (
    <div className="rounded-md border border-charcoal/10 bg-cream/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-charcoal/80">
          {variant.region} / {variant.placement}
        </span>
        <span className="text-[10px] text-charcoal/45">{variant.placement_dimensions}</span>
      </div>
      <div className="mt-1.5 font-serif text-sm font-semibold text-charcoal">
        {variant.copy_headline}
      </div>
      <div className="mt-0.5 text-[12px] text-charcoal/65">{variant.copy_subhead}</div>
      <div className="mt-1.5 flex items-center gap-3 text-[10px]">
        <span className="font-medium text-teal-700">CTA: {variant.cta_text}</span>
        <span className="text-charcoal/45">
          ${variant.regional_price.toFixed(0)}
          {variant.price_difference_pct !== 0 && (
            <span className={variant.price_difference_pct > 0 ? "text-amber-600" : "text-sage"}>
              {" "}({variant.price_difference_pct > 0 ? "+" : ""}{variant.price_difference_pct.toFixed(1)}%)
            </span>
          )}
        </span>
        <span className="text-charcoal/40">{variant.sku_name}</span>
      </div>
    </div>
  );
}

export function LocalizationContent({
  context,
  canAct,
  busy,
  onApprove,
}: StepContentProps) {
  const existingOutput = context.state.step_outputs["7"] as
    | Record<string, unknown>
    | undefined;
  const hasLockedIn =
    existingOutput && typeof existingOutput.variant_count === "number";

  // Read upstream: copy from Step 5, SKUs from Step 3
  const layoutOutput = context.state.step_outputs["5"] as Record<string, unknown> | undefined;
  const skuOutput = context.state.step_outputs["3"] as Record<string, unknown> | undefined;
  const approvedSkus = (skuOutput?.approved_skus as string[] | undefined) ?? [];

  // Extract tagline from layout placements for MCP transcreation
  const layoutCopy = (() => {
    if (!layoutOutput?.placements) return null;
    const p = layoutOutput.placements as Record<string, { tagline?: string; body?: string }>;
    const first = Object.values(p)[0];
    return first?.tagline ?? null;
  })();

  // Derive SKU IDs (numeric) for the localization generator
  // The localization generator expects numeric IDs from the macys.db sku_catalog
  const skuIdsForLocalize = approvedSkus.length > 0
    ? approvedSkus.slice(0, 2).map((_, i) => i + 4) // Map to sample DB IDs
    : [4, 18]; // fallback

  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [stats, setStats] = useState<LocalizeStats | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRerun, setShowRerun] = useState(false);
  const [mcpResults, setMcpResults] = useState<GenerateLocaleResult[]>([]);

  async function handleRun() {
    setRunning(true);
    setError(null);
    setVariants(null);
    setStats(null);
    setMcpResults([]);
    try {
      const brief = context.campaign_brief.objective || context.campaign_brief.name;
      const result = await runLocalize(brief, skuIdsForLocalize);
      setVariants(result.variants);
      setStats(result.stats);

      // Python helper: generate_locale_variants for Spanish and Quebec French
      if (layoutCopy) {
        const mcpCalls = await Promise.allSettled([
          runGenerateLocaleVariants(layoutCopy, "es"),
          runGenerateLocaleVariants(layoutCopy, "fr-CA"),
        ]);
        const results: GenerateLocaleResult[] = [];
        for (const r of mcpCalls) {
          if (r.status === "fulfilled") results.push(r.value);
        }
        setMcpResults(results);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  // If already locked in and not re-running, show summary.
  if (hasLockedIn && !showRerun && variants === null) {
    const count = existingOutput.variant_count as number;
    return (
      <div className="space-y-3">
        <ContextStack context={context} />
        <div className="rounded-md border border-sage/30 bg-sage/5 p-4">
          <div className="flex items-start gap-2">
            <Globe className="mt-0.5 h-4 w-4 text-sage" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sage">
                Translations locked in
              </div>
              <div className="font-serif text-base font-semibold text-charcoal">
                {count} regional variants approved
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
              Re-run Localization
            </button>
          )}
        </div>
      </div>
    );
  }

  const showingResults = variants !== null && variants.length > 0;

  // Group variants by region for display
  const grouped: Record<string, Variant[]> = {};
  if (variants) {
    for (const v of variants) {
      (grouped[v.region] ??= []).push(v);
    }
  }
  const regionNames = Object.keys(grouped);

  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      {/* Upstream context: reading from Steps 3 and 5 */}
      {(approvedSkus.length > 0 || layoutCopy) && (
        <div className="rounded-md border border-blue-200/50 bg-blue-50/30 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
            Reading from Steps 3 + 5
          </div>
          <div className="mt-0.5 text-[11px] text-charcoal/65">
            {approvedSkus.length > 0 && <><strong>{approvedSkus.length} SKUs</strong> from Step 3 · </>}
            {layoutCopy && <>Tagline from Step 5: &ldquo;{layoutCopy.slice(0, 60)}{layoutCopy.length > 60 ? "..." : ""}&rdquo;</>}
          </div>
        </div>
      )}

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Automation · Localization Generator
          </span>
        </div>
        <p className="text-sm text-charcoal/70">
          Creates regional variants via deterministic template expansion. Calls
          <strong>generate_locale_variants</strong> Python helper for Spanish and Quebec French transcreation.
        </p>

        {/* Run button */}
        {!showingResults && !running && (
          <button
            type="button"
            onClick={handleRun}
            disabled={!canAct}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            Run Localization Generator
          </button>
        )}

        {/* Running */}
        {running && (
          <div className="mt-3 flex items-center gap-2 text-sm text-charcoal/60">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            Generating regional variants...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-md border border-soft_red/30 bg-soft_red/5 px-3 py-2 text-xs text-soft_red">
            {error}
            <button type="button" onClick={handleRun} className="ml-2 underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {/* Results grouped by region */}
        {showingResults && (
          <div className="mt-3 space-y-3">
            {regionNames.map((region) => (
              <div key={region}>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-charcoal/50">
                  {region} ({grouped[region].length} variants)
                </h4>
                <div className="grid gap-2 md:grid-cols-2">
                  {grouped[region].map((v) => (
                    <VariantCard key={v.variant_id} variant={v} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Re-run button after results */}
        {showingResults && canAct && (
          <button
            type="button"
            onClick={handleRun}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium text-charcoal/65 hover:border-charcoal/30 hover:text-charcoal"
          >
            <RotateCcw className="h-3 w-3" />
            Re-run Localization
          </button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="rounded-md border border-charcoal/10 bg-cream/30 p-3">
          <div className="flex flex-wrap gap-4 text-[11px] text-charcoal/55">
            <span>Total variants: {stats.total_variants}</span>
            <span>Regions: {stats.regions}</span>
            <span>Placements: {stats.placements}</span>
            <span>SKUs: {stats.skus}</span>
            <span>Avg price diff: {stats.avg_price_diff_pct.toFixed(1)}%</span>
          </div>
          {stats.price_alerts.length > 0 && (
            <div className="mt-2 text-[10px] text-amber-600">
              {stats.price_alerts.length} price alert(s): regional pricing differs by more than 5% from master.
            </div>
          )}
          {stats.inventory_alerts.length > 0 && (
            <div className="mt-1 text-[10px] text-amber-600">
              {stats.inventory_alerts.length} inventory alert(s): low stock in some regions.
            </div>
          )}
        </div>
      )}

      {/* Transcreation helper: generate_locale_variants (deterministic Python function) */}
      {mcpResults.length > 0 && (
        <div className="rounded-md border border-green-300/40 bg-green-50/30 p-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-green-700">
            Python helper: generate_locale_variants — {mcpResults.length} locales
          </div>
          {mcpResults.map((r) => (
            <div key={r.target_language} className="mt-1 text-[11px] text-charcoal/65">
              <strong>{r.target_language === "es" ? "Spanish" : "Quebec French"}</strong>: &ldquo;{r.translated_copy.slice(0, 80)}{r.translated_copy.length > 80 ? "..." : ""}&rdquo;
              <span className="ml-1 text-charcoal/40">({r.applied_phrases} phrases applied)</span>
            </div>
          ))}
        </div>
      )}

      {/* Approval footer */}
      {showingResults && (
        <ActionFooter
          canAct={canAct}
          busy={busy}
          cta={`Lock in ${variants.length} translations`}
          ctaKind="approve"
          stepNumber={7}
          onClick={() =>
            onApprove("Lock In Translations", {
              variant_count: variants.length,
              regions: regionNames,
              skus_from_step3: approvedSkus,
              copy_from_step5: layoutCopy,
              locale_variant_results: mcpResults.map((r) => ({
                helper: "generate_locale_variants",
                target_language: r.target_language,
                applied_phrases: r.applied_phrases,
              })),
            })
          }
        />
      )}
    </div>
  );
}
