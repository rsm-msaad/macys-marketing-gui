"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { callCascade, type CascadeResult } from "@/lib/ai_client";

function AIBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-teal-600">
      AI
    </span>
  );
}

type StageStatus = "pending" | "running" | "done";

function StageRow({ label, status }: { label: string; status: StageStatus }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {status === "done" && <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-sage" />}
      {status === "running" && <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-teal-600" />}
      {status === "pending" && <div className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-charcoal/15" />}
      <span
        className={`text-sm ${
          status === "done"
            ? "font-medium text-charcoal"
            : status === "running"
              ? "font-medium text-teal-600"
              : "text-charcoal/45"
        }`}
      >
        {label}
        {status === "done" && " \u2713"}
      </span>
    </div>
  );
}

export function ApprovalCascade({
  campaignId,
  campaignContext,
  onDone,
}: {
  campaignId: string;
  campaignContext: Record<string, unknown>;
  onDone: () => void;
}) {
  const [result, setResult] = useState<CascadeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<StageStatus[]>(["done", "running", "pending"]);
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    // Already fired for this campaign? Skip re-firing.
    if (firedRef.current === campaignId) return;
    firedRef.current = campaignId;

    let cancelled = false;

    callCascade({
      campaign_id: campaignId,
      approval_decision: "approved",
      campaign_context: campaignContext,
    })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setStages(["done", "done", "running"]);
        setTimeout(() => {
          if (cancelled) return;
          setStages(["done", "done", "done"]);
        }, 600);
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setStages(["done", "done", "done"]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId, campaignContext]);

  const allDone = stages.every((s) => s === "done");
  const variantCount = result?.localized_variants?.length ?? 0;
  const regions = result?.localized_variants
    ? [...new Set(result.localized_variants.map((v) => v.region))]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-charcoal/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-600" />
            <h2 className="font-serif text-lg font-semibold text-charcoal">
              Triggering Downstream Workflow
            </h2>
          </div>
          <AIBadge />
        </header>

        <div className="px-5 py-4">
          <div className="divide-y divide-charcoal/5">
            <StageRow label="Compliance verified" status={stages[0]} />
            <StageRow label="Localization Generator" status={stages[1]} />
            <StageRow label="Awaiting localization manager review" status={stages[2]} />
          </div>

          {error && (
            <div className="mt-3 rounded-md border border-mustard/30 bg-mustard/5 p-3 text-xs text-charcoal/70">
              AI temporarily unavailable. The campaign has been approved.
              <div className="mt-1 text-xs text-charcoal/45">{error}</div>
            </div>
          )}

          {allDone && result && !error && (
            <div className="mt-4 space-y-2 rounded-md border border-sage/20 bg-sage/5 p-4 text-sm text-charcoal/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-sage" />
                <span className="font-medium text-charcoal">
                  Generated {variantCount} regional variant{variantCount !== 1 ? "s" : ""}
                </span>
              </div>
              {regions.length > 0 && (
                <div className="ml-6 text-xs text-charcoal/60">
                  Regions: {regions.join(", ")}
                </div>
              )}
              {result.activation_schedule && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-sage" />
                  <span className="font-medium text-charcoal">
                    Activation scheduled: {result.activation_schedule}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="border-t border-charcoal/10 px-5 py-3">
          <button
            type="button"
            onClick={onDone}
            disabled={!allDone}
            className="w-full rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {allDone ? "Done" : "Working..."}
          </button>
        </footer>
      </div>
    </div>
  );
}
