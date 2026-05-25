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
    <section className="rounded-lg glass-card p-5">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-lg font-semibold text-charcoal">Campaign Workflow</h2>
          {role && (
            <div className="mt-0.5 text-[11px] text-charcoal/50">
              Viewing as <span className="font-medium text-charcoal/70">{role.name}</span> ({role.title})
            </div>
          )}
        </div>
        {steps && (
          <span className="text-xs text-charcoal/50">
            {steps.filter((s) => s.status === "complete").length} of {steps.length} complete
          </span>
        )}
      </header>

      {/* Animated progress bar */}
      {steps && (
        <div className="mb-4 relative h-2 rounded-full bg-charcoal/6 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(steps.filter((s) => s.status === "complete").length / steps.length) * 100}%` }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: "linear-gradient(90deg, #0B7B8A, #0EA5A0, #87A96B)" }}
          />
          {/* Active step pulse dot on the progress line */}
          {activeNumber && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-mustard shadow-lg shadow-mustard/40 animate-soft-pulse"
              style={{ left: `${((activeNumber - 0.5) / steps.length) * 100}%` }}
            />
          )}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {(steps ?? Array.from({ length: 10 })).map((step, i) => {
          if (!step) {
            return (
              <div key={i} className="h-32 w-44 flex-shrink-0 rounded-md border border-dashed border-charcoal/15" />
            );
          }
          const styleSet = LABEL_STYLE[step.label];
          const isActive = step.status === "active";
          const isComplete = step.status === "complete";
          const farPending =
            step.status === "pending" &&
            activeNumber !== undefined &&
            step.number > activeNumber + 1;
          const ownerMeta = PERSONA_ROLE[step.owner_persona_id];
          return (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, delay: 0.12 + i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
              whileHover={{ scale: 1.04, y: -4, transition: { duration: 0.2 } }}
              className={`relative flex h-36 w-48 flex-shrink-0 flex-col justify-between rounded-xl p-3.5 cursor-default backdrop-blur-md ${
                isActive
                  ? "bg-teal-50/80 border-2 border-teal-500/40 shadow-lg shadow-teal-500/10 ring-1 ring-teal-400/20"
                  : isComplete
                    ? "bg-white/60 border border-charcoal/8"
                    : farPending
                      ? "bg-charcoal/[0.03] border border-charcoal/8 opacity-50"
                      : "bg-white/50 border border-charcoal/10"
              } ${step.my_step && !isActive ? "ring-1 ring-teal-500/20" : ""}`}
              style={{
                boxShadow: isActive
                  ? "0 8px 32px rgba(11,123,138,0.12), 0 2px 8px rgba(0,0,0,0.06)"
                  : "0 2px 12px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.04)",
              }}
              title={`${step.owner} | ${step.status}${step.my_step ? " | your step" : ""}`}
            >
              <div className="flex items-start justify-between">
                <span className={`font-serif text-2xl font-bold ${isActive ? "text-teal-600" : isComplete ? "text-teal-600/40" : "text-charcoal/20"}`}>
                  {step.number}
                </span>
                {farPending ? (
                  <Lock className="h-4 w-4 text-charcoal/30" />
                ) : (
                  <StatusDot status={step.status} />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-charcoal leading-tight">{step.name}</div>
                <div className="mt-1 text-xs text-charcoal/55">{step.owner}</div>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide"
                  style={{ backgroundColor: styleSet.bg, color: styleSet.text }}
                >
                  {styleSet.label}
                </span>
                {isActive && (
                  <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white animate-soft-pulse">
                    ACTIVE
                  </span>
                )}
                {!isActive && (revisionCounts?.[String(step.number)] ?? 0) > 0 && (
                  <span
                    className="rounded-full bg-mustard/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-mustard"
                    title="Number of revision requests on this step"
                  >
                    {revisionCounts![String(step.number)]} rev
                  </span>
                )}
              </div>
              {/* Floating owner avatar */}
              {ownerMeta && (
                <div
                  className={`absolute -bottom-2 h-7 w-7 overflow-hidden rounded-full border-2 border-white shadow-sm ${(personaId === "ceo" || personaId === "thales") && isActive ? "-right-5" : "-right-2"}`}
                  title={`${ownerMeta.name} (${ownerMeta.title})`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ownerMeta.avatar}
                    alt={ownerMeta.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              {/* CEO floating avatar (only on the active step) */}
              {(personaId === "ceo" || personaId === "thales") && isActive && (
                <div
                  className="absolute -bottom-2 -right-1 h-7 w-7 overflow-hidden rounded-full border-2 border-purple-400 shadow-sm"
                  title={`${PERSONA_ROLE[personaId]?.name ?? "Co-CEO"} (Co-CEO)`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={PERSONA_ROLE[personaId]?.avatar ?? "/avatars/vincent.png"}
                    alt={PERSONA_ROLE[personaId]?.name ?? "Co-CEO"}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
