"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Clock,
  DollarSign,
  AlertTriangle,
  Zap,
} from "lucide-react";

import { API_BASE } from "@/lib/api";
import { PageTransition, PulsingDots } from "@/components/motion";

type DashboardData = {
  stats: {
    active_campaigns: number;
    completed_campaigns: number;
    planned_campaigns: number;
    total_campaigns: number;
    pending_escalations: number;
    recent_actions: number;
    hours_saved_total: number;
    dollars_saved_total: number;
  };
  campaigns: Array<{
    campaign_id: string;
    name: string;
    status: string;
    current_step: number;
    current_step_name: string;
    completed_step_count: number;
    hours_saved: number;
  }>;
  recent_activity: Array<Record<string, unknown>>;
  escalations: Array<Record<string, unknown>>;
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-green-100", text: "text-green-700" },
  completed: { bg: "bg-gray-100", text: "text-gray-600" },
  planned: { bg: "bg-amber-100", text: "text-amber-700" },
};

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: typeof Clock;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`card-hover rounded-lg border p-4 ${accent ? "border-teal-200 bg-teal-50/40" : "border-charcoal/10 bg-white"}`}>
      <Icon className={`h-4 w-4 ${accent ? "text-teal-600" : "text-charcoal/40"}`} />
      <div className={`mt-2 font-serif text-2xl font-bold ${accent ? "text-teal-700" : "text-charcoal"}`}>{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-charcoal/40">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/dashboard/overview`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream/30">
        <PulsingDots text="Loading dashboard" />
      </div>
    );
  }

  return (
    <PageTransition className="min-h-screen bg-cream/30">
      <div className="border-b border-charcoal/10 bg-white px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-600 hover:text-teal-700 mb-2">
            <ArrowLeft className="h-3 w-3" /> Back
          </Link>
          <h1 className="font-serif text-2xl font-bold text-charcoal">Dashboard</h1>
          <p className="mt-1 text-[13px] text-charcoal/60">Operational overview across all campaigns.</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={Activity} label="Active Campaigns" value={String(data.stats.active_campaigns)} sub={`${data.stats.total_campaigns} total`} accent />
          <StatCard icon={AlertTriangle} label="Pending Escalations" value={String(data.stats.pending_escalations)} />
          <StatCard icon={Clock} label="Hours Saved" value={`${data.stats.hours_saved_total}h`} sub={`$${data.stats.dollars_saved_total.toLocaleString()} at $75/hr`} accent />
          <StatCard icon={Zap} label="Recent Actions" value={String(data.stats.recent_actions)} sub="across all campaigns" />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Active Campaigns */}
          <div className="rounded-lg border border-charcoal/10 bg-white p-5">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-charcoal/50">Campaigns</h2>
            {data.campaigns.length === 0 ? (
              <p className="text-[12px] italic text-charcoal/40">No campaigns yet. <Link href="/start" className="text-teal-600 underline">Create one</Link>.</p>
            ) : (
              <div className="space-y-2">
                {data.campaigns.map((c) => {
                  const style = STATUS_COLORS[c.status] ?? STATUS_COLORS.planned;
                  return (
                    <Link
                      key={c.campaign_id}
                      href="/campaign-manager"
                      className="flex items-center justify-between rounded-md border border-charcoal/8 px-3 py-2.5 hover:border-charcoal/20 transition-colors"
                    >
                      <div>
                        <div className="text-[12px] font-semibold text-charcoal">{c.name}</div>
                        <div className="text-xs text-charcoal/50">Step {c.current_step}: {c.current_step_name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-teal-600">{c.hours_saved}h saved</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${style.bg} ${style.text}`}>
                          {c.status}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="rounded-lg border border-charcoal/10 bg-white p-5">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-charcoal/50">Recent Activity</h2>
            {data.recent_activity.length === 0 ? (
              <p className="text-[12px] italic text-charcoal/40">No recent activity. Walk through a campaign to generate entries.</p>
            ) : (
              <div className="space-y-2">
                {data.recent_activity.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border border-charcoal/5 px-3 py-2">
                    <BarChart3 className="mt-0.5 h-3 w-3 flex-shrink-0 text-teal-500" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-charcoal/70">
                        <strong>{String(entry.action ?? "Action")}</strong> on {String(entry.campaign_name ?? "")}
                      </div>
                      <div className="text-xs text-charcoal/40">
                        {entry.persona ? `by ${String(entry.persona)}` : ""} · Step {String(entry.step_id ?? "")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Escalations */}
        {data.escalations.length > 0 && (
          <div id="escalations" className="rounded-lg border border-amber-200 bg-amber-50/30 p-5 scroll-mt-20">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              <AlertTriangle className="mr-1 inline h-3 w-3" />
              Pending Escalations ({data.escalations.length})
            </h2>
            <div className="space-y-2">
              {data.escalations.map((esc, i) => (
                <div key={i} className="rounded-md border border-amber-200/50 bg-white px-3 py-2 text-[11px] text-charcoal/70">
                  <strong>{String(esc.campaign_name)}</strong>: {String(esc.reason ?? "Escalated for review")}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
