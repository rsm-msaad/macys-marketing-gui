"use client";

import { useEffect, useState } from "react";

import { fetchCampaigns, type Campaign } from "@/lib/api";

const STATUS_STYLE: Record<
  Campaign["status"],
  { dot: string; pillBg: string; pillText: string; label: string }
> = {
  active: { dot: "#8DA67E", pillBg: "#8DA67E1A", pillText: "#6B8A5E", label: "ACTIVE" },
  planned: { dot: "#D4A843", pillBg: "#D4A8431A", pillText: "#B8922E", label: "PLANNED" },
  completed: { dot: "#78716C", pillBg: "#78716C1A", pillText: "#57534E", label: "COMPLETED" },
};

const DEFAULT_SELECTED_ID = "MDC-2026-MD-001";

export function CampaignSidebar({
  campaigns: campaignsProp,
  activeOwnerName,
}: {
  campaigns?: Campaign[];
  activeOwnerName?: string | null;
}) {
  const [fetched, setFetched] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_SELECTED_ID);

  useEffect(() => {
    if (campaignsProp !== undefined) return;
    let cancelled = false;
    fetchCampaigns()
      .then((data) => {
        if (!cancelled) setFetched(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignsProp]);

  const campaigns = campaignsProp ?? fetched;

  return (
    <section className="border-b border-charcoal/[0.06] px-5 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone">
          Campaigns
        </h2>
        {campaigns && (
          <span className="text-[10px] text-stone/60">{campaigns.length}</span>
        )}
      </div>

      {error && <p className="text-[11px] text-rose">Could not load campaigns.</p>}
      {!campaigns && !error && <p className="text-[11px] text-stone">Loading...</p>}

      <ul className="space-y-2">
        {(campaigns ?? []).map((c) => {
          const style = STATUS_STYLE[c.status];
          const selected = c.id === selectedId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelectedId(c.id)}
                title={`${c.name}`}
                className={`block w-full rounded-card border px-4 py-3 text-left transition-all ${
                  selected
                    ? "border-teal-600/40 bg-teal-50 shadow-subtle"
                    : "border-charcoal/[0.06] bg-white hover:border-charcoal/15 hover:shadow-subtle"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-charcoal leading-tight">
                      {c.name}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-stone/60">
                      {c.id}
                    </div>
                  </div>
                  <span
                    className="flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wider"
                    style={{ backgroundColor: style.pillBg, color: style.pillText }}
                  >
                    {style.label}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-stone">
                  Step {c.current_step}: {c.current_step_name}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: style.dot }}
                  />
                  <span className="text-stone/60">{c.days_label}</span>
                </div>
                {c.status === "active" && activeOwnerName && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-teal-600">
                    Awaiting {activeOwnerName}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
