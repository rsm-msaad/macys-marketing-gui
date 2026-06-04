"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  ShieldCheck,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";

import { API_BASE } from "@/lib/api";
import {
  PageTransition,
  FadeInView,
  StaggerContainer,
  StaggerItem,
  AnimatedBar,
  CountUp,
  PulsingDots,
} from "@/components/motion";

/* ---- Types ---- */

type StepImpact = {
  step: string;
  step_name: string;
  completed: boolean;
  baseline_days: { low: number; high: number; mid: number };
  ai_supported_days: { low: number; high: number; mid: number };
  baseline_labor_hours: number;
  ai_labor_hours: number;
  labor_hours_saved: number;
  dollars_saved: number;
};

type CampaignImpact = {
  campaign_id: string;
  campaign_name: string;
  current_step: number;
  is_complete: boolean;
  completed_step_count: number;
  hero: {
    labor_hours_saved: number;
    dollars_saved: number;
    dollars_saved_range: { low: number; high: number };
    baseline_elapsed_days: number;
    ai_elapsed_days: number;
    pct_reduction: number;
    full_campaign_pct_reduction: number;
  };
  labor_totals: {
    baseline_hours: number;
    ai_hours: number;
  };
  steps: StepImpact[];
  quality: {
    compliance_findings: number;
    compliance_failures: number;
    revision_rounds: number;
    evidence_coverage_steps: number;
    evidence_coverage_pct: number;
    mcp_invocations: number;
  };
};

type Portfolio = {
  campaigns: CampaignImpact[];
  campaign_count: number;
  aggregate: {
    total_labor_hours_saved: number;
    total_dollars_saved: number;
    savings_per_completed_campaign: number;
    projected_annual_low: number;
    projected_annual_high: number;
    annual_campaign_volume_low: number;
    annual_campaign_volume_high: number;
    hourly_rate: number;
  };
  costs_not_netted: {
    ai_api_cost_per_campaign: string;
    ai_api_note: string;
    pattern4_rework_per_campaign: string;
    pattern4_note: string;
  };
  quality_aggregate: {
    total_compliance_findings: number;
    total_compliance_failures: number;
    total_revision_rounds: number;
    total_mcp_invocations: number;
  };
};

/* ---- Components ---- */

function HeroCard({ icon: Icon, label, value, countUp, sub, accent = false }: {
  icon: typeof Clock;
  label: string;
  value: string;
  countUp?: { end: number; prefix?: string; suffix?: string; decimals?: number; duration?: number };
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`card-hover rounded-lg border p-5 ${accent ? "border-teal-200 bg-teal-50/40" : "border-charcoal/10 bg-white"}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-charcoal/50">
        <Icon className={`h-4 w-4 ${accent ? "text-teal-600" : "text-charcoal/40"}`} />
        {label}
      </div>
      <div className={`mt-2 font-serif text-3xl font-bold ${accent ? "text-teal-700" : "text-charcoal"}`}>
        {countUp ? (
          <CountUp end={countUp.end} prefix={countUp.prefix} suffix={countUp.suffix} decimals={countUp.decimals} duration={countUp.duration} />
        ) : value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-charcoal/50">{sub}</div>}
    </div>
  );
}

function StepBar({ step, maxBaseline, index }: { step: StepImpact; maxBaseline: number; index: number }) {
  const baselinePct = maxBaseline > 0 ? (step.baseline_labor_hours / maxBaseline) * 100 : 0;
  const aiPct = maxBaseline > 0 ? (step.ai_labor_hours / maxBaseline) * 100 : 0;
  return (
    <tr className="border-t border-charcoal/5">
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
            step.completed ? "bg-teal-100 text-teal-700" : "bg-charcoal/8 text-charcoal/40"
          }`}>
            {step.completed ? <CheckCircle2 className="h-3 w-3" /> : step.step}
          </span>
          <span className="text-[12px] font-medium text-charcoal/80">{step.step_name}</span>
        </div>
      </td>
      <td className="py-2.5 text-right text-[11px] text-charcoal/55">{step.baseline_labor_hours}h</td>
      <td className="py-2.5 text-right text-[11px] font-medium text-teal-700">{step.ai_labor_hours}h</td>
      <td className="py-2.5 pl-3 w-40">
        <div className="relative h-4">
          <AnimatedBar pct={baselinePct} color="rgba(45,45,45,0.1)" delay={index * 0.08} />
          <div className="absolute inset-y-0 left-0">
            <AnimatedBar pct={aiPct} color="rgba(13,148,136,0.7)" height="h-4" delay={index * 0.08 + 0.1} />
          </div>
        </div>
      </td>
      <td className="py-2.5 text-right text-[11px] font-semibold text-charcoal">{step.labor_hours_saved}h</td>
      <td className="py-2.5 text-right text-[11px] text-charcoal/55">${step.dollars_saved.toLocaleString()}</td>
    </tr>
  );
}

function QualityCard({ icon: Icon, label, value, color = "teal" }: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  color?: string;
}) {
  const colors: Record<string, { bg: string; icon: string; text: string }> = {
    teal: { bg: "bg-teal-50/50", icon: "text-teal-600", text: "text-teal-700" },
    amber: { bg: "bg-amber-50/50", icon: "text-amber-600", text: "text-amber-700" },
    violet: { bg: "bg-violet-50/50", icon: "text-violet-600", text: "text-violet-700" },
    sage: { bg: "bg-green-50/50", icon: "text-green-600", text: "text-green-700" },
  };
  const c = colors[color] ?? colors.teal;
  return (
    <div className={`card-hover rounded-lg border border-charcoal/10 ${c.bg} p-4`}>
      <Icon className={`h-4 w-4 ${c.icon}`} />
      <div className={`mt-2 font-serif text-2xl font-bold ${c.text}`}>{value}</div>
      <div className="mt-0.5 text-xs font-medium text-charcoal/50">{label}</div>
    </div>
  );
}

function CampaignComparisonBar({ campaign }: { campaign: CampaignImpact }) {
  const maxDays = 45;
  const bPct = Math.min(100, (campaign.hero.baseline_elapsed_days / maxDays) * 100);
  const aPct = Math.min(100, (campaign.hero.ai_elapsed_days / maxDays) * 100);
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12px] font-semibold text-charcoal">{campaign.campaign_name}</div>
          <div className="text-xs text-charcoal/50">
            {campaign.is_complete ? "Completed" : `Step ${campaign.current_step} of 10`}
            {" · "}{campaign.completed_step_count} steps done
          </div>
        </div>
        <div className="text-right">
          <div className="font-serif text-lg font-bold text-teal-700">~${(campaign.hero.dollars_saved / 1000).toFixed(1)}K</div>
          <div className="text-xs text-charcoal/50">saved</div>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-16 text-xs text-charcoal/50">Before</span>
          <div className="flex-1 h-3 rounded bg-charcoal/8">
            <div className="h-full rounded bg-charcoal/25" style={{ width: `${bPct}%` }} />
          </div>
          <span className="w-12 text-right text-xs text-charcoal/55">{campaign.hero.baseline_elapsed_days}d</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 text-xs text-teal-600 font-medium">After</span>
          <div className="flex-1 h-3 rounded bg-charcoal/8">
            <div className="h-full rounded bg-teal-500" style={{ width: `${aPct}%` }} />
          </div>
          <span className="w-12 text-right text-xs font-semibold text-teal-700">{campaign.hero.ai_elapsed_days}d</span>
        </div>
      </div>
    </div>
  );
}

/* ---- Page ---- */

export default function ImpactPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [selectedId, setSelectedId] = useState<string>("MDC-2026-MD-001");
  const [loading, setLoading] = useState(true);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/impact/portfolio`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setPortfolio(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const selected = portfolio?.campaigns.find((c) => c.campaign_id === selectedId) ?? portfolio?.campaigns[0];
  const maxBaseline = selected ? Math.max(...selected.steps.map((s) => s.baseline_labor_hours)) : 24;

  return (
    <PageTransition className="min-h-screen bg-cream/30">
      {/* Hero banner with coins video */}
      <div className="relative overflow-hidden border-b border-charcoal/10">
        <video
          autoPlay loop muted playsInline
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.2 }}
        >
          <source src="/coin-float.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/60 to-white/80" />
        <div className="relative px-6 py-6">
          <div className="mx-auto max-w-6xl">
            <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-600 hover:text-teal-700 mb-2">
              <ArrowLeft className="h-3 w-3" /> Back to campaigns
            </Link>
            <h1 className="font-serif text-2xl font-bold text-charcoal">Before GenAI vs After GenAI</h1>
            <p className="mt-1 text-[13px] text-charcoal/60">
              Time, cost, and quality impact of AI supported campaign operations vs the manual baseline.
              Labor hours (for $) are separated from elapsed calendar days (for cycle %).
              Baseline: $75/hr fully loaded (reasoned assumption for mid to senior marketing operations roles in NYC, base salary $95K to $120K plus a 1.3 to 1.4x benefits and overhead multiplier, giving $59 to $81/hr), 154 labor hours and 30 to 40 business days per campaign.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-8">
        {loading && (
          <div className="flex items-center justify-center py-12 text-sm text-charcoal/50">
            <PulsingDots text="Computing impact metrics" />
          </div>
        )}

        {portfolio && selected && (
          <>
            {/* ===== SECTION A: Per-Campaign ===== */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg font-semibold text-charcoal">Per-Campaign Impact</h2>
                {portfolio.campaigns.length > 1 && (
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="rounded-md border border-charcoal/15 bg-white px-3 py-1.5 text-[12px] text-charcoal"
                  >
                    {portfolio.campaigns.map((c) => (
                      <option key={c.campaign_id} value={c.campaign_id}>
                        {c.campaign_name} ({c.completed_step_count}/10 steps)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Hero cards with count-up animation */}
              <StaggerContainer className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StaggerItem>
                  <HeroCard icon={Clock} label="Labor Hours Saved" value="" countUp={{ end: selected.hero.labor_hours_saved, suffix: "h", decimals: 1, duration: 1.5 }} sub={`${selected.labor_totals.baseline_hours}h before → ${selected.labor_totals.ai_hours}h after`} accent />
                </StaggerItem>
                <StaggerItem>
                  <HeroCard
                    icon={DollarSign}
                    label="Estimated Savings"
                    value={selected.hero.dollars_saved > 0
                      ? `~$${(selected.hero.dollars_saved / 1000).toFixed(1)}K`
                      : "$0"}
                    sub="at $75/hr fully loaded (range shown below)"
                    accent
                  />
                </StaggerItem>
                <StaggerItem>
                  <HeroCard icon={TrendingUp} label="Cycle Reduction" value="" countUp={{ end: selected.hero.pct_reduction, suffix: "%", duration: 1.2 }} sub={`${selected.hero.baseline_elapsed_days}d → ${selected.hero.ai_elapsed_days}d elapsed`} />
                </StaggerItem>
                <StaggerItem>
                  <HeroCard icon={Zap} label="Steps Completed" value={`${selected.completed_step_count}/10`} sub={selected.is_complete ? "Campaign complete" : `Currently at Step ${selected.current_step}`} />
                </StaggerItem>
              </StaggerContainer>

              {/* Quality measures */}
              <FadeInView delay={0.2} className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <QualityCard icon={ShieldCheck} label="Compliance Findings" value={String(selected.quality.compliance_findings)} color="teal" />
                <QualityCard icon={BarChart3} label="Revision Rounds" value={String(selected.quality.revision_rounds)} color="amber" />
                <QualityCard icon={CheckCircle2} label="Evidence Coverage" value={`${selected.quality.evidence_coverage_pct}%`} color="sage" />
                <QualityCard icon={Wrench} label="MCP Tool Invocations" value={String(selected.quality.mcp_invocations)} color="violet" />
              </FadeInView>
            </section>

            {/* ===== SECTION B: Portfolio Aggregate ===== */}
            <FadeInView>
              <h2 className="font-serif text-lg font-semibold text-charcoal mb-4">Portfolio Aggregate</h2>

              {/* Aggregate hero cards */}
              <StaggerContainer className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StaggerItem>
                  <HeroCard icon={DollarSign} label="Total Savings (Demo)" value={`~$${(portfolio.aggregate.total_dollars_saved / 1000).toFixed(1)}K`} sub={`across ${portfolio.campaign_count} demo campaigns`} accent />
                </StaggerItem>
                <StaggerItem>
                  <HeroCard icon={Clock} label="Per Completed Campaign" value={`~$${(portfolio.aggregate.savings_per_completed_campaign / 1000).toFixed(0)}K`} sub="120 labor hours saved at $75/hr" accent />
                </StaggerItem>
                <StaggerItem>
                  <HeroCard
                    icon={TrendingUp}
                    label="Projected Annual"
                    value={`$${(portfolio.aggregate.projected_annual_low / 1_000_000).toFixed(1)}M to $${(portfolio.aggregate.projected_annual_high / 1_000_000).toFixed(1)}M`}
                    sub={`at ${portfolio.aggregate.annual_campaign_volume_low}-${portfolio.aggregate.annual_campaign_volume_high} campaigns/year`}
                    accent
                  />
                </StaggerItem>
                <StaggerItem>
                  <HeroCard icon={Wrench} label="MCP Invocations" value={String(portfolio.quality_aggregate.total_mcp_invocations)} sub={`${portfolio.quality_aggregate.total_compliance_findings} compliance findings`} />
                </StaggerItem>
              </StaggerContainer>

              {/* Campaign comparison bars */}
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {portfolio.campaigns.map((c) => (
                  <CampaignComparisonBar key={c.campaign_id} campaign={c} />
                ))}
              </div>

              {/* Per-step estimates (global, applies to all campaigns) */}
              <div className="mt-4 rounded-lg border border-charcoal/10 bg-white p-5">
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-charcoal/50">
                  Per-Step Labor Savings (Before GenAI vs After GenAI)
                </h3>
                <p className="mb-3 text-[11px] text-charcoal/45">
                  Actual hands-on labor hours per step (not elapsed calendar days). Elapsed days include waiting and handoffs; labor hours count only active work. From estimates.md.
                </p>
                <table className="w-full">
                  <thead>
                    <tr className="text-xs font-medium uppercase tracking-wider text-charcoal/40">
                      <th className="pb-2 text-left">Step</th>
                      <th className="pb-2 text-right">Before (hrs)</th>
                      <th className="pb-2 text-right">After (hrs)</th>
                      <th className="pb-2 pl-3">Comparison</th>
                      <th className="pb-2 text-right">Saved</th>
                      <th className="pb-2 text-right">$ Saved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(portfolio.campaigns[0]?.steps ?? []).map((s, i) => (
                      <StepBar key={s.step} step={s} maxBaseline={maxBaseline} index={i} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Extrapolation note */}
              <div className="mt-4 rounded-lg border border-teal-200/50 bg-teal-50/30 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-teal-600">Extrapolation</div>
                <p className="mt-1 text-[12px] leading-relaxed text-charcoal/70">
                  At {portfolio.aggregate.annual_campaign_volume_low} to {portfolio.aggregate.annual_campaign_volume_high} campaigns
                  per year (~${(portfolio.aggregate.savings_per_completed_campaign / 1000).toFixed(0)}K saved per completed campaign
                  at ${portfolio.aggregate.hourly_rate}/hr), projected annual labor savings
                  range from <strong>${(portfolio.aggregate.projected_annual_low / 1_000_000).toFixed(1)}M</strong> to{" "}
                  <strong>${(portfolio.aggregate.projected_annual_high / 1_000_000).toFixed(1)}M</strong>.
                  This is a class-context estimate using reasoned assumptions, not a guaranteed projection.
                </p>
              </div>

              {/* Named benchmark sources */}
              <div className="mt-3 rounded-lg border border-violet-200/50 bg-violet-50/20 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-violet-600">Named Industry Benchmarks</div>
                <p className="mt-1 text-[12px] leading-relaxed text-charcoal/70">
                  Our 70 to 80 percent cycle time reduction sits inside published benchmarks:{" "}
                  <strong>BCG (2025)</strong> reports about a fourfold speedup (roughly 75 percent reduction)
                  on AI augmented marketing campaigns, with Reckitt achieving 60 percent faster concept development.{" "}
                  <strong>BCG (2024)</strong> found about 50 percent time saved on content generation and
                  up to 95 percent cost reduction on highly templated content.{" "}
                  <strong>McKinsey (2023)</strong> reports campaign cycles dropping from months to weeks or days,
                  with marketing and sales capturing about 75 percent of generative AI&apos;s total estimated value.
                </p>
              </div>

              {/* Costs not netted */}
              <div className="mt-3 rounded-lg border border-amber-200/50 bg-amber-50/20 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">Costs Not Yet Netted</div>
                <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-charcoal/70">
                  <li><strong>AI API costs:</strong> {portfolio.costs_not_netted.ai_api_cost_per_campaign} per campaign run ({portfolio.costs_not_netted.ai_api_note})</li>
                  <li><strong>Pattern 4 rework:</strong> {portfolio.costs_not_netted.pattern4_rework_per_campaign} ({portfolio.costs_not_netted.pattern4_note})</li>
                </ul>
              </div>

              {/* Campaign volume breakdown (expandable) */}
              <div className="mt-3 rounded-lg border border-charcoal/8 bg-white">
                <button
                  type="button"
                  onClick={() => setBreakdownOpen((v) => !v)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left"
                >
                  {breakdownOpen
                    ? <ChevronDown className="h-3.5 w-3.5 text-charcoal/40" />
                    : <ChevronRight className="h-3.5 w-3.5 text-charcoal/40" />}
                  <span className="text-[12px] font-medium text-charcoal/70">
                    Where does the {portfolio.aggregate.annual_campaign_volume_low} to {portfolio.aggregate.annual_campaign_volume_high} campaigns per year estimate come from?
                  </span>
                </button>
                {breakdownOpen && (
                  <div className="border-t border-charcoal/5 px-4 py-4">
                    <table className="w-full text-[11px]">
                      <thead className="text-xs uppercase text-charcoal/40">
                        <tr>
                          <th className="pb-2 text-left font-medium">Campaign source</th>
                          <th className="pb-2 text-right font-medium">Annual count</th>
                          <th className="pb-2 text-left pl-4 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-charcoal/5">
                          <td className="py-2 text-charcoal/70">Weekly promotional campaigns</td>
                          <td className="py-2 text-right font-medium text-charcoal">~52</td>
                          <td className="py-2 pl-4 text-charcoal/50">Macy&apos;s documented weekly promo slot running through the year</td>
                        </tr>
                        <tr className="border-t border-charcoal/5">
                          <td className="py-2 text-charcoal/70">Major event-driven campaigns</td>
                          <td className="py-2 text-right font-medium text-charcoal">10-15</td>
                          <td className="py-2 pl-4 text-charcoal/50">Mother&apos;s Day, Black Friday, Christmas, Valentine&apos;s Day, and similar tentpole events</td>
                        </tr>
                        <tr className="border-t border-charcoal/5">
                          <td className="py-2 text-charcoal/70">Brand-specific launches</td>
                          <td className="py-2 text-right font-medium text-charcoal">5-10</td>
                          <td className="py-2 pl-4 text-charcoal/50">New product launches, exclusive collections, vendor co-op events (e.g., Lancome Spring, Coach Capsule)</td>
                        </tr>
                        <tr className="border-t border-charcoal/5 font-semibold">
                          <td className="py-2 text-charcoal">Total distinct campaigns</td>
                          <td className="py-2 text-right text-teal-700">65-100</td>
                          <td className="py-2 pl-4 text-charcoal/60">Each unique campaign counted once, regardless of overlapping classifications</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="mt-3 text-[11px] leading-relaxed text-charcoal/55">
                      A single Macy&apos;s campaign can be classified multiple ways simultaneously. The Mother&apos;s Day
                      Beauty Event, for example, is a weekly campaign slot, a seasonal Spring campaign, a vendor co-op
                      campaign (Lancome and Estee Lauder share funding), an event-driven campaign (Mother&apos;s Day),
                      and a Star Rewards loyalty campaign. We count each distinct campaign once. This range is a reasoned
                      estimate from Macy&apos;s documented operations, public reporting, and industry norms. Actual volume
                      would require internal data to confirm.
                    </p>
                  </div>
                )}
              </div>
            </FadeInView>
          </>
        )}
      </div>
    </PageTransition>
  );
}
