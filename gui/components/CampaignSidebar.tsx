"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { fetchCampaigns, type Campaign, type CampaignBrief } from "@/lib/api";
import { CampaignEditModal } from "@/components/CampaignEditModal";

const STATUS_STYLE: Record<
  Campaign["status"],
  { dot: string; pillBg: string; pillText: string; label: string }
> = {
  active: { dot: "#16a34a", pillBg: "#dcfce7", pillText: "#15803d", label: "ACTIVE" },
  planned: { dot: "#ca8a04", pillBg: "#fef9c3", pillText: "#854d0e", label: "PLANNED" },
  completed: { dot: "#9ca3af", pillBg: "#e5e7eb", pillText: "#4b5563", label: "COMPLETED" },
};

const DEFAULT_SELECTED_ID = "MDC-2026-MD-001";

export function CampaignSidebar({
  campaigns: campaignsProp,
  activeOwnerName,
  selectedCampaignId,
  onSelectCampaign,
}: {
  campaigns?: Campaign[];
  activeOwnerName?: string | null;
  selectedCampaignId?: string;
  onSelectCampaign?: (id: string) => void;
}) {
  const router = useRouter();
  const [fetched, setFetched] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localSelectedId, setLocalSelectedId] = useState<string>(DEFAULT_SELECTED_ID);
  const selectedId = selectedCampaignId ?? localSelectedId;
  const setSelectedId = onSelectCampaign ?? setLocalSelectedId;
  const [editModal, setEditModal] = useState<{
    mode: "create" | "edit";
    brief: CampaignBrief | null;
  } | null>(null);

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

  function handleEditClick(c: Campaign) {
    // Build a minimal brief from the campaign list item for the modal.
    // Full brief data will be loaded by the modal if needed.
    const brief: CampaignBrief = {
      campaign_id: c.id,
      name: c.name,
      sponsor: "",
      filed_days_before_launch: c.days_remaining,
      objective: "",
      target_customer: "",
      promotional_offer: [],
      campaign_window: { soft_launch: "", peak: "", closeout: "" },
      budget: {},
      success_metrics: {},
      constraints: [],
    };
    setEditModal({ mode: "edit", brief });
  }

  return (
    <section className="border-b border-charcoal/10 px-4 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/55">
          Campaigns
        </h2>
        <button
          type="button"
          onClick={() => router.push("/start")}
          className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-teal-700"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </div>

      {error && <p className="text-[11px] text-soft_red">Could not load campaigns.</p>}
      {!campaigns && !error && <p className="text-[11px] text-charcoal/40">Loading...</p>}

      <ul className="space-y-1.5">
        {(campaigns ?? []).map((c) => {
          const style = STATUS_STYLE[c.status];
          const selected = c.id === selectedId;
          return (
            <li key={c.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(c.id)}
                onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(c.id); }}
                title={c.name}
                className={`relative block w-full cursor-pointer rounded-xl border px-2.5 py-2 text-left transition-all duration-300 ${
                  selected
                    ? "sidebar-campaign-active border-teal-600/30"
                    : "border-white/50 bg-white/60 backdrop-blur-sm hover:bg-white/80 hover:border-charcoal/20"
                }`}
              >
                {/* Edit icon */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditClick(c);
                  }}
                  className="absolute right-2 top-2 rounded p-1 text-charcoal/40 hover:bg-cream hover:text-charcoal/70"
                  title="Edit campaign"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>

                <div className="flex items-start justify-between gap-1 pr-6">
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
                <div className="mt-1.5 text-[10px] text-charcoal/65">
                  Step {c.current_step}: {c.current_step_name}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: style.dot }}
                  />
                  <span className="text-charcoal/55">{c.days_label}</span>
                </div>
                {c.status === "active" && activeOwnerName && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-teal-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-teal-700">
                    Awaiting {activeOwnerName}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {editModal && (
        <CampaignEditModal
          mode={editModal.mode}
          brief={editModal.brief}
          onClose={() => setEditModal(null)}
          onSaved={() => {
            setEditModal(null);
            // Trigger refresh by clearing fetched so useEffect re-runs
            if (!campaignsProp) setFetched(null);
          }}
        />
      )}
    </section>
  );
}
