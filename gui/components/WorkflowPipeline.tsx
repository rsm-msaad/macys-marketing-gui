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
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md shadow-teal-500/30">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="relative flex h-6 w-6 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-teal-500/20 animate-ping-slow" />
        <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-md shadow-teal-500/40">
          <Circle className="h-2.5 w-2.5 fill-white" />
        </span>
      </span>
    );
  }
  return <span className="block h-6 w-6 rounded-full border-2 border-charcoal/15 bg-charcoal/[0.02]" />;
}

export function WorkflowPipeline({
  personaId,
  steps: stepsProp,
  revisionCounts,
  onStepClick,
}: {
  personaId: string;
  steps?: WorkflowStep[];
  revisionCounts?: Record<string, number>;
  onStepClick?: (stepNumber: number) => void;
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
    return <p className="text-sm text-soft_red">Failed to load workflow: {error}</p>;
  }

  const activeNumber = steps?.find((s) => s.status === "active")?.number;
  const role = PERSONA_ROLE[personaId];
  const isCeo = personaId === "ceo" || personaId === "thales";
  const completedCount = steps?.filter((s) => s.status === "complete").length ?? 0;
  const totalSteps = steps?.length ?? 10;

  return (
    <section className="glass-card p-6">
      {/* Section header with decorative teal line */}
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1.5 h-5 w-[3px] rounded-full bg-gradient-to-b from-teal-500 to-teal-600/60" />
          <div>
            <h2 className="font-serif text-lg font-semibold text-charcoal tracking-tight">Campaign Workflow</h2>
            {role && (
              <div className="mt-0.5 text-[11px] text-charcoal/50">
                Viewing as <span className="font-medium text-charcoal/70">{role.name}</span> ({role.title})
              </div>
            )}
          </div>
        </div>
        {steps && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-teal-600">{completedCount}</span>
            <span className="text-xs text-charcoal/40">of</span>
            <span className="text-xs font-semibold text-charcoal/60">{totalSteps}</span>
            <span className="text-xs text-charcoal/40">complete</span>
          </div>
        )}
      </header>

      {/* Segmented progress bar */}
      {steps && (
        <div className="mb-5 flex items-center gap-[3px]">
          {steps.map((step, i) => {
            const isComplete = step.status === "complete";
            const isActive = step.status === "active";
            return (
              <motion.div
                key={step.number}
                className="relative h-[5px] flex-1 rounded-full overflow-hidden"
                style={{ background: "rgba(45, 45, 45, 0.06)" }}
              >
                {(isComplete || isActive) && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: isComplete ? 1 : 0.5 }}
                    transition={{ duration: 0.8, delay: 0.2 + i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                    style={{
                      transformOrigin: "left",
                      background: isActive
                        ? "linear-gradient(90deg, #0B7B8A, #0EA5A0)"
                        : "linear-gradient(90deg, #0B7B8A, #0d8d7d)",
                      boxShadow: isActive
                        ? "0 0 8px rgba(11,123,138,0.4)"
                        : "0 0 4px rgba(11,123,138,0.2)",
                    }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-5 gap-3">
        {(steps ?? Array.from({ length: 10 })).map((step, i) => {
          if (!step) {
            return (
              <div key={i} className="h-36 rounded-xl border border-dashed border-charcoal/8" />
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

          /* Accent bar color */
          const accentGradient = isActive
            ? "linear-gradient(90deg, #0B7B8A, #0EA5A0)"
            : isComplete
              ? "linear-gradient(90deg, #87A96B, #a3c282)"
              : "linear-gradient(90deg, rgba(45,45,45,0.08), rgba(45,45,45,0.04))";

          /* Avatar ring color */
          const avatarRing = isActive
            ? "ring-teal-500/50"
            : isComplete
              ? "ring-emerald-400/40"
              : "ring-charcoal/10";

          return (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 24, scale: 0.85, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.55, delay: 0.1 + i * 0.065, ease: [0.25, 0.46, 0.45, 0.94] }}
              whileHover={{
                scale: 1.05,
                y: -8,
                transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
              }}
              onClick={() => onStepClick?.(step.number)}
              style={{ '--card-index': i } as React.CSSProperties}
              className={`step-card-premium relative flex h-36 flex-col justify-between overflow-visible ${onStepClick ? "cursor-pointer" : "cursor-default"} ${
                isActive
                  ? "step-card-premium-active"
                  : isComplete
                    ? "step-card-premium-complete"
                    : farPending
                      ? "step-card-premium-locked"
                      : ""
              } ${step.my_step && !isActive ? "ring-1 ring-teal-500/20" : ""}`}
              title={`${step.owner} | ${step.status}${step.my_step ? " | your step" : ""}`}
            >
              {/* Accent bar at top */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl z-10"
                style={{ background: accentGradient }}
              />

              {/* Card content */}
              <div className="relative z-[2] flex flex-col justify-between h-full p-3 pt-3.5">
                {/* Top row: step number + status */}
                <div className="flex items-start justify-between">
                  <span
                    className={`font-serif text-2xl font-bold leading-none ${
                      isActive
                        ? "bg-gradient-to-br from-teal-500 to-teal-700 bg-clip-text text-transparent"
                        : isComplete
                          ? "text-teal-600/35"
                          : "text-charcoal/12"
                    }`}
                  >
                    {step.number}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isActive && (
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
                      </span>
                    )}
                    {farPending ? (
                      <Lock className="h-4 w-4 text-charcoal/20 animate-pulse-slow" />
                    ) : (
                      <StatusDot status={step.status} />
                    )}
                  </div>
                </div>

                {/* Middle: step name + owner */}
                <div className="mt-auto">
                  <div className={`text-[12px] font-bold leading-tight ${farPending ? "text-charcoal/40" : "text-charcoal"}`}>
                    {step.name}
                  </div>
                  <div className={`mt-0.5 text-[11px] ${farPending ? "text-charcoal/30" : "text-charcoal/50"}`}>
                    {step.owner}
                  </div>
                </div>

                {/* Bottom: label + badge */}
                <div className="flex items-center justify-between gap-1 mt-1.5">
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
                    style={{ backgroundColor: styleSet.bg, color: styleSet.text }}
                  >
                    {styleSet.label}
                  </span>
                  {isActive && (
                    <span className="rounded-full bg-gradient-to-r from-teal-600 to-teal-500 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white shadow-sm shadow-teal-500/25 animate-soft-pulse">
                      ACTIVE
                    </span>
                  )}
                  {!isActive && (revisionCounts?.[String(step.number)] ?? 0) > 0 && (
                    <span
                      className="rounded-full bg-mustard/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-mustard"
                      title="Number of revision requests on this step"
                    >
                      {revisionCounts![String(step.number)]} rev
                    </span>
                  )}
                </div>
              </div>

              {/* Frosted overlay for locked steps */}
              {farPending && (
                <div className="absolute inset-0 rounded-2xl bg-white/40 backdrop-blur-[1px] z-[3] pointer-events-none" />
              )}

              {/* Owner avatar with status-colored ring */}
              {ownerMeta && (
                <div className="group/avatar absolute -bottom-2 z-[5]" style={{ right: isCeo && isActive ? "28px" : "-6px" }}>
                  <div
                    className={`h-8 w-8 rounded-full ring-2 ${avatarRing} border-2 border-white shadow-lg transition-all duration-200 group-hover/avatar:scale-110 group-hover/avatar:shadow-xl`}
                    title={`${ownerMeta.name} (${ownerMeta.title})`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ownerMeta.avatar}
                      alt={ownerMeta.name}
                      className="h-full w-full rounded-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement!.classList.add("bg-teal-600", "flex", "items-center", "justify-center", "text-xs", "font-bold", "text-white"); e.currentTarget.parentElement!.textContent = ownerMeta.name.charAt(0); }}
                    />
                  </div>
                  {/* Tooltip on hover */}
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-charcoal/90 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity duration-200 group-hover/avatar:opacity-100 pointer-events-none">
                    {ownerMeta.name}
                  </div>
                </div>
              )}

              {/* CEO overlay avatar on the active step */}
              {isCeo && isActive && (
                <div className="group/ceo absolute -bottom-2 -right-1.5 z-[6]">
                  <div
                    className="h-8 w-8 rounded-full ring-2 ring-teal-400/60 border-2 border-white shadow-lg transition-all duration-200 group-hover/ceo:scale-110"
                    title={`${PERSONA_ROLE[personaId]?.name ?? "Co-CEO"} reviewing`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={PERSONA_ROLE[personaId]?.avatar ?? "/avatars/vincent.png"}
                      alt={PERSONA_ROLE[personaId]?.name ?? "Co-CEO"}
                      className="h-full w-full rounded-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement!.classList.add("bg-teal-600", "flex", "items-center", "justify-center", "text-xs", "font-bold", "text-white"); e.currentTarget.parentElement!.textContent = (PERSONA_ROLE[personaId]?.name ?? "C").charAt(0); }}
                    />
                  </div>
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-charcoal/90 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity duration-200 group-hover/ceo:opacity-100 pointer-events-none">
                    {PERSONA_ROLE[personaId]?.name ?? "Co-CEO"}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
