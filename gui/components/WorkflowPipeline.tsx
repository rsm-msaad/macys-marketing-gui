"use client";

import { useEffect, useState } from "react";
import { Check, Circle, Lock } from "lucide-react";

import { fetchWorkflow, type WorkflowStep } from "@/lib/api";

const LABEL_STYLE: Record<WorkflowStep["label"], { bg: string; text: string; label: string }> = {
  HUMAN_ONLY: { bg: "#C973731A", text: "#B55A5A", label: "HUMAN ONLY" },
  HUMAN_PLUS_AI: { bg: "#0B7B8A1A", text: "#0B7B8A", label: "HUMAN + AI" },
  FULLY_AUTOMATED: { bg: "#78716C1A", text: "#57534E", label: "AUTOMATED" },
};

function StatusDot({ status }: { status: WorkflowStep["status"] }) {
  if (status === "complete") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sage text-white">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold text-white animate-soft-pulse">
        <Circle className="h-2.5 w-2.5 fill-white" />
      </span>
    );
  }
  return <span className="block h-5 w-5 rounded-full border-2 border-charcoal/15" />;
}

export function WorkflowPipeline({
  personaId,
  steps: stepsProp,
  revisionCounts,
}: {
  personaId: string;
  steps?: WorkflowStep[];
  revisionCounts?: Record<string, number>;
}) {
  const [fetched, setFetched] = useState<WorkflowStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stepsProp !== undefined) return;
    let cancelled = false;
    fetchWorkflow(personaId)
      .then((data) => {
        if (!cancelled) setFetched(data.steps);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [personaId, stepsProp]);

  const steps = stepsProp ?? fetched;

  if (error) {
    return <p className="text-sm text-rose">Failed to load workflow: {error}</p>;
  }

  const activeNumber = steps?.find((s) => s.status === "active")?.number;

  return (
    <section className="rounded-panel border border-charcoal/[0.06] bg-white p-6 shadow-card">
      <header className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-charcoal">
          Campaign Workflow
        </h2>
        {steps && (
          <span className="text-[11px] font-medium text-stone">
            {steps.filter((s) => s.status === "complete").length} of {steps.length} complete
          </span>
        )}
      </header>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {(steps ?? Array.from({ length: 10 })).map((step, i) => {
          if (!step) {
            return (
              <div
                key={i}
                className="h-36 w-44 flex-shrink-0 rounded-card border border-dashed border-charcoal/10"
              />
            );
          }
          const styleSet = LABEL_STYLE[step.label];
          const isActive = step.status === "active";
          const isComplete = step.status === "complete";
          const farPending =
            step.status === "pending" &&
            activeNumber !== undefined &&
            step.number > activeNumber + 1;
          return (
            <div
              key={step.number}
              className={`relative flex h-36 w-44 flex-shrink-0 flex-col justify-between rounded-card border p-4 transition-all ${
                isActive
                  ? "border-teal-600 shadow-card ring-2 ring-teal-600/15 ring-offset-2 ring-offset-cream"
                  : "border-charcoal/[0.06]"
              } ${isComplete ? "opacity-75" : ""} ${
                step.status === "pending" ? "opacity-55" : ""
              } ${step.my_step && !isActive ? "ring-1 ring-teal-600/20" : ""}`}
              title={`${step.owner} | ${step.status}${step.my_step ? " | your step" : ""}`}
            >
              <div className="flex items-start justify-between">
                <span className="font-display text-2xl font-semibold text-charcoal/30">
                  {step.number}
                </span>
                {farPending ? (
                  <Lock className="h-4 w-4 text-charcoal/20" />
                ) : (
                  <StatusDot status={step.status} />
                )}
              </div>
              <div>
                <div className="text-[13px] font-semibold text-charcoal leading-tight">
                  {step.name}
                </div>
                <div className="mt-1 text-[11px] text-stone">{step.owner}</div>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wider"
                  style={{ backgroundColor: styleSet.bg, color: styleSet.text }}
                >
                  {styleSet.label}
                </span>
                {isActive && (
                  <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white animate-soft-pulse">
                    ACTIVE
                  </span>
                )}
                {!isActive && (revisionCounts?.[String(step.number)] ?? 0) > 0 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider"
                    style={{ backgroundColor: "#D4A8431A", color: "#B8922E" }}
                    title="Number of revision requests on this step"
                  >
                    {revisionCounts![String(step.number)]} rev
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
