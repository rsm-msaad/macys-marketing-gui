"use client";

import { useEffect, useState } from "react";
import { Loader2, X, AlertTriangle } from "lucide-react";

import {
  API_BASE,
  runAnalyze,
  runDam,
  runLocalize,
  runSegment,
  type AnalyzeResult,
  type DamResult,
  type LocalizeResult,
  type SegmentResult,
} from "@/lib/api";
import type { SkillKind } from "@/components/SkillCard";

type SkillResult =
  | { kind: "segment"; data: SegmentResult }
  | { kind: "dam"; data: DamResult }
  | { kind: "localize"; data: LocalizeResult }
  | { kind: "analyze"; data: AnalyzeResult };

export type ModalState = {
  kind: SkillKind;
  prefill?: Record<string, unknown>;
} | null;

export function ResultsModal({
  state,
  onClose,
}: {
  state: ModalState;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SkillResult | null>(null);
  const [brief, setBrief] = useState<string>("Mother's Day Beauty Event");
  const [maxResults, setMaxResults] = useState<number>(12);
  const [skuIds, setSkuIds] = useState<string>("4, 18");
  const [campaignId, setCampaignId] = useState<number>(7);
  const [forecastDays, setForecastDays] = useState<number>(14);

  useEffect(() => {
    if (!state) {
      setBusy(false);
      setError(null);
      setResult(null);
      return;
    }
    // Pre-fill from chat data when available.
    const pf = state.prefill ?? {};
    if (typeof pf.brief === "string") setBrief(pf.brief);
    if (typeof pf.max_results === "number") setMaxResults(pf.max_results);
    if (Array.isArray(pf.sku_ids)) setSkuIds(pf.sku_ids.join(", "));
    if (typeof pf.campaign_id === "number") setCampaignId(pf.campaign_id);
    if (typeof pf.forecast_days === "number") setForecastDays(pf.forecast_days);
  }, [state]);

  if (!state) return null;

  async function run() {
    if (!state) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (state.kind === "segment") {
        const data = await runSegment(brief);
        setResult({ kind: "segment", data });
      } else if (state.kind === "dam") {
        const data = await runDam(brief, maxResults);
        setResult({ kind: "dam", data });
      } else if (state.kind === "localize") {
        const ids = skuIds
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n));
        if (ids.length === 0) {
          throw new Error("Please enter at least one numeric SKU id (comma separated).");
        }
        const data = await runLocalize(brief, ids);
        setResult({ kind: "localize", data });
      } else {
        const data = await runAnalyze(campaignId, forecastDays);
        setResult({ kind: "analyze", data });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-charcoal/10 px-6 py-4">
          <h2 className="font-serif text-xl font-semibold text-charcoal">{titleFor(state.kind)}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-charcoal/60 hover:bg-cream hover:text-charcoal">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Inputs */}
          <div className="mb-5 grid gap-3 rounded-md border border-charcoal/10 bg-cream/40 p-4 md:grid-cols-2">
            {(state.kind === "segment" || state.kind === "dam" || state.kind === "localize") && (
              <label className="block">
                <span className="block text-xs font-medium text-charcoal/60">Campaign brief</span>
                <input
                  type="text"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  className="mt-1 w-full rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </label>
            )}
            {state.kind === "dam" && (
              <label className="block">
                <span className="block text-xs font-medium text-charcoal/60">Max results</span>
                <input
                  type="number"
                  value={maxResults}
                  onChange={(e) => setMaxResults(parseInt(e.target.value, 10) || 12)}
                  min={1}
                  max={50}
                  className="mt-1 w-full rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </label>
            )}
            {state.kind === "localize" && (
              <label className="block">
                <span className="block text-xs font-medium text-charcoal/60">Master SKU ids (comma separated)</span>
                <input
                  type="text"
                  value={skuIds}
                  onChange={(e) => setSkuIds(e.target.value)}
                  className="mt-1 w-full rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </label>
            )}
            {state.kind === "analyze" && (
              <>
                <label className="block">
                  <span className="block text-xs font-medium text-charcoal/60">Campaign id</span>
                  <input
                    type="number"
                    value={campaignId}
                    onChange={(e) => setCampaignId(parseInt(e.target.value, 10) || 7)}
                    className="mt-1 w-full rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-charcoal/60">Forecast days</span>
                  <input
                    type="number"
                    value={forecastDays}
                    onChange={(e) => setForecastDays(parseInt(e.target.value, 10) || 14)}
                    className="mt-1 w-full rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </label>
              </>
            )}
            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-charcoal/15 bg-white px-4 py-2 text-sm font-medium text-charcoal hover:bg-cream"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={run}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Run
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-soft_red/30 bg-soft_red/5 p-3 text-sm text-soft_red">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {result && <ResultBody result={result} />}
        </div>
      </div>
    </div>
  );
}

function titleFor(kind: SkillKind) {
  switch (kind) {
    case "segment":
      return "Audience Segment Builder";
    case "dam":
      return "DAM Asset Finder";
    case "localize":
      return "Localization Generator";
    case "analyze":
      return "Campaign Performance Analyzer";
  }
}

function ResultBody({ result }: { result: SkillResult }) {
  if (result.kind === "segment") return <SegmentResults data={result.data} />;
  if (result.kind === "dam") return <DamResults data={result.data} />;
  if (result.kind === "localize") return <LocalizeResults data={result.data} />;
  return <AnalyzeResults data={result.data} />;
}

function SegmentResults({ data }: { data: SegmentResult }) {
  return (
    <div>
      <p className="mb-4 text-sm text-charcoal/70">
        Built using RFM clustering (k means, k=3) on {data.total_clustered.toLocaleString()} customers with transactions.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {data.segments.map((s, i) => (
          <div key={s.name} className="rounded-md border border-charcoal/10 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-600">Segment {i + 1}</span>
              <span className="text-xs text-charcoal/50">{s.customer_count.toLocaleString()} customers</span>
            </div>
            <h4 className="font-serif text-lg font-semibold text-charcoal">{s.name}</h4>
            <p className="mt-1 text-xs text-charcoal/55">{s.definition}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-charcoal/55">Avg recency</dt>
              <dd className="text-charcoal text-right">{s.avg_recency_days.toFixed(0)} days</dd>
              <dt className="text-charcoal/55">Avg frequency</dt>
              <dd className="text-charcoal text-right">{s.avg_frequency.toFixed(1)} txns</dd>
              <dt className="text-charcoal/55">Avg monetary</dt>
              <dd className="text-charcoal text-right">${s.avg_monetary.toLocaleString()}</dd>
              <dt className="text-charcoal/55">Top category</dt>
              <dd className="text-charcoal text-right">
                {s.top_category}{" "}
                <span className="text-charcoal/50">
                  ({(s.top_category_lift * 100 >= 0 ? "+" : "") + Math.round(s.top_category_lift * 100)}%)
                </span>
              </dd>
            </dl>
            <div className="mt-3 border-t border-charcoal/10 pt-2 text-xs text-charcoal/65">
              {Object.entries(s.loyalty_mix)
                .sort((a, b) => b[1] - a[1])
                .map(([tier, pct]) => `${pct}% ${tier}`)
                .join(", ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DamResults({ data }: { data: DamResult }) {
  const fo = data.stats.filtered_out;
  return (
    <div>
      <div className="mb-4 grid gap-2 rounded-md border border-charcoal/10 bg-cream/40 p-4 text-xs text-charcoal/70 md:grid-cols-4">
        <Stat label="Searched" value={data.stats.total_searched.toLocaleString()} />
        <Stat label="Filtered" value={data.stats.filtered_total.toLocaleString()}
          sub={`degraded ${fo.degraded.toLocaleString()}, expired ${fo.expired_rights.toLocaleString()}, low res ${fo.low_resolution.toLocaleString()}`}
        />
        <Stat label="Kept" value={data.stats.kept.toLocaleString()} />
        <Stat label="Avg relevance" value={data.stats.avg_relevance.toFixed(2)} />
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        {data.results.map((a) => (
          <div key={a.asset_id} className="overflow-hidden rounded-md border border-charcoal/10">
            <div className="relative aspect-video bg-cream">
              {/* Plain img tag (not Next/Image) so a missing file falls back gracefully. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${API_BASE}/images/dam/${a.filename}`}
                alt={a.filename}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fb) fb.style.display = "flex";
                }}
              />
              <div className="absolute inset-0 hidden items-center justify-center text-xs text-charcoal/40">
                no preview
              </div>
            </div>
            <div className="p-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-charcoal">Rank {a.rank}</span>
                <span className="text-charcoal/55">{a.relevance_score.toFixed(2)}</span>
              </div>
              <div className="mt-1 truncate text-charcoal/70">{a.filename}</div>
              <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                <span className="rounded-full bg-cream px-1.5 py-0.5 text-charcoal/70">{a.asset_type}</span>
                <span className="rounded-full bg-cream px-1.5 py-0.5 text-charcoal/70">{a.resolution}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LocalizeResults({ data }: { data: LocalizeResult }) {
  const sample = data.variants.slice(0, 8);
  return (
    <div>
      <div className="mb-4 grid gap-2 rounded-md border border-charcoal/10 bg-cream/40 p-4 text-xs text-charcoal/70 md:grid-cols-4">
        <Stat label="Variants" value={String(data.stats.total_variants)} />
        <Stat label="Regions" value={String(data.stats.regions)} />
        <Stat label="Placements" value={String(data.stats.placements)} />
        <Stat label="SKUs" value={String(data.stats.skus)} />
      </div>

      {data.stats.inventory_alerts.length > 0 && (
        <div className="mb-3 rounded-md border border-mustard/40 bg-mustard/10 p-3 text-xs text-charcoal/80">
          <div className="font-semibold text-charcoal">Inventory alerts ({data.stats.inventory_alerts.length})</div>
          <ul className="mt-1 list-disc pl-4">
            {data.stats.inventory_alerts.slice(0, 6).map((a, i) => (
              <li key={i}>
                sku {a.sku_id} in {a.region}: {a.status}
                {a.units > 0 ? ` (${a.units} units)` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {sample.map((v) => (
          <div key={v.variant_id} className="rounded-md border border-charcoal/10 p-3 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
              {v.region} · {v.placement}
            </div>
            <div className="mt-1 text-charcoal/55">{v.placement_dimensions}</div>
            <div className="mt-2 line-clamp-2 font-serif text-sm font-semibold text-charcoal">
              {v.copy_headline}
            </div>
            <div className="mt-1 line-clamp-3 text-charcoal/70">{v.copy_subhead}</div>
            <div className="mt-2 text-charcoal/55">CTA: {v.cta_text}</div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-charcoal/70">${v.regional_price.toFixed(2)}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${badgeClassFor(v.inventory_status)}`}>
                {v.inventory_status} {v.inventory_units > 0 ? `(${v.inventory_units})` : ""}
              </span>
            </div>
          </div>
        ))}
      </div>
      {data.variants.length > sample.length && (
        <p className="mt-3 text-xs text-charcoal/55">
          Showing {sample.length} of {data.variants.length} generated variants. Full list available via the API response.
        </p>
      )}
    </div>
  );
}

function AnalyzeResults({ data }: { data: AnalyzeResult }) {
  const a = data.analysis;
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-charcoal/10 bg-cream/40 p-4">
        <div className="text-xs uppercase tracking-wider text-charcoal/55">Campaign</div>
        <div className="font-serif text-lg font-semibold text-charcoal">{a.campaign_name}</div>
        <div className="text-xs text-charcoal/55">
          {a.campaign_window.start} to {a.campaign_window.end} · {a.campaign_window.days} days · {a.campaign_status}
        </div>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
          <Stat label="Total Revenue" value={`$${a.totals.revenue.toLocaleString()}`} />
          <Stat label="Total Spend" value={`$${a.totals.spend.toLocaleString()}`} />
          <Stat label="Overall ROAS" value={`${a.totals.roas.toFixed(1)}x`} />
          <Stat label="Conversions" value={a.totals.conversions.toLocaleString()} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-charcoal/10">
          <div className="border-b border-charcoal/10 px-4 py-2 text-sm font-semibold text-charcoal">
            Channel attribution
          </div>
          <table className="w-full text-xs">
            <thead className="text-charcoal/55">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Channel</th>
                <th className="px-3 py-1.5 text-right font-medium">Revenue</th>
                <th className="px-3 py-1.5 text-right font-medium">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {a.attribution.by_channel.slice(0, 5).map((c) => (
                <tr key={c.channel} className="border-t border-charcoal/5">
                  <td className="px-3 py-1.5">{c.channel}</td>
                  <td className="px-3 py-1.5 text-right">${c.revenue.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right">{c.roas.toFixed(1)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-charcoal/5 px-4 py-2 text-xs text-charcoal/65">
            Top: {a.attribution.top_channel} · Worst: {a.attribution.worst_channel}
          </div>
        </div>

        <div className="rounded-md border border-charcoal/10">
          <div className="border-b border-charcoal/10 px-4 py-2 text-sm font-semibold text-charcoal">
            Segment attribution (loyalty tier)
          </div>
          <table className="w-full text-xs">
            <thead className="text-charcoal/55">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Tier</th>
                <th className="px-3 py-1.5 text-right font-medium">Conv rate</th>
                <th className="px-3 py-1.5 text-right font-medium">vs avg</th>
              </tr>
            </thead>
            <tbody>
              {a.attribution.by_segment.map((s) => (
                <tr key={s.segment} className="border-t border-charcoal/5">
                  <td className="px-3 py-1.5">{s.segment}</td>
                  <td className="px-3 py-1.5 text-right">{(s.conversion_rate * 100).toFixed(1)}%</td>
                  <td className={`px-3 py-1.5 text-right ${s.lift_vs_avg >= 0 ? "text-sage" : "text-soft_red"}`}>
                    {(s.lift_vs_avg * 100 >= 0 ? "+" : "") + Math.round(s.lift_vs_avg * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-md border border-charcoal/10 p-4">
        <div className="mb-2 text-sm font-semibold text-charcoal">
          Forecast (next {a.forecast.horizon_days} days)
        </div>
        {a.forecast.forecast_status === "success" && a.forecast.revenue ? (
          <div className="grid gap-3 text-xs md:grid-cols-3">
            <ForecastCell title="Revenue" block={a.forecast.revenue} format={(n) => `$${Math.round(n).toLocaleString()}`} />
            {a.forecast.conversions && (
              <ForecastCell title="Conversions" block={a.forecast.conversions} format={(n) => Math.round(n).toLocaleString()} />
            )}
            {a.forecast.roas && (
              <ForecastCell title="ROAS" block={a.forecast.roas} format={(n) => `${n.toFixed(1)}x`} />
            )}
          </div>
        ) : (
          <p className="text-xs text-charcoal/65">
            {a.forecast.message ?? "Insufficient history to forecast."}
          </p>
        )}
      </div>

      <div className="rounded-md border border-charcoal/10 bg-cream/40 p-4">
        <div className="mb-2 text-sm font-semibold text-charcoal">Executive summary</div>
        <p className="text-sm leading-relaxed text-charcoal/85">{a.summary}</p>
      </div>
    </div>
  );
}

function ForecastCell({
  title,
  block,
  format,
}: {
  title: string;
  block: { predicted: number; lower_bound: number; upper_bound: number; trend_direction: string };
  format: (n: number) => string;
}) {
  const arrow = block.trend_direction === "up" ? "▲" : block.trend_direction === "down" ? "▼" : "•";
  const color =
    block.trend_direction === "up" ? "text-sage" : block.trend_direction === "down" ? "text-soft_red" : "text-charcoal/60";
  return (
    <div className="rounded-md border border-charcoal/10 bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/55">{title}</div>
      <div className="mt-1 font-serif text-lg font-semibold text-charcoal">{format(block.predicted)}</div>
      <div className="mt-0.5 text-[11px] text-charcoal/55">
        CI: {format(block.lower_bound)} to {format(block.upper_bound)}
      </div>
      <div className={`mt-1 text-[11px] font-medium ${color}`}>
        {arrow} trending {block.trend_direction}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/55">{label}</div>
      <div className="font-serif text-base font-semibold text-charcoal">{value}</div>
      {sub && <div className="text-[10px] text-charcoal/50">{sub}</div>}
    </div>
  );
}

function badgeClassFor(status: string) {
  if (status === "in_stock") return "bg-sage/15 text-sage";
  if (status === "low_stock") return "bg-mustard/15 text-mustard";
  return "bg-soft_red/15 text-soft_red";
}
