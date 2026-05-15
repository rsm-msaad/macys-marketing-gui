"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightCircle, RotateCcw, Sparkles, X, ChevronDown, ChevronUp } from "lucide-react";

import { ActionPanel } from "@/components/ActionPanel";
import { AIRevisionRouting } from "@/components/AIRevisionRouting";
import { ApprovalCascade } from "@/components/ApprovalCascade";
import { CampaignSidebar } from "@/components/CampaignSidebar";
import { ChatSidebar } from "@/components/ChatSidebar";
import { HeroBanner } from "@/components/HeroBanner";
import { ResultsModal, type ModalState } from "@/components/ResultsModal";
import { RevisionRequestModal, type RevisionModalState } from "@/components/RevisionRequestModal";
import { AICoworkerPanel } from "@/components/AICoworkerPanel";
import type { SkillKind } from "@/components/SkillCard";
import { TopBar } from "@/components/TopBar";
import { WorkflowPipeline } from "@/components/WorkflowPipeline";
import type { RouteRevisionResult } from "@/lib/ai_client";
import {
  advanceCampaign,
  advanceCampaignWithOutput,
  fetchCampaignContext,
  fetchCampaigns,
  fetchCampaignState,
  fetchWorkflow,
  requestRevisions,
  resetCampaign,
  type Campaign,
  type CampaignContext,
  type CampaignState,
  type WorkflowStep,
} from "@/lib/api";
import { ACTION_TO_SKILL } from "@/lib/scripted-chat";
import {
  getStepOwnerName,
  getStepOwnerTitle,
  isStepOwnedBy,
} from "@/lib/authorities";

type LeftNavItem = { label: string; active?: boolean };

const CAMPAIGN_ID = "MDC-2026-MD-001";
const POLL_INTERVAL_MS = 5_000;

const SKILL_STEP: Record<SkillKind, number> = {
  segment: 2,
  dam: 4,
  localize: 7,
  analyze: 9,
};

type Toast = {
  id: number;
  kind: "handoff" | "revision_requested" | "resubmitted";
  fromStep: number;
  toStep: number;
  toOwner: string;
  toTitle: string;
  comment?: string;
};

export function PersonaShell({
  personaId,
  headline,
  subhead,
  leftNav,
  skills,
  centerExtras,
}: {
  personaId: string;
  headline: string;
  subhead: string;
  leftNav: LeftNavItem[];
  skills: SkillKind[];
  centerExtras?: React.ReactNode;
}) {
  const [modal, setModal] = useState<ModalState>(null);
  const [revisionModal, setRevisionModal] = useState<RevisionModalState>(null);
  const [revisionBusy, setRevisionBusy] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [state, setState] = useState<CampaignState | null>(null);
  const [context, setContext] = useState<CampaignContext | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Floating AI drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Campaign list collapsed
  const [campaignsExpanded, setCampaignsExpanded] = useState(false);

  // AI Revision Routing state (Feature 3)
  const [routingPending, setRoutingPending] = useState<{
    sendBackToStep: number;
    comment: string;
    fromStep: number;
  } | null>(null);

  // AI Cascade state (Feature 4)
  const [cascadeActive, setCascadeActive] = useState(false);

  const lastStepRef = useRef<number | null>(null);
  const lastPendingRef = useRef<boolean>(false);

  const refresh = useCallback(async () => {
    try {
      const [w, cs, st, ctx] = await Promise.all([
        fetchWorkflow(personaId),
        fetchCampaigns(),
        fetchCampaignState(CAMPAIGN_ID),
        fetchCampaignContext(CAMPAIGN_ID),
      ]);
      setSteps(w.steps);
      setCampaigns(cs);
      setState(st);
      setContext(ctx);
      setPollError(null);

      const prevStep = lastStepRef.current;
      const wasPending = lastPendingRef.current;
      const newStep = st.current_step;
      const isPending = st.pending_revision !== null;
      lastStepRef.current = newStep;
      lastPendingRef.current = isPending;

      const id = Date.now();
      if (!wasPending && isPending && st.pending_revision) {
        const target = st.pending_revision.step_to_redo;
        setToast({
          id,
          kind: "revision_requested",
          fromStep: st.pending_revision.requested_from_step,
          toStep: target,
          toOwner: getStepOwnerName(target),
          toTitle: getStepOwnerTitle(target),
          comment: st.pending_revision.comment,
        });
      } else if (wasPending && !isPending && prevStep !== null) {
        setToast({
          id,
          kind: "resubmitted",
          fromStep: prevStep,
          toStep: newStep,
          toOwner: getStepOwnerName(newStep),
          toTitle: getStepOwnerTitle(newStep),
        });
      } else if (
        prevStep !== null &&
        newStep !== prevStep &&
        !st.is_complete &&
        newStep <= 10 &&
        !isPending
      ) {
        const fromOwner = prevStep <= 10 ? getStepOwnerName(prevStep) : "";
        const toOwner = getStepOwnerName(newStep);
        if (fromOwner !== toOwner) {
          setToast({
            id,
            kind: "handoff",
            fromStep: prevStep,
            toStep: newStep,
            toOwner,
            toTitle: getStepOwnerTitle(newStep),
          });
        }
      }
    } catch (e) {
      setPollError((e as Error).message);
    }
  }, [personaId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5_500);
    return () => clearTimeout(t);
  }, [toast]);

  const stateRef = useRef<CampaignState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handleSkillSuccess = useCallback(
    async (kind: SkillKind) => {
      const cur = stateRef.current;
      if (!cur || cur.is_complete) return;
      const target = SKILL_STEP[kind];
      if (cur.current_step !== target) return;
      if (!isStepOwnedBy(target, personaId)) return;
      try {
        const next = await advanceCampaign(CAMPAIGN_ID, target, `Ran ${kind}`);
        setState(next);
        const w = await fetchWorkflow(personaId);
        setSteps(w.steps);
      } catch {
        // Race or already advanced
      }
    },
    [personaId],
  );

  function handleAction(action: string, data: Record<string, unknown> | null) {
    const kind = ACTION_TO_SKILL[action];
    if (kind) {
      setModal({ kind, prefill: data ?? undefined });
    }
  }

  function launchSkillFromActionPanel(skill: SkillKind) {
    setModal({ kind: skill });
  }

  function handleOpenRevisionModal(fromStep: number, defaultSendBackToStep: number) {
    setRevisionError(null);
    setRevisionModal({
      fromStep,
      defaultSendBackToStep,
      destinationLabel:
        fromStep === 1 && defaultSendBackToStep === 1
          ? "Marketing Leadership (proxy: Merna)"
          : fromStep === 10 && defaultSendBackToStep === 10
            ? "Hold for Edits (stays at Reporting)"
            : undefined,
    });
  }

  async function handleSubmitRevision(sendBackToStep: number, comment: string) {
    if (!revisionModal) return;
    const fromStep = revisionModal.fromStep;
    setRevisionModal(null);
    setRevisionError(null);
    setRoutingPending({ sendBackToStep, comment, fromStep });
  }

  async function handleRoutingConfirm(routingMeta: RouteRevisionResult) {
    if (!routingPending) return;
    const { sendBackToStep, comment, fromStep } = routingPending;
    setRoutingPending(null);
    setRevisionBusy(true);
    try {
      await requestRevisions(CAMPAIGN_ID, fromStep, sendBackToStep, comment, personaId);
      await refresh();
    } catch (e) {
      setRevisionError((e as Error).message);
    } finally {
      setRevisionBusy(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await resetCampaign(CAMPAIGN_ID);
      lastStepRef.current = 1;
      lastPendingRef.current = false;
      setToast(null);
      await refresh();
    } catch (e) {
      setPollError((e as Error).message);
    } finally {
      setResetting(false);
    }
  }

  const [cascadeOutput, setCascadeOutput] = useState<Record<string, unknown> | undefined>(undefined);

  function handleInterceptApproval(step: number, _action: string, output?: Record<string, unknown>): boolean {
    if (step === 6) {
      setCascadeOutput(output);
      setCascadeActive(true);
      return true;
    }
    return false;
  }

  async function handleCascadeDone() {
    setCascadeActive(false);
    try {
      await advanceCampaignWithOutput(CAMPAIGN_ID, 6, "Final Approval", cascadeOutput);
      await refresh();
    } catch (e) {
      setPollError((e as Error).message);
    }
  }

  const revisionCounts: Record<string, number> = {};
  if (state) {
    for (const [stepStr, list] of Object.entries(state.revisions)) {
      revisionCounts[stepStr] = list.length;
    }
  }

  const completedCount = steps?.filter((s) => s.status === "complete").length ?? 0;
  const totalSteps = steps?.length ?? 10;

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <TopBar activePersonaId={personaId} />

      {/* Hero campaign header */}
      {context && state && (
        <div className="border-b border-charcoal/[0.06] bg-surface px-8 py-6">
          <div className="mx-auto max-w-7xl">
            {/* Campaign selector row */}
            <button
              type="button"
              onClick={() => setCampaignsExpanded((v) => !v)}
              className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone hover:text-charcoal"
            >
              Campaign
              {campaignsExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {campaignsExpanded && (
              <div className="mb-4 max-w-sm">
                <CampaignSidebar
                  campaigns={campaigns ?? undefined}
                  activeOwnerName={
                    state && !state.is_complete
                      ? getStepOwnerName(state.current_step)
                      : null
                  }
                />
              </div>
            )}

            {/* Campaign name: HERO */}
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-charcoal md:text-5xl">
              {context.campaign_brief.name}
            </h1>

            {/* Key metrics row */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone">
              {context.campaign_brief.budget && (() => {
                const vals = Object.values(context.campaign_brief.budget);
                const total = vals.reduce((sum, v) => {
                  const cleaned = v.replace(/[^0-9.]/g, "");
                  const num = parseFloat(cleaned) || 0;
                  const multiplier = v.toLowerCase().includes("m") ? 1_000_000
                    : v.toLowerCase().includes("k") ? 1_000 : 1;
                  return sum + num * multiplier;
                }, 0);
                const display = total >= 1_000_000
                  ? `$${(total / 1_000_000).toFixed(1)}M`
                  : total >= 1_000
                    ? `$${(total / 1_000).toFixed(0)}K`
                    : `$${total}`;
                return (
                  <span className="font-display text-lg font-bold text-charcoal">
                    {display} total budget
                  </span>
                );
              })()}
              <span className="text-charcoal/20">|</span>
              <span className="text-[13px]">
                {context.mock_data.sku_suggestions.length} SKUs
              </span>
              <span className="text-charcoal/20">|</span>
              <span className="text-[13px]">
                {context.campaign_brief.filed_days_before_launch} days until launch
              </span>
              <span className="text-charcoal/20">|</span>
              {state && !state.is_complete && (
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-teal-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-soft-pulse" />
                  Step {state.current_step} of {totalSteps}: {steps?.find((s) => s.status === "active")?.name}
                </span>
              )}
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={resetting}
                  className="inline-flex items-center gap-1.5 rounded-card border border-charcoal/10 bg-white px-3 py-1.5 text-xs font-medium text-stone hover:border-rose/40 hover:text-rose disabled:opacity-50"
                  title="Reset the demo campaign back to step 1"
                >
                  <RotateCcw className="h-3 w-3" />
                  {resetting ? "Resetting..." : "Reset Demo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-7xl flex-1 overflow-hidden">
        {/* Left rail: vertical stepper */}
        <aside className="hidden w-[280px] flex-shrink-0 overflow-y-auto border-r border-charcoal/[0.06] px-6 py-6 md:block">
          <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone">
            Workflow
          </h2>
          <WorkflowPipeline
            personaId={personaId}
            steps={steps ?? undefined}
            revisionCounts={revisionCounts}
          />
        </aside>

        {/* Center: active step content */}
        <main className="flex-1 overflow-y-auto px-8 py-8">
          {pollError && (
            <div className="mb-4 rounded-card border border-rose/30 bg-rose/5 px-4 py-3 text-xs text-rose">
              Sync issue: {pollError}
            </div>
          )}

          <ActionPanel
            personaId={personaId}
            state={state}
            steps={steps ?? []}
            context={context}
            onLaunchSkill={launchSkillFromActionPanel}
            onRequestRevisions={handleOpenRevisionModal}
            onAdvanced={refresh}
            onInterceptApproval={handleInterceptApproval}
          />

          {centerExtras}
        </main>
      </div>

      {/* Floating AI drawer toggle button */}
      {!drawerOpen && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-white shadow-elevated transition-transform hover:scale-105 hover:bg-teal-700"
          title="Open AI Coworker"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}

      {/* Floating AI drawer */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-charcoal/10"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <div className="fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-[90vw] flex-col bg-white shadow-drawer animate-slide-in-right">
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-charcoal/[0.06] px-5 py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-600">
                  AI Coworker
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-card p-1.5 text-stone hover:bg-cream hover:text-charcoal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer content: scrollable area with AI panel + chat */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* AI Coworker panel (activity + invokable) */}
              <div className="overflow-y-auto border-b border-charcoal/[0.06] px-1 py-1" style={{ maxHeight: "45%" }}>
                <AICoworkerPanel
                  skills={skills}
                  campaignId={CAMPAIGN_ID}
                  onLaunchSkill={(kind) => {
                    setModal({ kind });
                    setDrawerOpen(false);
                  }}
                />
              </div>

              {/* Chat fills the rest */}
              <div className="flex-1 overflow-hidden">
                <ChatSidebar context={context} onAction={handleAction} />
              </div>
            </div>
          </div>
        </>
      )}

      <ResultsModal
        state={modal}
        onClose={() => setModal(null)}
        onSuccess={handleSkillSuccess}
      />

      {toast && <ToastBanner toast={toast} onClose={() => setToast(null)} />}

      <RevisionRequestModal
        state={revisionModal}
        onClose={() => {
          setRevisionModal(null);
          setRevisionError(null);
        }}
        onSubmit={handleSubmitRevision}
        busy={revisionBusy}
        error={revisionError}
      />

      {routingPending && context && (
        <AIRevisionRouting
          revisionComment={routingPending.comment}
          campaignId={CAMPAIGN_ID}
          campaignContext={{
            campaign_id: context.campaign_brief.campaign_id,
            title: context.campaign_brief.name,
            audience_segment: context.campaign_brief.target_customer,
            copy: context.campaign_brief.objective,
            skus: context.mock_data.sku_suggestions.map((s) => s.name).slice(0, 5),
            discount_pct: 15,
            regions: ["NY", "CA", "FL", "TX"],
          }}
          onConfirm={handleRoutingConfirm}
          onCancel={() => setRoutingPending(null)}
        />
      )}

      {cascadeActive && context && (
        <ApprovalCascade
          campaignId={CAMPAIGN_ID}
          campaignContext={{
            campaign_id: context.campaign_brief.campaign_id,
            title: context.campaign_brief.name,
            audience_segment: context.campaign_brief.target_customer,
            copy: context.campaign_brief.objective,
            skus: context.mock_data.sku_suggestions.map((s) => s.name).slice(0, 5),
            discount_pct: 15,
            regions: ["NY", "CA", "FL", "TX"],
          }}
          onDone={handleCascadeDone}
        />
      )}
    </div>
  );
}

function ToastBanner({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  let borderColor = "#0B7B8A60";
  let iconColor = "text-teal-600";
  let title = "";
  let body: React.ReactNode = null;

  if (toast.kind === "handoff") {
    title = `Step ${toast.fromStep} complete, Step ${toast.toStep} now active`;
    body = (
      <>
        Handing off to <strong className="text-charcoal">{toast.toOwner}</strong>{" "}
        <span className="text-stone">({toast.toTitle})</span>.
      </>
    );
  } else if (toast.kind === "revision_requested") {
    borderColor = "#D4A84360";
    iconColor = "text-gold";
    title = `Revision requested, sent back to Step ${toast.toStep}`;
    body = (
      <>
        Waiting on <strong className="text-charcoal">{toast.toOwner}</strong>{" "}
        <span className="text-stone">({toast.toTitle})</span> to resubmit.
        {toast.comment && (
          <div className="mt-1 text-stone">&ldquo;{toast.comment}&rdquo;</div>
        )}
      </>
    );
  } else if (toast.kind === "resubmitted") {
    borderColor = "#8DA67E60";
    iconColor = "text-sage";
    title = `Step ${toast.fromStep} resubmitted, Step ${toast.toStep} active again`;
    body = (
      <>
        Back to <strong className="text-charcoal">{toast.toOwner}</strong>{" "}
        <span className="text-stone">({toast.toTitle})</span> for review.
      </>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
      <div
        className="pointer-events-auto flex items-start gap-3 rounded-panel bg-white px-5 py-4 shadow-overlay"
        style={{ borderLeft: `3px solid ${borderColor}` }}
      >
        <ArrowRightCircle className={`mt-0.5 h-5 w-5 flex-shrink-0 ${iconColor}`} />
        <div className="max-w-sm text-sm">
          <div className="font-semibold text-charcoal">{title}</div>
          <div className="mt-0.5 text-stone">{body}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-3 text-xs text-stone hover:text-charcoal"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
