"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import { API_BASE, fetchCampaigns, type Campaign } from "@/lib/api";
import { PageTransition, PulsingDots } from "@/components/motion";

type Filter = "all" | "active" | "planned" | "completed";

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  planned: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  completed: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    fetchCampaigns().then(setCampaigns).catch(() => {});
  }, []);

  const filtered = campaigns?.filter((c) => filter === "all" || c.status === filter) ?? [];

  return (
    <PageTransition className="min-h-screen bg-cream/30">
      <div className="border-b border-charcoal/10 bg-white px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-600 hover:text-teal-700 mb-2">
            <ArrowLeft className="h-3 w-3" /> Back
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-2xl font-bold text-charcoal">Campaigns</h1>
              <p className="mt-1 text-[13px] text-charcoal/60">All marketing campaigns with status and progress.</p>
            </div>
            <Link
              href="/start"
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" /> New Campaign
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">
        {/* Filter pills */}
        <div className="flex gap-2">
          {(["all", "active", "planned", "completed"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-teal-600 text-white"
                  : "border border-charcoal/15 bg-white text-charcoal/60 hover:bg-cream"
              }`}
            >
              {f}
              {campaigns && (
                <span className="ml-1 text-[10px] opacity-70">
                  ({f === "all" ? campaigns.length : campaigns.filter((c) => c.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Campaign grid */}
        {!campaigns ? (
          <div className="flex items-center gap-2 text-sm text-charcoal/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            Loading campaigns...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-charcoal/10 bg-white p-8 text-center">
            <p className="text-[13px] text-charcoal/50">No {filter === "all" ? "" : filter} campaigns found.</p>
            <Link href="/start" className="mt-2 inline-block text-[12px] text-teal-600 underline">Create a new campaign</Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => {
              const style = STATUS_STYLE[c.status] ?? STATUS_STYLE.planned;
              const progress = Math.round((c.current_step / 10) * 100);
              return (
                <Link
                  key={c.id}
                  href="/campaign-manager"
                  className="card-hover block rounded-lg border border-charcoal/10 bg-white p-5 transition-all hover:border-teal-300"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold text-charcoal truncate">{c.name}</h3>
                      <div className="mt-0.5 text-[10px] font-mono text-charcoal/40">{c.id}</div>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${style.bg} ${style.text}`}>
                      {c.status}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-charcoal/50">Step {c.current_step} of 10</span>
                      <span className="text-[10px] font-medium text-charcoal/60">{progress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-charcoal/8">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] text-charcoal/55">
                    {c.current_step_name}
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-[10px]">
                    <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                    <span className="text-charcoal/50">{c.days_label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
