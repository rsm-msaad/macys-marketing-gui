"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

import {
  advanceCampaignWithOutput,
  type CampaignContext,
  type CampaignState,
  type WorkflowStep,
} from "@/lib/api";
import { isStepOwnedBy, getStepOwner, getStepOwnerName, getStepOwnerTitle } from "@/lib/authorities";

const OWNER_AVATAR: Record<string, string> = {
  "campaign-manager": "/avatars/merna.png",
  "senior-designer": "/avatars/abdullah.png",
  "production-artist": "/avatars/shankar.png",
  "marketing-analyst": "/avatars/anna.png",
  "ceo": "/avatars/vincent.png",
  "thales": "/avatars/thales.png",
};
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

/* ---------- Completed Campaign: rich read-only view ---------- */

function CompletedStepCard({
  stepNumber,
  title,
  children,
}: {
  stepNumber: number;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(stepNumber >= 6); // auto-expand steps 6-10
  return (
    <div className="completed-step-glass">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-charcoal hover:bg-cream/50"
      >
        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-sage" />
        <span className="text-xs font-bold text-charcoal/40">STEP {stepNumber}</span>
        <span className="flex-1">{title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-charcoal/40" />
        ) : (
          <ChevronRight className="h-4 w-4 text-charcoal/40" />
        )}
      </button>
      {open && <div className="border-t border-charcoal/5 px-4 py-3 text-sm text-charcoal/75">{children}</div>}
    </div>
  );
}

function CompletedCampaignView({
  outputs,
  context,
}: {
  outputs: Record<string, Record<string, unknown>>;
  context: CampaignContext | null;
}) {
  const step6 = outputs["6"] as Record<string, unknown> | undefined;
  const step7 = outputs["7"] as Record<string, unknown> | undefined;
  const step8 = outputs["8"] as Record<string, unknown> | undefined;
  const step9 = outputs["9"] as Record<string, unknown> | undefined;

  const compliance = step6?.compliance as Record<string, unknown> | undefined;
  const approvalBrief = step6?.approval_brief as Record<string, unknown> | undefined;
  const routing = step6?.routing as Record<string, unknown> | undefined;
  const variants = (step7?.variants ?? []) as Array<Record<string, string>>;
  const schedule = (step8?.schedule ?? []) as Array<Record<string, string>>;
  const totals = step9?.totals as Record<string, unknown> | undefined;
  const learnings = (step9?.learnings ?? []) as string[];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border border-sage/40 bg-sage/10 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-sage" />
        <div>
          <span className="font-serif text-base font-semibold text-charcoal">Campaign complete</span>
          <span className="ml-2 text-sm text-charcoal/60">All 10 steps finished. Expand any step to review.</span>
        </div>
      </div>

      {/* Steps 1-5: simple summaries */}
      {[1, 2, 3, 4, 5].map((n) => {
        const out = outputs[String(n)] as Record<string, unknown> | undefined;
        return (
          <CompletedStepCard key={n} stepNumber={n} title={STEP_NAME[n]}>
            <p>{(out?.summary as string) ?? "Completed."}</p>
          </CompletedStepCard>
        );
      })}

      {/* Step 6: Compliance + Approval Brief + Routing */}
      <CompletedStepCard stepNumber={6} title="Final Approval">
        {compliance && (
          <div className="mb-3">
            <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-charcoal/50">Compliance Pre-Check</h4>
            <div className="rounded border border-sage/30 bg-sage/5 px-3 py-2">
              <span className="inline-block rounded-full bg-sage/20 px-2 py-0.5 text-xs font-bold uppercase text-sage">
                {String(compliance.status ?? "pass").toUpperCase()}
              </span>
              <ul className="mt-2 space-y-1">
                {((compliance.checks ?? []) as Array<Record<string, string>>).map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-sage" />
                    <span><strong>{c.rule}:</strong> {c.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {approvalBrief && (
          <div className="mb-3">
            <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-charcoal/50">VP Approval Brief</h4>
            <div className="rounded border border-charcoal/10 bg-cream/50 px-3 py-2 text-xs space-y-1">
              <p><strong>Submitted to:</strong> {String(approvalBrief.submitted_to)}</p>
              <p><strong>Recommendation:</strong> {String(approvalBrief.recommendation)}</p>
              <p><strong>Budget:</strong> {String(approvalBrief.budget_summary)}</p>
              <p><strong>Projected Revenue:</strong> {String(approvalBrief.projected_revenue)}</p>
              <p><strong>Risk Flags:</strong> {String(approvalBrief.risk_flags)}</p>
              {Array.isArray(approvalBrief.key_highlights) && (
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  {(approvalBrief.key_highlights as string[]).map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {routing && (
          <div>
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-charcoal/50">Routing Decision</h4>
            <p className="text-xs">
              <span className="inline-block rounded-full bg-sage/20 px-2 py-0.5 text-xs font-bold uppercase text-sage mr-2">
                {String(routing.decision)}
              </span>
              {String(routing.note)}
            </p>
          </div>
        )}
      </CompletedStepCard>

      {/* Step 7: Localization */}
      <CompletedStepCard stepNumber={7} title="Localization">
        <p className="mb-2 text-xs">{String(step7?.summary ?? "Localized to multiple regions.")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {variants.map((v, i) => (
            <div key={i} className="rounded border border-charcoal/10 bg-cream/40 px-3 py-2 text-xs">
              <div className="font-semibold">{v.region} ({v.language})</div>
              <div className="mt-0.5 italic">&ldquo;{v.headline}&rdquo;</div>
              <div className="text-charcoal/60">{v.subhead}</div>
            </div>
          ))}
        </div>
      </CompletedStepCard>

      {/* Step 8: Activation */}
      <CompletedStepCard stepNumber={8} title="Activation">
        <p className="mb-2 text-xs">{String(step8?.summary ?? "All channels activated.")}</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-charcoal/10 text-left text-charcoal/50">
              <th className="pb-1 pr-3 font-semibold">Channel</th>
              <th className="pb-1 pr-3 font-semibold">Time</th>
              <th className="pb-1 pr-3 font-semibold">Audience</th>
              <th className="pb-1 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((s, i) => (
              <tr key={i} className="border-b border-charcoal/5">
                <td className="py-1 pr-3 font-medium">{s.channel}</td>
                <td className="py-1 pr-3">{s.time}</td>
                <td className="py-1 pr-3">{s.audience}</td>
                <td className="py-1">
                  <span className="inline-block rounded-full bg-sage/20 px-1.5 py-0.5 text-xs font-bold text-sage">
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CompletedStepCard>

      {/* Step 9: Performance */}
      <CompletedStepCard stepNumber={9} title="Monitoring / Performance">
        <p className="mb-2 text-xs">{String(step9?.summary ?? "Campaign performance analyzed.")}</p>
        {totals && (
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {Object.entries(totals).map(([k, v]) => (
              <div key={k} className="rounded border border-charcoal/10 bg-cream/40 px-2 py-1.5 text-center text-xs">
                <div className="font-semibold text-charcoal">{String(v)}</div>
                <div className="text-xs text-charcoal/50">{k.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
        )}
        {typeof step9?.top_channel === "string" && (
          <p className="text-xs"><strong>Top channel:</strong> {step9.top_channel}</p>
        )}
        {typeof step9?.top_segment === "string" && (
          <p className="text-xs"><strong>Top segment:</strong> {step9.top_segment}</p>
        )}
        {learnings.length > 0 && (
          <div className="mt-2">
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-charcoal/50">Key Learnings</h4>
            <ul className="list-disc pl-4 space-y-0.5 text-xs">
              {learnings.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        )}
      </CompletedStepCard>

      {/* Step 10: Reporting */}
      <CompletedStepCard stepNumber={10} title="Reporting">
        <p>{(outputs["10"]?.summary as string) ?? "Final report delivered."}</p>
      </CompletedStepCard>
    </div>
  );
}

export function ActionPanel({
  personaId,
  campaignId,
  state,
  steps: _steps,
  context,
  onLaunchSkill,
  onRequestRevisions,
  onAdvanced,
  onInterceptApproval,
}: {
  personaId: string;
  campaignId: string;
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
    const outputs = (state.step_outputs ?? {}) as Record<string, Record<string, unknown>>;
    const hasRichOutputs = Object.keys(outputs).length > 2;
    if (!hasRichOutputs) {
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
    return <CompletedCampaignView outputs={outputs} context={context} />;
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
          campaignId={campaignId}
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
        campaignId,
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
    <div className="flex items-start gap-4 action-panel-glass p-5">
      <ActiveIcon canAct={canAct} />
      <div className="min-w-0 flex-1">
        {/* Authorization warning */}
        {!canAct && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border-2 border-mustard/40 bg-mustard/10 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-mustard/20 flex-shrink-0">
              <span className="text-lg">⚠️</span>
            </div>
            <div>
              <div className="text-sm font-bold text-charcoal">Not Authorized</div>
              <div className="text-xs text-charcoal/70">
                This step belongs to <strong>{getStepOwnerName(stepNumber)}</strong> ({getStepOwnerTitle(stepNumber)}).
                Please log in as <strong className="text-teal-700">{getStepOwnerName(stepNumber)}</strong> to take action.
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <ActiveBadge stepNumber={stepNumber} />
        </div>
        <h3 className="mt-0.5 font-serif text-lg font-semibold text-charcoal">
          {STEP_NAME[stepNumber] ?? `Step ${stepNumber}`}
        </h3>

        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-teal-600/15 bg-teal-50/40 px-3 py-1">
          <div className="h-5 w-5 rounded-full overflow-hidden bg-teal-600 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OWNER_AVATAR[getStepOwner(stepNumber) ?? ""] ?? ""}
              alt={getStepOwnerName(stepNumber)}
              className="h-full w-full object-cover"
              onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement!.classList.add("flex","items-center","justify-center","text-xs","font-bold","text-white"); e.currentTarget.parentElement!.textContent = getStepOwnerName(stepNumber).charAt(0); }}
            />
          </div>
          <span className="text-[11px] text-charcoal/70">
            <span className="font-medium text-charcoal/85">{getStepOwnerName(stepNumber)}</span>
            {" "}({getStepOwnerTitle(stepNumber)})
          </span>
        </div>

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
