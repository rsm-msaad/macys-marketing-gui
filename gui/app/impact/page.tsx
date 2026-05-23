"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
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
  days_saved: number;
  hours_saved: number;
  dollars_saved: number;
};

type CampaignImpact = {
  campaign_id: string;
  campaign_name: string;
  current_step: number;
  is_complete: boolean;
  completed_step_count: number;
  hero: {
    hours_saved: number;
    dollars_saved: number;
    baseline_days: number;
    ai_supported_days: number;
    days_saved: number;
    pct_reduction: number;
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
    total_hours_saved: number;
    total_dollars_saved: number;
    avg_dollars_per_campaign: number;
    projected_annual_savings: number;
    annual_campaign_volume: number;
    hourly_rate: number;
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
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">
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
  const baselinePct = maxBaseline > 0 ? (step.baseline_days.mid / maxBaseline) * 100 : 0;
  const aiPct = maxBaseline > 0 ? (step.ai_supported_days.mid / maxBaseline) * 100 : 0;
  return (
    <tr className="border-t border-charcoal/5">
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
            step.completed ? "bg-teal-100 text-teal-700" : "bg-charcoal/8 text-charcoal/40"
          }`}>
            {step.completed ? <CheckCircle2 className="h-3 w-3" /> : step.step}
          </span>
          <span className="text-[12px] font-medium text-charcoal/80">{step.step_name}</span>
        </div>
      </td>
      <td className="py-2.5 text-right text-[11px] text-charcoal/55">{step.baseline_days.mid.toFixed(1)}d</td>
      <td className="py-2.5 text-right text-[11px] font-medium text-teal-700">{step.ai_supported_days.mid.toFixed(1)}d</td>
      <td className="py-2.5 pl-3 w-40">
        <div className="relative h-4">
          <AnimatedBar pct={baselinePct} color="rgba(45,45,45,0.1)" delay={index * 0.08} />
          <div className="absolute inset-y-0 left-0">
            <AnimatedBar pct={aiPct} color="rgba(13,148,136,0.7)" height="h-4" delay={index * 0.08 + 0.1} />
          </div>
        </div>
      </td>
      <td className="py-2.5 text-right text-[11px] font-semibold text-charcoal">{step.hours_saved}h</td>
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
      <div className="mt-0.5 text-[10px] font-medium text-charcoal/50">{label}</div>
    </div>
  );
}

function CampaignComparisonBar({ campaign }: { campaign: CampaignImpact }) {
  const maxDays = 45;
  const bPct = Math.min(100, (campaign.hero.baseline_days / maxDays) * 100);
  const aPct = Math.min(100, (campaign.hero.ai_supported_days / maxDays) * 100);
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12px] font-semibold text-charcoal">{campaign.campaign_name}</div>
          <div className="text-[10px] text-charcoal/50">
            {campaign.is_complete ? "Completed" : `Step ${campaign.current_step} of 10`}
            {" · "}{campaign.completed_step_count} steps done
          </div>
        </div>
        <div className="text-right">
          <div className="font-serif text-lg font-bold text-teal-700">${campaign.hero.dollars_saved.toLocaleString()}</div>
          <div className="text-[10px] text-charcoal/50">saved</div>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-16 text-[10px] text-charcoal/50">Baseline</span>
          <div className="flex-1 h-3 rounded bg-charcoal/8">
            <div className="h-full rounded bg-charcoal/25" style={{ width: `${bPct}%` }} />
          </div>
          <span className="w-12 text-right text-[10px] text-charcoal/55">{campaign.hero.baseline_days}d</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 text-[10px] text-teal-600 font-medium">AI</span>
          <div className="flex-1 h-3 rounded bg-charcoal/8">
            <div className="h-full rounded bg-teal-500" style={{ width: `${aPct}%` }} />
          </div>
          <span className="w-12 text-right text-[10px] font-semibold text-teal-700">{campaign.hero.ai_supported_days}d</span>
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
  const maxBaseline = selected ? Math.max(...selected.steps.map((s) => s.baseline_days.mid)) : 10;

  return (
    <PageTransition className="min-h-screen bg-cream/30">
      {/* Header */}
      <div className="border-b border-charcoal/10 bg-white px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-600 hover:text-teal-700 mb-2">
            <ArrowLeft className="h-3 w-3" /> Back to campaigns
          </Link>
          <h1 className="font-serif text-2xl font-bold text-charcoal">Impact Analysis</h1>
          <p className="mt-1 text-[13px] text-charcoal/60">
            Time, cost, and quality impact of AI-supported campaign operations vs manual baseline.
            Numbers computed live from campaign state. Baseline: $75/hr fully loaded, 30-40 business days per campaign.
          </p>
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
                  <HeroCard icon={Clock} label="Hours Saved" value="" countUp={{ end: selected.hero.hours_saved, suffix: "h", decimals: 1, duration: 1.5 }} sub={`${selected.hero.days_saved} business days`} accent />
                </StaggerItem>
                <StaggerItem>
                  <HeroCard icon={DollarSign} label="Dollar Savings" value="" countUp={{ end: selected.hero.dollars_saved, prefix: "$", duration: 1.8 }} sub="at $75/hr fully loaded" accent />
                </StaggerItem>
                <StaggerItem>
                  <HeroCard icon={TrendingUp} label="Cycle Reduction" value="" countUp={{ end: selected.hero.pct_reduction, suffix: "%", duration: 1.2 }} sub={`${selected.hero.baseline_days}d → ${selected.hero.ai_supported_days}d`} />
                </StaggerItem>
                <StaggerItem>
                  <HeroCard icon={Zap} label="Steps Completed" value={`${selected.completed_step_count}/10`} sub={selected.is_complete ? "Campaign complete" : `Currently at Step ${selected.current_step}`} />
                </StaggerItem>
              </StaggerContainer>

              {/* Per-step table */}
              <FadeInView className="mt-6 rounded-lg border border-charcoal/10 bg-white p-5">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-charcoal/50">Per-Step Breakdown</h3>
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-medium uppercase tracking-wider text-charcoal/40">
                      <th className="pb-2 text-left">Step</th>
                      <th className="pb-2 text-right">Baseline</th>
                      <th className="pb-2 text-right">AI-Supported</th>
                      <th className="pb-2 pl-3">Comparison</th>
                      <th className="pb-2 text-right">Hours Saved</th>
                      <th className="pb-2 text-right">$ Saved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.steps.map((s, i) => (
                      <StepBar key={s.step} step={s} maxBaseline={maxBaseline} index={i} />
                    ))}
                  </tbody>
                </table>
              </FadeInView>

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
                  <HeroCard icon={DollarSign} label="Total Savings" value="" countUp={{ end: portfolio.aggregate.total_dollars_saved, prefix: "$", duration: 2 }} sub={`across ${portfolio.campaign_count} campaigns`} accent />
                </StaggerItem>
                <StaggerItem>
                  <HeroCard icon={Clock} label="Total Hours Saved" value="" countUp={{ end: portfolio.aggregate.total_hours_saved, suffix: "h", decimals: 1, duration: 1.5 }} sub={`avg $${portfolio.aggregate.avg_dollars_per_campaign.toLocaleString()}/campaign`} accent />
                </StaggerItem>
                <StaggerItem>
                  <HeroCard icon={TrendingUp} label="Projected Annual" value="" countUp={{ end: portfolio.aggregate.projected_annual_savings / 1_000_000, prefix: "$", suffix: "M", decimals: 1, duration: 2.2 }} sub={`at ${portfolio.aggregate.annual_campaign_volume} campaigns/year`} accent />
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

              {/* Extrapolation note */}
              <div className="mt-4 rounded-lg border border-teal-200/50 bg-teal-50/30 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">Extrapolation</div>
                <p className="mt-1 text-[12px] leading-relaxed text-charcoal/70">
                  If Macy&apos;s runs {portfolio.aggregate.annual_campaign_volume} campaigns per year at this
                  efficiency rate (avg ${portfolio.aggregate.avg_dollars_per_campaign.toLocaleString()} saved per campaign
                  at ${portfolio.aggregate.hourly_rate}/hr), projected annual labor savings
                  approach <strong>${(portfolio.aggregate.projected_annual_savings / 1_000_000).toFixed(1)}M</strong>.
                  This is a class-context estimate using industry-standard assumptions, not a guaranteed projection.
                </p>
              </div>
            </FadeInView>
          </>
        )}
      </div>
    </PageTransition>
  );
}
