"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, ArrowLeftCircle } from "lucide-react";

import { callRouteRevision, type RouteRevisionResult } from "@/lib/ai_client";

function AIBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: "#D4A8431A", color: "#B8922E", border: "1px solid #D4A84330" }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-gold" />
      AI Skill
    </span>
  );
}

function changeTypeColor(t: string): { bg: string; text: string } {
  const lower = t.toLowerCase();
  if (lower.includes("copy") || lower.includes("text")) return { bg: "#0B7B8A1A", text: "#0B7B8A" };
  if (lower.includes("imag") || lower.includes("visual") || lower.includes("design")) return { bg: "#D4A8431A", text: "#B8922E" };
  if (lower.includes("target") || lower.includes("audience")) return { bg: "#8DA67E1A", text: "#6B8A5E" };
  if (lower.includes("pric") || lower.includes("cost")) return { bg: "#C973731A", text: "#B55A5A" };
  if (lower.includes("legal") || lower.includes("compliance")) return { bg: "#C973731A", text: "#B55A5A" };
  return { bg: "#78716C1A", text: "#57534E" };
}

function urgencyColor(u: string): { bg: string; text: string } {
  const lower = u.toLowerCase();
  if (lower.includes("high") || lower.includes("urgent")) return { bg: "#C973731A", text: "#B55A5A" };
  if (lower.includes("medium") || lower.includes("moderate")) return { bg: "#D49B431A", text: "#B8842E" };
  return { bg: "#8DA67E1A", text: "#6B8A5E" };
}

const OWNER_OPTIONS = [
  { id: "campaign-manager", name: "Merna", title: "Campaign Manager" },
  { id: "senior-designer", name: "Abdullah", title: "Senior Designer" },
  { id: "production-artist", name: "Shankar", title: "Production Artist" },
  { id: "marketing-analyst", name: "Anna", title: "Marketing Analyst" },
];

export function AIRevisionRouting({
  revisionComment,
  campaignId,
  campaignContext,
  onConfirm,
  onCancel,
}: {
  revisionComment: string;
  campaignId: string;
  campaignContext: Record<string, unknown>;
  onConfirm: (routingMetadata: RouteRevisionResult) => void;
  onCancel: () => void;
}) {
  const [result, setResult] = useState<RouteRevisionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideOwner, setOverrideOwner] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    callRouteRevision({
      campaign_id: campaignId,
      revision_comment: revisionComment,
      campaign_context: campaignContext,
    })
      .then((r) => {
        if (!cancelled) {
          setResult(r);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId, revisionComment, campaignContext]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-panel bg-white shadow-overlay animate-fade-up">
        <header className="flex items-center justify-between border-b border-charcoal/[0.06] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ArrowLeftCircle className="h-5 w-5 text-teal-600" />
            <h2 className="font-display text-xl font-semibold text-charcoal">
              Revision Routing
            </h2>
          </div>
          <AIBadge />
        </header>

        <div className="px-6 py-5">
          {loading && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-stone">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
                Analyzing revision request...
              </div>
              <div className="space-y-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-charcoal/8" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-charcoal/8" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-charcoal/8" />
              </div>
            </div>
          )}

          {error && (
            <div className="space-y-4">
              <div className="rounded-card border border-amber/30 bg-amber/5 p-4 text-xs text-charcoal/70">
                AI temporarily unavailable. You may route this revision manually.
                <div className="mt-1.5 text-[10px] text-stone/60">{error}</div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-card border border-charcoal/10 bg-white px-4 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-cream"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onConfirm({
                      change_type: "unknown",
                      owner: "campaign-manager",
                      one_line_summary: revisionComment,
                      urgency: "medium",
                    })
                  }
                  className="rounded-card bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
                >
                  Proceed Without AI Routing
                </button>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              <p className="text-[12px] text-stone">AI parsed this revision as:</p>

              <div className="space-y-3 rounded-card border border-charcoal/[0.06] bg-cream/40 p-5">
                {[
                  {
                    label: "Change Type",
                    render: () => {
                      const c = changeTypeColor(result.change_type);
                      return (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          style={{ backgroundColor: c.bg, color: c.text }}
                        >
                          {result.change_type}
                        </span>
                      );
                    },
                  },
                  {
                    label: "Suggested Owner",
                    render: () => (
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-[11px] font-semibold text-teal-600">
                          {result.owner.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-[13px] font-medium text-charcoal">{result.owner}</span>
                      </div>
                    ),
                  },
                  {
                    label: "Urgency",
                    render: () => {
                      const c = urgencyColor(result.urgency);
                      return (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          style={{ backgroundColor: c.bg, color: c.text }}
                        >
                          {result.urgency}
                        </span>
                      );
                    },
                  },
                ].map((field) => (
                  <div key={field.label} className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone">
                      {field.label}
                    </span>
                    {field.render()}
                  </div>
                ))}

                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone">
                    Summary
                  </span>
                  <p className="ai-accent mt-1 text-[13px] text-charcoal/75">
                    {result.one_line_summary}
                  </p>
                </div>
              </div>

              {overrideMode && (
                <div className="rounded-card border border-charcoal/[0.06] bg-cream/30 p-4">
                  <label className="block text-xs font-semibold text-stone">
                    Select a different owner:
                  </label>
                  <select
                    value={overrideOwner}
                    onChange={(e) => setOverrideOwner(e.target.value)}
                    className="mt-2 w-full rounded-card border border-charcoal/10 bg-white px-4 py-2.5 text-sm text-charcoal focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600/20"
                  >
                    <option value="">Choose owner...</option>
                    {OWNER_OPTIONS.map((o) => (
                      <option key={o.id} value={o.name}>
                        {o.name} ({o.title})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {result && !loading && (
          <footer className="flex items-center justify-end gap-3 border-t border-charcoal/[0.06] px-6 py-4">
            {!overrideMode ? (
              <>
                <button
                  type="button"
                  onClick={() => setOverrideMode(true)}
                  className="rounded-card border border-charcoal/10 bg-white px-4 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-cream"
                >
                  Override Routing
                </button>
                <button
                  type="button"
                  onClick={() => onConfirm(result)}
                  className="inline-flex items-center gap-2 rounded-card bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirm and Route
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setOverrideMode(false)}
                  className="rounded-card border border-charcoal/10 bg-white px-4 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-cream"
                >
                  Cancel Override
                </button>
                <button
                  type="button"
                  disabled={!overrideOwner}
                  onClick={() =>
                    onConfirm({ ...result, owner: overrideOwner })
                  }
                  className="inline-flex items-center gap-2 rounded-card bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirm with Override
                </button>
              </>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}
