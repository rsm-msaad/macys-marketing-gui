"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import {
  advanceCampaignWithOutput,
  type CampaignContext,
  type CampaignState,
  type WorkflowStep,
} from "@/lib/api";
import { isStepOwnedBy } from "@/lib/authorities";
import type { SkillKind } from "@/components/SkillCard";

import { BriefingContent } from "@/components/steps/BriefingContent";
import { SegmentationContent } from "@/components/steps/SegmentationContent";
import { SKUSelectionContent } from "@/components/steps/SKUSelectionContent";
import { CreativeProductionContent } from "@/components/steps/CreativeProductionContent";
import { LayoutAssemblyContent } from "@/components/steps/LayoutAssemblyContent";
import { FinalApprovalContent } from "@/components/steps/FinalApprovalContent";
import { LocalizationContent } from "@/components/steps/LocalizationContent";
import { ActivationContent } from "@/components/steps/ActivationContent";
import { MonitoringContent } from "@/components/steps/MonitoringContent";
import { ReportingContent } from "@/components/steps/ReportingContent";
import { ActiveBadge, ActiveIcon } from "@/components/steps/shared";
import type { StepContentProps } from "@/components/steps/shared";
import { ResubmitPanel } from "@/components/ResubmitPanel";
import { RevisionPendingPanel } from "@/components/RevisionPendingPanel";

const CAMPAIGN_ID = "MDC-2026-MD-001";

const STEP_NAME: Record<number, string> = {
  1: "Briefing",
  2: "Segmentation",
  3: "SKU Selection",
  4: "Creative Production",
  5: "Layout Assembly",
  6: "Final Approval",
  7: "Localization",
  8: "Activation",
  9: "Monitoring",
  10: "Reporting",
};

function StepContent(props: StepContentProps & { stepNumber: number }) {
  const { stepNumber, ...rest } = props;
  switch (stepNumber) {
    case 1:
      return <BriefingContent {...rest} />;
    case 2:
      return <SegmentationContent {...rest} />;
    case 3:
      return <SKUSelectionContent {...rest} />;
    case 4:
      return <CreativeProductionContent {...rest} />;
    case 5:
      return <LayoutAssemblyContent {...rest} />;
    case 6:
      return <FinalApprovalContent {...rest} />;
    case 7:
      return <LocalizationContent {...rest} />;
    case 8:
      return <ActivationContent {...rest} />;
    case 9:
      return <MonitoringContent {...rest} />;
    case 10:
      return <ReportingContent {...rest} />;
    default:
      return null;
  }
}

export function ActionPanel({
  personaId,
  state,
  steps: _steps,
  context,
  onLaunchSkill,
  onRequestRevisions,
  onAdvanced,
  onInterceptApproval,
}: {
  personaId: string;
  state: CampaignState | null;
  steps: WorkflowStep[];
  context: CampaignContext | null;
  onLaunchSkill: (skill: SkillKind) => void;
  onRequestRevisions: (fromStep: number, defaultSendBackToStep: number) => void;
  onAdvanced: () => void;
  onInterceptApproval?: (step: number, action: string, output?: Record<string, unknown>) => boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepNumber = useMemo(() => {
    if (!state || state.is_complete) return null;
    return state.current_step;
  }, [state]);

  if (!state || !context) {
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
            All 10 steps have been signed off. Click &quot;Reset Demo&quot; in the
            header to replay.
          </p>
        </div>
      </div>
    );
  }

  if (stepNumber === null) return null;

  // Pending revision branch: render ResubmitPanel for the redo owner,
  // RevisionPendingPanel for everyone else.
  if (state.pending_revision) {
    const pending = state.pending_revision;
    const canResubmit = isStepOwnedBy(pending.step_to_redo, personaId);
    if (canResubmit) {
      return (
        <ResubmitPanel
          campaignId={CAMPAIGN_ID}
          pending={pending}
          onResubmitted={onAdvanced}
        />
      );
    }
    return <RevisionPendingPanel pending={pending} />;
  }

  const canAct = isStepOwnedBy(stepNumber, personaId);

  async function handleApprove(action: string, output?: Record<string, unknown>) {
    if (!state) return;
    // Allow parent to intercept (e.g. for cascade animation at step 6)
    if (onInterceptApproval && onInterceptApproval(state.current_step, action, output)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await advanceCampaignWithOutput(
        CAMPAIGN_ID,
        state.current_step,
        action,
        output,
      );
      onAdvanced();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-4 rounded-lg border border-teal-600/40 bg-white p-5 shadow-sm">
      <ActiveIcon canAct={canAct} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <ActiveBadge stepNumber={stepNumber} />
        </div>
        <h3 className="mt-0.5 font-serif text-lg font-semibold text-charcoal">
          {STEP_NAME[stepNumber] ?? `Step ${stepNumber}`}
        </h3>

        <div className="mt-3">
          <StepContent
            stepNumber={stepNumber}
            context={context}
            canAct={canAct}
            busy={busy}
            onApprove={handleApprove}
            onLaunchSkill={onLaunchSkill}
            onRequestRevisions={onRequestRevisions}
          />
        </div>

        {error && <p className="mt-2 text-xs text-soft_red">{error}</p>}
      </div>
    </div>
  );
}
