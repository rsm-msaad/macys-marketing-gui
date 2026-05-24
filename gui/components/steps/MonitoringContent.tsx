"use client";

import { useState } from "react";
import {
  Activity,
  BarChart3,
  Play,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";

import {
  runAnalyze,
  type Analysis,
  type ChannelAttribution,
  type SegmentAttribution,
  type ForecastBlock,
} from "@/lib/api";
import { ActionFooter, ContextStack, type StepContentProps } from "./shared";

/* ---- Mini bar chart (pure CSS) ---- */

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-3 w-full rounded-full bg-charcoal/8">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

/* ---- KPI card ---- */

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-charcoal/10 bg-white px-3 py-2.5 text-center">
      <div className="font-serif text-xl font-bold text-charcoal">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/45">{label}</div>
      {sub && <div className="mt-0.5 text-[10px] text-charcoal/40">{sub}</div>}
    </div>
  );
}

/* ---- Channel table ---- */

function ChannelTable({ channels }: { channels: ChannelAttribution[] }) {
  const maxRev = Math.max(...channels.map((c) => c.revenue), 1);
  return (
    <div className="rounded-md border border-charcoal/10 bg-cream/30 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-600">
        <Activity className="h-3 w-3" /> Channel Attribution
      </div>
      <table className="w-full text-[11px]">
        <thead className="text-charcoal/50">
          <tr>
            <th className="pb-1 text-left font-medium">Channel</th>
            <th className="pb-1 text-right font-medium">Revenue</th>
            <th className="pb-1 text-right font-medium">ROAS</th>
            <th className="pb-1 w-24 font-medium" />
          </tr>
        </thead>
        <tbody>
          {channels.map((c) => (
            <tr key={c.channel} className="border-t border-charcoal/5">
              <td className="py-1.5 font-medium text-charcoal/80 capitalize">{c.channel}</td>
              <td className="py-1.5 text-right text-charcoal/70">${(c.revenue / 1000).toFixed(0)}K</td>
              <td className="py-1.5 text-right font-semibold text-charcoal">{c.roas.toFixed(1)}x</td>
              <td className="py-1.5 pl-2">
                <Bar value={c.revenue} max={maxRev} color={c.roas >= 3 ? "#87A96B" : c.roas >= 1 ? "#D4A537" : "#C84B4B"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Segment table ---- */

function SegmentTable({ segments }: { segments: SegmentAttribution[] }) {
  return (
    <div className="rounded-md border border-charcoal/10 bg-cream/30 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-600">
        <BarChart3 className="h-3 w-3" /> Segment Performance
      </div>
      <table className="w-full text-[11px]">
        <thead className="text-charcoal/50">
          <tr>
            <th className="pb-1 text-left font-medium">Segment</th>
            <th className="pb-1 text-right font-medium">Conversions</th>
            <th className="pb-1 text-right font-medium">Revenue</th>
            <th className="pb-1 text-right font-medium">Lift</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.segment} className="border-t border-charcoal/5">
              <td className="py-1.5 font-medium text-charcoal/80">{s.segment}</td>
              <td className="py-1.5 text-right text-charcoal/70">{s.conversions.toLocaleString()}</td>
              <td className="py-1.5 text-right text-charcoal/70">${(s.revenue / 1000).toFixed(0)}K</td>
              <td className="py-1.5 text-right">
                <span className={`font-semibold ${s.lift_vs_avg >= 0 ? "text-sage" : "text-soft_red"}`}>
                  {s.lift_vs_avg >= 0 ? "+" : ""}{(s.lift_vs_avg * 100).toFixed(0)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Forecast card ---- */

function ForecastCard({ label, block }: { label: string; block: ForecastBlock | null }) {
  if (!block) return null;
  const TrendIcon = block.trend_direction === "up" ? TrendingUp : block.trend_direction === "down" ? TrendingDown : Minus;
  const trendColor = block.trend_direction === "up" ? "text-sage" : block.trend_direction === "down" ? "text-soft_red" : "text-charcoal/50";
  return (
    <div className="rounded-md border border-charcoal/10 bg-white px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/45">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="font-serif text-lg font-bold text-charcoal">
          {label.toLowerCase().includes("roas") ? `${block.predicted.toFixed(1)}x` : `$${(block.predicted / 1000).toFixed(0)}K`}
        </span>
        <TrendIcon className={`h-4 w-4 ${trendColor}`} />
      </div>
      <div className="mt-0.5 text-[10px] text-charcoal/40">
        80% CI: {label.toLowerCase().includes("roas")
          ? `${block.lower_bound.toFixed(1)}x to ${block.upper_bound.toFixed(1)}x`
          : `$${(block.lower_bound / 1000).toFixed(0)}K to $${(block.upper_bound / 1000).toFixed(0)}K`}
      </div>
    </div>
  );
}

/* ---- Main component ---- */

export function MonitoringContent({
  context,
  canAct,
  busy,
  onApprove,
}: StepContentProps) {
  const existingOutput = context.state.step_outputs["9"] as
    | Record<string, unknown>
    | undefined;
  const hasLockedIn = existingOutput && typeof existingOutput.top_channel === "string";

  // Read upstream: segment from Step 2, SKUs from Step 3
  const segmentOutput = context.state.step_outputs["2"] as Record<string, unknown> | undefined;
  const skuOutput = context.state.step_outputs["3"] as Record<string, unknown> | undefined;
  const segmentName = segmentOutput?.name as string | undefined;
  const approvedSkuCount = (skuOutput?.approved_skus as string[] | undefined)?.length ?? 0;

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRerun, setShowRerun] = useState(false);

  async function handleRun() {
    setRunning(true);
    setError(null);
    setAnalysis(null);
    try {
      // Map campaign string ID to a numeric DB campaign_id for the performance table
      // Mother's Day=7, Spring=5, Summer=9 (seeded in campaign_performance)
      const campaignIdMap: Record<string, number> = {
        "MDC-2026-MD-001": 7,
        "MDC-2025-SP-BTY": 5,
        "MDC-2026-SS-003": 9,
      };
      const briefId = context.campaign_brief.campaign_id;
      const dbCampaignId = campaignIdMap[briefId] ?? 7;
      const result = await runAnalyze(dbCampaignId, 14);
      setAnalysis(result.analysis);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  // If already locked in and not re-running, show summary.
  if (hasLockedIn && !showRerun && analysis === null) {
    return (
      <div className="space-y-3">
        <ContextStack context={context} />
        <div className="rounded-md border border-sage/30 bg-sage/5 p-4">
          <div className="flex items-start gap-2">
            <Activity className="mt-0.5 h-4 w-4 text-sage" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sage">
                Performance analysis locked in
              </div>
              <div className="font-serif text-base font-semibold text-charcoal">
                Top channel: {String(existingOutput.top_channel)} / Top segment: {String(existingOutput.top_segment)}
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
              Re-run Performance Analyzer
            </button>
          )}
        </div>
      </div>
    );
  }

  const showingResults = analysis !== null;

  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      {/* Upstream context: reading from Steps 2+3 */}
      {(segmentName || approvedSkuCount > 0) && (
        <div className="rounded-md border border-blue-200/50 bg-blue-50/30 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
            Reading from Steps 2 + 3
          </div>
          <div className="mt-0.5 text-[11px] text-charcoal/65">
            {segmentName && <>Segment: <strong>{segmentName}</strong> · </>}
            {approvedSkuCount > 0 && <><strong>{approvedSkuCount} SKUs</strong></>}
            {" "}— performance scoped to campaign selections.
          </div>
        </div>
      )}

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Automation · Campaign Performance Analyzer
          </span>
        </div>
        <p className="text-sm text-charcoal/70">
          Last-touch attribution and linear regression forecast. Deterministic — same campaign data produces the same analysis.
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
            Run Performance Analyzer
          </button>
        )}

        {/* Running */}
        {running && (
          <div className="mt-3 flex items-center gap-2 text-sm text-charcoal/60">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            Analyzing campaign performance...
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
      </div>

      {/* Dashboard */}
      {showingResults && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-2">
            <KpiCard label="Revenue" value={`$${(analysis.totals.revenue / 1000).toFixed(0)}K`} />
            <KpiCard label="Spend" value={`$${(analysis.totals.spend / 1000).toFixed(0)}K`} />
            <KpiCard label="ROAS" value={`${analysis.totals.roas.toFixed(1)}x`} />
            <KpiCard label="Conversions" value={analysis.totals.conversions.toLocaleString()} />
          </div>

          {/* Attribution tables */}
          <div className="grid gap-3 md:grid-cols-2">
            <ChannelTable channels={analysis.attribution.by_channel} />
            <SegmentTable segments={analysis.attribution.by_segment} />
          </div>

          {/* Forecast */}
          {analysis.forecast.forecast_status === "success" && (
            <div>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">
                14-Day Forecast (80% Confidence Interval)
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <ForecastCard label="Revenue Forecast" block={analysis.forecast.revenue} />
                <ForecastCard label="Conversions Forecast" block={analysis.forecast.conversions} />
                <ForecastCard label="ROAS Forecast" block={analysis.forecast.roas} />
              </div>
            </div>
          )}
          {analysis.forecast.forecast_status !== "success" && analysis.forecast.message && (
            <div className="rounded-md border border-amber-300/40 bg-amber-50/30 p-3 text-[11px] text-amber-700">
              Forecast: {analysis.forecast.message}
            </div>
          )}

          {/* Summary */}
          <div className="rounded-md border border-charcoal/10 bg-cream/30 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/45">Executive Summary</div>
            <p className="mt-1 text-[12px] leading-relaxed text-charcoal/70">{analysis.summary}</p>
          </div>

          {/* Top/bottom callouts */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            {analysis.attribution.top_channel && (
              <span className="rounded-full bg-sage/15 px-2.5 py-1 font-medium text-sage">
                Top channel: {analysis.attribution.top_channel}
              </span>
            )}
            {analysis.attribution.worst_channel && (
              <span className="rounded-full bg-soft_red/10 px-2.5 py-1 font-medium text-soft_red">
                Weakest: {analysis.attribution.worst_channel}
              </span>
            )}
            {analysis.attribution.top_segment && (
              <span className="rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-700">
                Top segment: {analysis.attribution.top_segment}
              </span>
            )}
          </div>

          {/* Re-run */}
          {canAct && (
            <button
              type="button"
              onClick={handleRun}
              className="inline-flex items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium text-charcoal/65 hover:border-charcoal/30 hover:text-charcoal"
            >
              <RotateCcw className="h-3 w-3" />
              Re-run Analysis
            </button>
          )}
        </>
      )}

      {/* Approval footer */}
      {showingResults && (
        <ActionFooter
          canAct={canAct}
          busy={busy}
          cta="Lock in Performance Analysis"
          ctaKind="approve"
          stepNumber={9}
          onClick={() =>
            onApprove("Confirm Performance Pull", {
              top_channel: analysis.attribution.top_channel,
              top_segment: analysis.attribution.top_segment,
              totals: analysis.totals,
              segment_used: segmentName ?? null,
              sku_count: approvedSkuCount,
            })
          }
        />
      )}
    </div>
  );
}
