"use client";

import { useEffect, useState } from "react";

import { fetchCampaigns, type Campaign } from "@/lib/api";

const STATUS_STYLE: Record<
  Campaign["status"],
  { dot: string; pillBg: string; pillText: string; label: string }
> = {
  active: { dot: "#16a34a", pillBg: "#dcfce7", pillText: "#15803d", label: "ACTIVE" },
  planned: { dot: "#ca8a04", pillBg: "#fef9c3", pillText: "#854d0e", label: "PLANNED" },
  completed: { dot: "#9ca3af", pillBg: "#e5e7eb", pillText: "#4b5563", label: "COMPLETED" },
};

// Default selected campaign is the active one (the demo campaign that all
// skills run against). The demo doesn't actually re-fetch data when a
// different campaign is clicked yet, so this is just visual state.
const DEFAULT_SELECTED_ID = "MDC-2026-MD-001";

export function CampaignSidebar() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_SELECTED_ID);

  useEffect(() => {
    let cancelled = false;
    fetchCampaigns()
      .then((data) => {
        if (cancelled) return;
        setCampaigns(data);
        // If the default isn't in the list, fall back to the first one.
        if (!data.some((c) => c.id === DEFAULT_SELECTED_ID) && data.length > 0) {
          setSelectedId(data[0].id);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="border-b border-charcoal/10 px-4 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/55">
          Campaigns
        </h2>
        {campaigns && (
          <span className="text-[10px] text-charcoal/40">{campaigns.length}</span>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-soft_red">Could not load campaigns.</p>
      )}

      {!campaigns && !error && (
        <p className="text-[11px] text-charcoal/40">Loading…</p>
      )}

      <ul className="space-y-1.5">
        {(campaigns ?? []).map((c) => {
          const style = STATUS_STYLE[c.status];
          const selected = c.id === selectedId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelectedId(c.id)}
                title={`${c.name} — ${c.owner_role}`}
                className={`block w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                  selected
                    ? "border-teal-600 bg-teal-50"
                    : "border-charcoal/10 bg-white hover:border-charcoal/25"
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-charcoal leading-tight">
                      {c.name}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-charcoal/55">
                      {c.id}
                    </div>
                  </div>
                  <span
                    className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
                    style={{ backgroundColor: style.pillBg, color: style.pillText }}
                  >
                    {style.label}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-charcoal/65">
                  <span className="truncate">
                    Step {c.current_step}: {c.current_step_name}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: style.dot }}
                  />
                  <span className="text-charcoal/55">{c.days_label}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
