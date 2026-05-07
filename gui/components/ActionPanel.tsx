"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Hourglass, Lock, Play, Sparkles } from "lucide-react";

import { advanceCampaign, type CampaignState, type WorkflowStep } from "@/lib/api";
import { usePersona } from "@/components/PersonaContext";
import type { SkillKind } from "@/components/SkillCard";

type StepActionConfig = {
  label: string;
  cta: string;
  kind: "skill" | "approve";
  skill?: SkillKind;
  ownership: "owner" | "anyone";
};

// Per-step action wiring. The owner of each step is encoded in workflow.STEPS
// on the backend; here we just say what action UI to show for each step and
// whether anyone can act (HUMAN_ONLY) or only the step's owner persona.
const STEP_ACTIONS: Record<number, StepActionConfig> = {
  1: {
    label: "Sign off on the campaign brief from Marketing leadership.",
    cta: "Approve Brief",
    kind: "approve",
    ownership: "anyone",
  },
  2: {
    label: "Run RFM clustering and pick the target segment.",
    cta: "Run Audience Segment Builder",
    kind: "skill",
    skill: "segment",
    ownership: "owner",
  },
  3: {
    label: "Confirm the SKU list for this campaign.",
    cta: "Approve SKU List",
    kind: "approve",
    ownership: "owner",
  },
  4: {
    label: "Find clean DAM assets and pick the heroes.",
    cta: "Run DAM Asset Finder",
    kind: "skill",
    skill: "dam",
    ownership: "owner",
  },
  5: {
    label: "Approve the layout build.",
    cta: "Approve Layout",
    kind: "approve",
    ownership: "owner",
  },
  6: {
    label: "Final sign off from Brand and Legal.",
    cta: "Final Approval",
    kind: "approve",
    ownership: "anyone",
  },
  7: {
    label: "Generate 40 regional/placement variants.",
    cta: "Run Localization Generator",
    kind: "skill",
    skill: "localize",
    ownership: "owner",
  },
  8: {
    label: "Push the campaign live across channels.",
    cta: "Activate Campaign",
    kind: "approve",
    ownership: "anyone",
  },
  9: {
    label: "Run attribution and forecast.",
    cta: "Run Campaign Performance Analyzer",
    kind: "skill",
    skill: "analyze",
    ownership: "owner",
  },
  10: {
    label: "Send the executive readout to leadership.",
    cta: "Send to Leadership",
    kind: "approve",
    ownership: "owner",
  },
};

const CAMPAIGN_ID = "MDC-2026-MD-001";

export function ActionPanel({
  personaId,
  state,
  steps,
  onLaunchSkill,
  onAdvanced,
}: {
  personaId: string;
  state: CampaignState | null;
  steps: WorkflowStep[];
  onLaunchSkill: (skill: SkillKind) => void;
  onAdvanced: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStepInfo = useMemo(() => {
    if (!state || state.is_complete) return null;
    return steps.find((s) => s.number === state.current_step) ?? null;
  }, [state, steps]);

  const ownerPersona = usePersona(currentStepInfo?.owner_persona_id ?? "");

  if (!state) {
    return (
      <div className="rounded-lg border border-charcoal/10 bg-white px-5 py-4 text-sm text-charcoal/60">
        Loading campaign state…
      </div>
    );
  }

  if (state.is_complete) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-sage/40 bg-sage/10 px-5 py-4 text-sm text-charcoal">
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-sage" />
        <div>
          <div className="font-serif text-base font-semibold">Campaign complete</div>
          <p className="mt-1 text-charcoal/70">
            All 10 steps have been signed off. Click "Reset Demo" in the header to replay.
          </p>
        </div>
      </div>
    );
  }

  if (!currentStepInfo) return null;

  const config = STEP_ACTIONS[currentStepInfo.number];
  if (!config) return null;

  const canAct =
    config.ownership === "anyone" ||
    currentStepInfo.owner_persona_id === personaId;

  async function handleApprove() {
    if (!state) return;
    setBusy(true);
    setError(null);
    try {
      await advanceCampaign(CAMPAIGN_ID, state.current_step, config.cta);
      onAdvanced();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleLaunchSkill() {
    if (config.kind !== "skill" || !config.skill) return;
    onLaunchSkill(config.skill);
  }

  return (
    <div className="flex items-start gap-4 rounded-lg border border-teal-600/40 bg-white p-5 shadow-sm">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
        {canAct ? <Sparkles className="h-5 w-5" /> : <Hourglass className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Step {currentStepInfo.number} of 10 · Active
          </span>
        </div>
        <h3 className="mt-0.5 font-serif text-lg font-semibold text-charcoal">
          {currentStepInfo.name}
        </h3>
        <p className="mt-1 text-sm text-charcoal/70">{config.label}</p>

        {canAct ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={config.kind === "skill" ? handleLaunchSkill : handleApprove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {config.kind === "skill" ? (
                <Play className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {config.cta}
            </button>
            {config.kind === "skill" && (
              <span className="text-[11px] text-charcoal/55">
                Running the skill auto-advances the campaign on success.
              </span>
            )}
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 text-sm text-charcoal/60">
            <Lock className="h-3.5 w-3.5" />
            <span>
              Waiting on{" "}
              <strong className="text-charcoal/80">
                {ownerPersona ? `${ownerPersona.name} (${ownerPersona.title})` : currentStepInfo.owner}
              </strong>
              .
            </span>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-soft_red">{error}</p>}
      </div>
    </div>
  );
}
