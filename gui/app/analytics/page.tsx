"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Clock,
  DollarSign,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from "lucide-react";

import { API_BASE } from "@/lib/api";

type CampaignMetric = {
  campaign_id: string;
  campaign_name: string;
  hours_saved: number;
  dollars_saved: number;
  days_saved: number;
  pct_reduction: number;
  completed_steps: number;
  compliance_findings: number;
  revision_rounds: number;
  evidence_coverage_pct: number;
};

type AnalyticsData = {
  campaigns: CampaignMetric[];
  campaign_count: number;
  totals: {
    hours_saved: number;
    dollars_saved: number;
    compliance_findings: number;
    compliance_failures: number;
    revision_rounds: number;
    mcp_invocations: number;
  };
  mcp_by_tool: Record<string, number>;
  projected_annual: number;
};

function MetricBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-[11px] text-charcoal/60 truncate">{label}</span>
      <div className="flex-1 h-4 rounded bg-charcoal/8">
        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-16 text-right text-[11px] font-semibold text-charcoal">{value}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/analytics/overview`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream/30">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  const maxHours = Math.max(...data.campaigns.map((c) => c.hours_saved), 1);
  const maxDollars = Math.max(...data.campaigns.map((c) => c.dollars_saved), 1);
  const totalMcp = Object.values(data.mcp_by_tool).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-cream/30">
      <div className="border-b border-charcoal/10 bg-white px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-600 hover:text-teal-700 mb-2">
            <ArrowLeft className="h-3 w-3" /> Back
          </Link>
          <h1 className="font-serif text-2xl font-bold text-charcoal">Analytics</h1>
          <p className="mt-1 text-[13px] text-charcoal/60">
            Cross-campaign trends and quality metrics. For per-campaign drill-down, see <Link href="/impact" className="text-teal-600 underline">Impact</Link>.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        {/* Summary row */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-4">
            <Clock className="h-4 w-4 text-teal-600" />
            <div className="mt-2 font-serif text-2xl font-bold text-teal-700">{data.totals.hours_saved}h</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">Total Hours Saved</div>
          </div>
          <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-4">
            <DollarSign className="h-4 w-4 text-teal-600" />
            <div className="mt-2 font-serif text-2xl font-bold text-teal-700">${data.totals.dollars_saved.toLocaleString()}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">Total Dollar Savings</div>
          </div>
          <div className="rounded-lg border border-charcoal/10 bg-white p-4">
            <TrendingUp className="h-4 w-4 text-charcoal/40" />
            <div className="mt-2 font-serif text-2xl font-bold text-charcoal">${(data.projected_annual / 1_000_000).toFixed(1)}M</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">Projected Annual</div>
          </div>
          <div className="rounded-lg border border-charcoal/10 bg-white p-4">
            <ShieldCheck className="h-4 w-4 text-charcoal/40" />
            <div className="mt-2 font-serif text-2xl font-bold text-charcoal">{data.totals.compliance_findings}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">Compliance Findings</div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Hours saved per campaign */}
          <div className="rounded-lg border border-charcoal/10 bg-white p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-charcoal/50">
              <Clock className="h-3 w-3" /> Hours Saved by Campaign
            </h3>
            <div className="space-y-2">
              {data.campaigns.map((c) => (
                <MetricBar key={c.campaign_id} label={c.campaign_name} value={c.hours_saved} max={maxHours} color="#0d9488" />
              ))}
            </div>
          </div>

          {/* Dollar savings per campaign */}
          <div className="rounded-lg border border-charcoal/10 bg-white p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-charcoal/50">
              <DollarSign className="h-3 w-3" /> Dollar Savings by Campaign
            </h3>
            <div className="space-y-2">
              {data.campaigns.map((c) => (
                <MetricBar key={c.campaign_id} label={c.campaign_name} value={c.dollars_saved} max={maxDollars} color="#0d9488" />
              ))}
            </div>
          </div>

          {/* Quality metrics */}
          <div className="rounded-lg border border-charcoal/10 bg-white p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-charcoal/50">
              <BarChart3 className="h-3 w-3" /> Quality Metrics by Campaign
            </h3>
            <table className="w-full text-[11px]">
              <thead className="text-[10px] text-charcoal/40 uppercase">
                <tr>
                  <th className="pb-2 text-left">Campaign</th>
                  <th className="pb-2 text-right">Compliance</th>
                  <th className="pb-2 text-right">Revisions</th>
                  <th className="pb-2 text-right">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c) => (
                  <tr key={c.campaign_id} className="border-t border-charcoal/5">
                    <td className="py-2 font-medium text-charcoal/70">{c.campaign_name}</td>
                    <td className="py-2 text-right">{c.compliance_findings} findings</td>
                    <td className="py-2 text-right">{c.revision_rounds} rounds</td>
                    <td className="py-2 text-right">{c.evidence_coverage_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MCP tool usage */}
          <div className="rounded-lg border border-charcoal/10 bg-white p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-charcoal/50">
              <Wrench className="h-3 w-3" /> MCP Tool Usage
            </h3>
            <div className="space-y-3">
              {Object.entries(data.mcp_by_tool).map(([tool, count]) => {
                const pct = totalMcp > 0 ? Math.round((count / totalMcp) * 100) : 0;
                return (
                  <div key={tool}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[11px] text-charcoal/70">{tool}</span>
                      <span className="text-[10px] text-charcoal/50">{count} calls ({pct}%)</span>
                    </div>
                    <div className="h-3 w-full rounded bg-charcoal/8">
                      <div
                        className="h-full rounded bg-violet-500/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-[10px] text-charcoal/40">
              Total: {totalMcp} MCP tool invocations across {data.campaign_count} campaigns.
              check_pricing_conflicts fires agentically at Steps 6a/6b; others are deterministic helpers.
            </div>
          </div>
        </div>

        {/* Top performers table */}
        <div className="rounded-lg border border-charcoal/10 bg-white p-5">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-charcoal/50">
            Campaign Performance Ranking
          </h3>
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-charcoal/40 uppercase">
              <tr>
                <th className="pb-2 text-left">Rank</th>
                <th className="pb-2 text-left">Campaign</th>
                <th className="pb-2 text-right">Hours Saved</th>
                <th className="pb-2 text-right">$ Saved</th>
                <th className="pb-2 text-right">Cycle Reduction</th>
                <th className="pb-2 text-right">Steps Done</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c, i) => (
                <tr key={c.campaign_id} className="border-t border-charcoal/5">
                  <td className="py-2 font-bold text-charcoal/40">{i + 1}</td>
                  <td className="py-2 font-medium text-charcoal/80">{c.campaign_name}</td>
                  <td className="py-2 text-right font-semibold text-teal-700">{c.hours_saved}h</td>
                  <td className="py-2 text-right">${c.dollars_saved.toLocaleString()}</td>
                  <td className="py-2 text-right">{c.pct_reduction}%</td>
                  <td className="py-2 text-right">{c.completed_steps}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
