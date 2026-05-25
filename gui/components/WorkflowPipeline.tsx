"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Circle, Lock } from "lucide-react";

import { fetchWorkflow, type WorkflowStep } from "@/lib/api";

const PERSONA_ROLE: Record<string, { name: string; title: string; avatar: string }> = {
  "campaign-manager": { name: "Merna", title: "Campaign Manager", avatar: "/avatars/merna.png" },
  "senior-designer": { name: "Abdullah", title: "Senior Designer", avatar: "/avatars/abdullah.png" },
  "production-artist": { name: "Shankar", title: "Production Artist", avatar: "/avatars/shankar.png" },
  "marketing-analyst": { name: "Anna", title: "Marketing Analyst", avatar: "/avatars/anna.png" },
  "ceo": { name: "Prof. Vincent", title: "Co-CEO", avatar: "/avatars/vincent.png" },
  "thales": { name: "Prof. Thales", title: "Co-CEO", avatar: "/avatars/thales.png" },
};

const LABEL_STYLE: Record<WorkflowStep["label"], { bg: string; text: string; label: string }> = {
  HUMAN_ONLY: { bg: "#FCEAEA", text: "#8C2727", label: "HUMAN" },
  HUMAN_PLUS_AI: { bg: "#E5EFD8", text: "#3F5A1F", label: "HUMAN + AI" },
  HUMAN_PLUS_AUTOMATION: { bg: "#F5F0EB", text: "#57534E", label: "HUMAN + AUTOMATION" },
  HUMAN_PLUS_SKILL: { bg: "#E0F2F1", text: "#0B7B8A", label: "HUMAN + SKILL" },
  FULLY_AUTOMATED: { bg: "#ECECEC", text: "#444444", label: "FULLY AUTOMATED" },
};

function StatusDot({ status }: { status: WorkflowStep["status"] }) {
  if (status === "complete") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-sm shadow-teal-500/30">
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

export function WorkflowPipeline({
  personaId,
  steps: stepsProp,
  revisionCounts,
}: {
  personaId: string;
  steps?: WorkflowStep[];
  // step number -> revision count (only steps with > 0 revisions are interesting)
  revisionCounts?: Record<string, number>;
}) {
  // If a parent passes steps in, use them. Otherwise self-fetch (legacy path,
  // kept so the component stays drop-in friendly).
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
    return <p className="text-sm text-soft_red">Failed to load workflow: {error}</p>;
  }

  // The "current" step is whatever has status = active. Steps two or more
  // beyond the current step render with a subtle lock icon to make the
  // sequential dependency obvious.
  const activeNumber = steps?.find((s) => s.status === "active")?.number;

  const role = PERSONA_ROLE[personaId];

  return (
    <section className="pipeline-container p-5">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-lg font-semibold text-white">Campaign Workflow</h2>
          {role && (
            <div className="mt-0.5 text-[11px] text-white/60">
              Viewing as <span className="font-medium text-white/80">{role.name}</span> ({role.title})
            </div>
          )}
        </div>
        {steps && (
          <span className="text-xs text-white/50">
            {steps.filter((s) => s.status === "complete").length} of {steps.length} complete
          </span>
        )}
      </header>

      {/* Animated progress bar */}
      {steps && (
        <div className="mb-4 progress-energy">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(steps.filter((s) => s.status === "complete").length / steps.length) * 100}%` }}
            transition={{ duration: 1.4, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="progress-energy-fill"
          />
        </div>
      )}

      <div className="grid grid-cols-5 gap-2.5">
        {(steps ?? Array.from({ length: 10 })).map((step, i) => {
          if (!step) {
            return (
              <div key={i} className="h-28 rounded-xl border border-dashed border-white/10" />
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
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, delay: 0.12 + i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
              whileHover={{ scale: 1.04, y: -4, transition: { duration: 0.25 } }}
              className={`step-card relative flex h-28 flex-col justify-between p-3 cursor-default ${
                isActive
                  ? "step-card-active"
                  : isComplete
                    ? "step-card-complete"
                    : farPending
                      ? "step-card-locked"
                      : ""
              } ${step.my_step && !isActive ? "ring-1 ring-teal-400/30" : ""}`}
              title={`${step.owner} | ${step.status}${step.my_step ? " | your step" : ""}`}
            >
              <div className="flex items-start justify-between">
                <span className={`font-serif text-xl font-bold ${isActive ? "text-teal-300" : isComplete ? "text-teal-400/50" : "text-white/20"}`}>
                  {step.number}
                </span>
                {farPending ? (
                  <Lock className="h-3.5 w-3.5 text-white/25" />
                ) : (
                  <StatusDot status={step.status} />
                )}
              </div>
              <div>
                <div className="text-[12px] font-bold text-white leading-tight">{step.name}</div>
                <div className="mt-0.5 text-[10px] text-white/50">{step.owner}</div>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span
                  className="rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wide"
                  style={{ backgroundColor: styleSet.bg, color: styleSet.text }}
                >
                  {styleSet.label}
                </span>
                {isActive && (
                  <span className="rounded-full bg-teal-400 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-charcoal animate-soft-pulse">
                    ACTIVE
                  </span>
                )}
                {!isActive && (revisionCounts?.[String(step.number)] ?? 0) > 0 && (
                  <span
                    className="rounded-full bg-mustard/30 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-mustard"
                    title="Number of revision requests on this step"
                  >
                    {revisionCounts![String(step.number)]} rev
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
