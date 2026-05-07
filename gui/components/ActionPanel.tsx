"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgePercent,
  Calendar,
  CheckCircle2,
  FileText,
  Hourglass,
  Lock,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

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
    label:
      "Marketing leadership has filed the campaign brief below. Review the strategy, offer, and constraints, then approve to begin segmentation.",
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

        {currentStepInfo.number === 1 && (
          <div className="mt-4">
            <BriefCard />
          </div>
        )}

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


// ---------- Step 1 brief content ----------

function BriefSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-600">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <div className="text-[12px] leading-relaxed text-charcoal/80">{children}</div>
    </section>
  );
}

function BriefKV({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-x-3 py-0.5">
      <span className="text-charcoal/55">{label}</span>
      <span className="text-charcoal/85">{value}</span>
    </div>
  );
}

function BriefBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5 py-0.5">
      <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-charcoal/40" />
      <span>{children}</span>
    </li>
  );
}

function BriefCard() {
  return (
    <div className="rounded-md border border-charcoal/10 bg-cream/50 p-5">
      <div className="mb-4 border-b border-charcoal/10 pb-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-charcoal/45">
          Campaign Brief · Filed by Marketing Leadership
        </div>
        <div className="mt-0.5 font-serif text-base font-semibold text-charcoal">
          Mother&apos;s Day Beauty Event
        </div>
      </div>

      <div className="space-y-4">
        <BriefSection icon={FileText} title="Campaign Overview">
          <div className="space-y-0">
            <BriefKV label="Campaign Name" value="Mother's Day Beauty Event" />
            <BriefKV label="Campaign ID" value="MDC-2026-MD-001" />
            <BriefKV label="Sponsored by" value="VP of Marketing" />
            <BriefKV label="Filed" value="12 days before launch" />
          </div>
        </BriefSection>

        <BriefSection icon={Target} title="Strategic Objective">
          <p>
            Drive Beauty category revenue +20% vs last year&apos;s Mother&apos;s Day window.
            Win back lapsed Beauty buyers and acquire first-time Beauty customers from
            existing Macy&apos;s loyalists.
          </p>
        </BriefSection>

        <BriefSection icon={Users} title="Target Customer">
          <p>
            Women 28 to 55, Macy&apos;s Star Rewards members, with prior Beauty purchases
            or expressed Beauty preference. Emphasis on Gold and Platinum tier loyalty
            members.
          </p>
        </BriefSection>

        <div className="grid gap-4 md:grid-cols-2">
          <BriefSection icon={BadgePercent} title="Promotional Offer">
            <ul className="space-y-0">
              <BriefBullet>25% off all Beauty (excluding fragrance and prestige skincare)</BriefBullet>
              <BriefBullet>Free gift with purchase $75+</BriefBullet>
              <BriefBullet>Free shipping on Beauty orders over $50</BriefBullet>
            </ul>
          </BriefSection>

          <BriefSection icon={Calendar} title="Campaign Window">
            <ul className="space-y-0">
              <BriefBullet>Soft launch: 14 days before Mother&apos;s Day</BriefBullet>
              <BriefBullet>Peak: 7 days before Mother&apos;s Day</BriefBullet>
              <BriefBullet>Closeout: Mother&apos;s Day end of day</BriefBullet>
            </ul>
          </BriefSection>

          <BriefSection icon={Wallet} title="Budget Allocation">
            <ul className="space-y-0">
              <BriefBullet>Paid media: $1.2M</BriefBullet>
              <BriefBullet>Store experience: $400K</BriefBullet>
              <BriefBullet>Email and CRM: $200K</BriefBullet>
              <BriefBullet>
                <span className="font-semibold text-charcoal">Total: $1.8M</span>
              </BriefBullet>
            </ul>
          </BriefSection>

          <BriefSection icon={TrendingUp} title="Success Metrics">
            <ul className="space-y-0">
              <BriefBullet>Revenue target: $4.2M</BriefBullet>
              <BriefBullet>ROAS goal: 3.5x</BriefBullet>
              <BriefBullet>New Beauty customer acquisition: 5,000+</BriefBullet>
              <BriefBullet>Email open rate: 22%+</BriefBullet>
            </ul>
          </BriefSection>
        </div>

        <BriefSection icon={AlertTriangle} title="Constraints">
          <ul className="space-y-0">
            <BriefBullet>
              Legal review required for all final creative (Brand and Promotional Compliance)
            </BriefBullet>
            <BriefBullet>
              Cannot include prestige skincare brands (Tom Ford, La Mer, etc.)
            </BriefBullet>
            <BriefBullet>Regional pricing must reflect inventory levels</BriefBullet>
            <BriefBullet>Must include Star Rewards member-exclusive offer</BriefBullet>
          </ul>
        </BriefSection>
      </div>
    </div>
  );
}
