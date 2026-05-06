"use client";

import { useEffect, useState } from "react";
import { Check, Circle } from "lucide-react";

import { fetchWorkflow, type WorkflowStep } from "@/lib/api";

const LABEL_STYLE: Record<WorkflowStep["label"], { bg: string; text: string; label: string }> = {
  HUMAN_ONLY: { bg: "#FCEAEA", text: "#8C2727", label: "HUMAN ONLY" },
  HUMAN_PLUS_AI: { bg: "#E5EFD8", text: "#3F5A1F", label: "HUMAN + AI" },
  FULLY_AUTOMATED: { bg: "#ECECEC", text: "#444444", label: "FULLY AUTOMATED" },
};

function StatusDot({ status }: { status: WorkflowStep["status"] }) {
  if (status === "complete") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mustard text-white animate-soft-pulse">
        <Circle className="h-3 w-3 fill-white" />
      </span>
    );
  }
  return <span className="block h-5 w-5 rounded-full border-2 border-charcoal/20" />;
}

export function WorkflowPipeline({ personaId }: { personaId: string }) {
  const [steps, setSteps] = useState<WorkflowStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWorkflow(personaId)
      .then((data) => {
        if (!cancelled) setSteps(data.steps);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [personaId]);

  if (error) {
    return <p className="text-sm text-soft_red">Failed to load workflow: {error}</p>;
  }

  return (
    <section className="rounded-lg border border-charcoal/10 bg-white p-5">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold text-charcoal">Campaign Workflow</h2>
        <span className="text-xs text-charcoal/50">10 steps, mid flight</span>
      </header>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {(steps ?? Array.from({ length: 10 })).map((step, i) => {
          if (!step) {
            return (
              <div key={i} className="h-32 w-44 flex-shrink-0 rounded-md border border-dashed border-charcoal/15" />
            );
          }
          const styleSet = LABEL_STYLE[step.label];
          const isActive = step.status === "active";
          const faded = step.status === "pending";
          return (
            <div
              key={step.number}
              className={`relative flex h-32 w-44 flex-shrink-0 flex-col justify-between rounded-md border p-3 transition-shadow ${
                isActive ? "border-teal-600 shadow-md" : "border-charcoal/15"
              } ${faded ? "opacity-65" : ""} ${step.my_step ? "ring-1 ring-teal-600/40 ring-offset-2 ring-offset-cream" : ""}`}
              title={`${step.owner} | ${step.status}${step.my_step ? " | your step" : ""}`}
            >
              <div className="flex items-start justify-between">
                <span className="font-serif text-2xl font-semibold text-charcoal/40">{step.number}</span>
                <StatusDot status={step.status} />
              </div>
              <div>
                <div className="text-sm font-semibold text-charcoal leading-tight">{step.name}</div>
                <div className="mt-1 text-xs text-charcoal/55">{step.owner}</div>
              </div>
              <div
                className="self-start rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide"
                style={{ backgroundColor: styleSet.bg, color: styleSet.text }}
              >
                {styleSet.label}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
