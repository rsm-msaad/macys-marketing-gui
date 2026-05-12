"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, ArrowLeftCircle } from "lucide-react";

import { callRouteRevision, type RouteRevisionResult } from "@/lib/ai_client";

function AIBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-600">
      AI
    </span>
  );
}

function changeTypeColor(t: string): string {
  const lower = t.toLowerCase();
  if (lower.includes("copy") || lower.includes("text")) return "bg-teal-50 text-teal-600";
  if (lower.includes("imag") || lower.includes("visual") || lower.includes("design")) return "bg-mustard/15 text-mustard";
  if (lower.includes("target") || lower.includes("audience")) return "bg-sage/15 text-sage";
  if (lower.includes("pric") || lower.includes("cost")) return "bg-soft_red/15 text-soft_red";
  if (lower.includes("legal") || lower.includes("compliance")) return "bg-soft_red/15 text-soft_red";
  return "bg-charcoal/10 text-charcoal/70";
}

function urgencyColor(u: string): string {
  const lower = u.toLowerCase();
  if (lower.includes("high") || lower.includes("urgent")) return "bg-soft_red/15 text-soft_red";
  if (lower.includes("medium") || lower.includes("moderate")) return "bg-mustard/15 text-mustard";
  return "bg-sage/15 text-sage";
}

const OWNER_OPTIONS = [
  { id: "campaign-manager", name: "Sarah", title: "Campaign Manager" },
  { id: "senior-designer", name: "Priya", title: "Senior Designer" },
  { id: "production-artist", name: "Diego", title: "Production Artist" },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-charcoal/10 px-5 py-3">
          <div className="flex items-center gap-2">
            <ArrowLeftCircle className="h-5 w-5 text-teal-600" />
            <h2 className="font-serif text-lg font-semibold text-charcoal">
              AI Revision Routing
            </h2>
          </div>
          <AIBadge />
        </header>

        <div className="px-5 py-4">
          {loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-charcoal/55">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
                Analyzing revision request...
              </div>
              <div className="space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-charcoal/10" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-charcoal/10" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-charcoal/10" />
              </div>
            </div>
          )}

          {error && (
            <div className="space-y-3">
              <div className="rounded-md border border-mustard/30 bg-mustard/5 p-3 text-xs text-charcoal/70">
                AI temporarily unavailable. You may route this revision manually.
                <div className="mt-1 text-[10px] text-charcoal/45">{error}</div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-md border border-charcoal/15 bg-white px-3.5 py-2 text-sm font-medium text-charcoal hover:bg-cream"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onConfirm({
                      change_type: "unknown",
                      suggested_owner: "campaign-manager",
                      one_line_summary: revisionComment,
                      urgency: "medium",
                    })
                  }
                  className="rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Proceed Without AI Routing
                </button>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-3">
              <p className="text-xs text-charcoal/60">AI parsed this revision as:</p>

              <div className="space-y-2 rounded-md border border-charcoal/10 bg-cream/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">
                    Change Type
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${changeTypeColor(result.change_type)}`}>
                    {result.change_type}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">
                    Suggested Owner
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-[10px] font-semibold text-teal-600">
                      {result.suggested_owner.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-charcoal">{result.suggested_owner}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">
                    Summary
                  </span>
                  <p className="mt-0.5 text-sm text-charcoal/80">{result.one_line_summary}</p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">
                    Urgency
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${urgencyColor(result.urgency)}`}>
                    {result.urgency}
                  </span>
                </div>
              </div>

              {overrideMode && (
                <div className="rounded-md border border-charcoal/10 bg-cream/20 p-3">
                  <label className="block text-xs font-semibold text-charcoal/60">
                    Select a different owner:
                  </label>
                  <select
                    value={overrideOwner}
                    onChange={(e) => setOverrideOwner(e.target.value)}
                    className="mt-1 w-full rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm text-charcoal focus:border-teal-600 focus:outline-none"
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
          <footer className="flex items-center justify-end gap-2 border-t border-charcoal/10 px-5 py-3">
            {!overrideMode ? (
              <>
                <button
                  type="button"
                  onClick={() => setOverrideMode(true)}
                  className="rounded-md border border-charcoal/15 bg-white px-3.5 py-2 text-sm font-medium text-charcoal hover:bg-cream"
                >
                  Override Routing
                </button>
                <button
                  type="button"
                  onClick={() => onConfirm(result)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700"
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
                  className="rounded-md border border-charcoal/15 bg-white px-3.5 py-2 text-sm font-medium text-charcoal hover:bg-cream"
                >
                  Cancel Override
                </button>
                <button
                  type="button"
                  disabled={!overrideOwner}
                  onClick={() =>
                    onConfirm({ ...result, suggested_owner: overrideOwner })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
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
