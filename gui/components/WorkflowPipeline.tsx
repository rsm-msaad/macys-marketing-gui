"use client";

import { useEffect, useState } from "react";
import { Check, Circle, Lock } from "lucide-react";

import { fetchWorkflow, type WorkflowStep } from "@/lib/api";

function StatusIcon({ status }: { status: WorkflowStep["status"] }) {
  if (status === "complete") {
    return (
      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-sage text-white">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-teal-600 text-white animate-soft-pulse">
        <Circle className="h-3 w-3 fill-white" />
      </span>
    );
  }
  return (
    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-charcoal/15 bg-cream text-[11px] font-semibold text-charcoal/30" />
  );
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
    <nav className="space-y-0" aria-label="Campaign workflow steps">
      {(steps ?? []).map((step, i) => {
        const isActive = step.status === "active";
        const isComplete = step.status === "complete";
        const farPending =
          step.status === "pending" &&
          activeNumber !== undefined &&
          step.number > activeNumber + 1;
        const isLast = i === (steps?.length ?? 0) - 1;
        const revCount = revisionCounts?.[String(step.number)] ?? 0;

        return (
          <div key={step.number} className="relative flex items-start gap-3">
            {/* Vertical connector line */}
            {!isLast && (
              <div
                className="absolute left-[14px] top-[36px] w-[2px]"
                style={{
                  height: "calc(100% - 8px)",
                  backgroundColor: isComplete ? "#8DA67E50" : "#E5E2DB",
                }}
              />
            )}

            {/* Status icon */}
            <div className="relative z-10 flex-shrink-0">
              {farPending ? (
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-charcoal/10 bg-cream">
                  <Lock className="h-3 w-3 text-charcoal/20" />
                </span>
              ) : (
                <StatusIcon status={step.status} />
              )}
            </div>

            {/* Step label */}
            <div
              className={`flex-1 pb-5 ${
                isActive ? "" : isComplete ? "opacity-60" : "opacity-40"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[13px] font-semibold leading-tight ${
                    isActive ? "text-charcoal" : "text-charcoal/80"
                  }`}
                >
                  {step.name}
                </span>
                {isActive && (
                  <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white">
                    ACTIVE
                  </span>
                )}
                {!isActive && revCount > 0 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider"
                    style={{ backgroundColor: "#D4A8431A", color: "#B8922E" }}
                  >
                    {revCount} rev
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-stone">
                {step.owner}
                {step.my_step && !isActive && (
                  <span className="ml-1.5 text-teal-600">(you)</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
