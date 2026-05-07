"use client";

import { Activity, Sparkles } from "lucide-react";

import { ActionFooter, ContextStack, type StepContentProps } from "./shared";

const KPI_PREVIEW = [
  { label: "Email", value: "56× ROAS", note: "leads all channels" },
  { label: "Search", value: "20× ROAS", note: "" },
  { label: "Display", value: "1.1× ROAS", note: "lagging, recommend pause" },
];

const SEGMENT_PREVIEW = [
  { label: "Platinum", value: "+44%", note: "vs campaign avg" },
  { label: "Gold", value: "+38%", note: "" },
  { label: "Silver", value: "+18%", note: "" },
  { label: "Bronze", value: "-17%", note: "" },
];

export function MonitoringContent({
  context,
  canAct,
  busy,
  onApprove,
  onLaunchSkill,
}: StepContentProps) {
  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Skill: Campaign Performance Analyzer (fully automated)
          </span>
        </div>
        <p className="text-sm text-charcoal/70">
          Pulls campaign performance from the unified database, runs last-touch
          attribution by channel and segment, and forecasts the next 14 days
          with 80 percent confidence intervals.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-charcoal/10 bg-cream/30 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-600">
              <Activity className="h-3 w-3" /> Channel Attribution
            </div>
            <ul className="space-y-1 text-[12px]">
              {KPI_PREVIEW.map((k) => (
                <li key={k.label} className="flex items-center justify-between">
                  <span className="text-charcoal/85">{k.label}</span>
                  <span className="font-semibold text-charcoal">{k.value}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-charcoal/10 bg-cream/30 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-600">
              <Activity className="h-3 w-3" /> Segment Attribution
            </div>
            <ul className="space-y-1 text-[12px]">
              {SEGMENT_PREVIEW.map((s) => (
                <li key={s.label} className="flex items-center justify-between">
                  <span className="text-charcoal/85">{s.label}</span>
                  <span
                    className={`font-semibold ${
                      s.value.startsWith("+") ? "text-sage" : "text-soft_red"
                    }`}
                  >
                    {s.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {canAct && (
          <button
            type="button"
            onClick={() => onLaunchSkill("analyze")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-teal-600 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
          >
            Open the skill to inspect the full attribution + 14 day forecast →
          </button>
        )}
      </div>

      <ActionFooter
        canAct={canAct}
        busy={busy}
        cta="Confirm performance pull"
        ctaKind="skill"
        hint="Running the skill auto-advances to Reporting on success."
        stepNumber={9}
        onClick={() =>
          onApprove("Confirm Performance Pull", {
            top_channel: "email",
            top_segment: "Platinum",
          })
        }
      />
    </div>
  );
}
