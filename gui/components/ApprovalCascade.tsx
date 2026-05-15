"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { callCascade, type CascadeResult } from "@/lib/ai_client";

function AIBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: "#D4A8431A", color: "#B8922E", border: "1px solid #D4A84330" }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-gold" />
      AI
    </span>
  );
}

type StageStatus = "pending" | "running" | "done";

function StageRow({ label, status }: { label: string; status: StageStatus }) {
  return (
    <div className="flex items-center gap-4 py-3">
      {status === "done" && <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-sage" />}
      {status === "running" && <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-teal-600" />}
      {status === "pending" && <div className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-charcoal/10" />}
      <span
        className={`text-[13px] ${
          status === "done"
            ? "font-medium text-charcoal"
            : status === "running"
              ? "font-medium text-teal-600"
              : "text-stone/50"
        }`}
      >
        {label}
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
  const [stages, setStages] = useState<StageStatus[]>(["done", "running", "pending", "pending"]);

  useEffect(() => {
    let cancelled = false;

    callCascade({
      campaign_id: campaignId,
      approval_decision: "approved",
      campaign_context: campaignContext,
    })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setStages(["done", "done", "running", "pending"]);
        setTimeout(() => {
          if (cancelled) return;
          setStages(["done", "done", "done", "running"]);
          setTimeout(() => {
            if (cancelled) return;
            setStages(["done", "done", "done", "done"]);
          }, 800);
        }, 800);
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setStages(["done", "done", "done", "done"]);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-panel bg-white shadow-overlay animate-fade-up">
        <header className="flex items-center justify-between border-b border-charcoal/[0.06] px-6 py-5">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-gold" />
            <h2 className="font-display text-xl font-semibold text-charcoal">
              Triggering Downstream Workflow
            </h2>
          </div>
          <AIBadge />
        </header>

        <div className="px-6 py-5">
          <div className="divide-y divide-charcoal/[0.05]">
            <StageRow label="Compliance verified" status={stages[0]} />
            <StageRow label="Localization Generator" status={stages[1]} />
            <StageRow label="Activation Scheduler" status={stages[2]} />
            <StageRow label="Campaign moved to In Production" status={stages[3]} />
          </div>

          {error && (
            <div className="mt-4 rounded-card border border-amber/30 bg-amber/5 p-4 text-xs text-charcoal/70">
              AI temporarily unavailable. The campaign has been approved.
              <div className="mt-1.5 text-[10px] text-stone/60">{error}</div>
            </div>
          )}

          {allDone && result && !error && (
            <div className="mt-5 space-y-2.5 rounded-card border border-sage/20 bg-sage/5 p-5 text-[13px] text-charcoal/80">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-sage" />
                <span className="font-medium text-charcoal">
                  Generated {variantCount} regional variant{variantCount !== 1 ? "s" : ""}
                </span>
              </div>
              {regions.length > 0 && (
                <div className="ml-7 text-[12px] text-stone">
                  Regions: {regions.join(", ")}
                </div>
              )}
              {result.activation_schedule && (
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-sage" />
                  <span className="font-medium text-charcoal">
                    Activation scheduled: {result.activation_schedule}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="border-t border-charcoal/[0.06] px-6 py-4">
          <button
            type="button"
            onClick={onDone}
            disabled={!allDone}
            className="w-full rounded-card bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {allDone ? "Done" : "Working..."}
          </button>
        </footer>
      </div>
    </div>
  );
}
