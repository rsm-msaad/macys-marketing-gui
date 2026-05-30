"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AnimatePresence } from "framer-motion";
import { ArrowRightCircle, BarChart3, BookOpen, Bot, Check, Circle, Cog, Database, Factory, LayoutDashboard, Lock, MessageCircle, RotateCcw, Settings, TrendingUp, User, X, Brain } from "lucide-react";

import { ActionPanel } from "@/components/ActionPanel";
import { FloatingPersonaAvatar } from "@/components/FloatingPersonaAvatar";
import { AIRevisionRouting } from "@/components/AIRevisionRouting";
import { ApprovalCascade } from "@/components/ApprovalCascade";
import { CampaignSidebar } from "@/components/CampaignSidebar";
import { ChatSidebar } from "@/components/ChatSidebar";
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
import { usePersona, usePersonas } from "@/components/PersonaContext";
import { STEP_VIDEO } from "@/components/steps/shared";

const OWNER_AVATAR: Record<string, { name: string; avatar: string }> = {
  "campaign-manager": { name: "Merna", avatar: "/avatars/merna.png" },
  "senior-designer": { name: "Abdullah", avatar: "/avatars/abdullah.png" },
  "production-artist": { name: "Shankar", avatar: "/avatars/shankar.png" },
  "marketing-analyst": { name: "Anna", avatar: "/avatars/anna.png" },
  "ceo": { name: "Prof. Vincent", avatar: "/avatars/vincent.png" },
  "thales": { name: "Prof. Thales", avatar: "/avatars/thales.png" },
};
import { ACTION_TO_SKILL } from "@/lib/scripted-chat";
import {
  getStepOwnerName,
  getStepOwnerTitle,
  isStepOwnedBy,
} from "@/lib/authorities";

type LeftNavItem = { label: string; active?: boolean; href?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LucideIconComponent = React.ComponentType<any>;

const NAV_ICON: Record<string, LucideIconComponent> = {
  Dashboard: BarChart3,
  Campaigns: BookOpen,
  "Knowledge Base": Database,
  Analytics: TrendingUp,
  "All Campaigns": BookOpen,
  "All Steps": LayoutDashboard,
  Overrides: Settings,
};

const DEFAULT_CAMPAIGN_ID = "MDC-2026-MD-001";
const POLL_INTERVAL_MS = 5_000;

const SKILL_STEP: Record<SkillKind, number> = {
  segment: 2,
  "sku-recommend": 3,
  dam: 4,
  "layout-copy": 5,
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
  // For revision toasts:
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
  const [campaignId, setCampaignId] = useState<string>(DEFAULT_CAMPAIGN_ID);
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
  const [chatOpen, setChatOpen] = useState(false);
  const [stepPanelOpen, setStepPanelOpen] = useState(false);
  const [viewingStep, setViewingStep] = useState<number | null>(null);

  const isActiveCampaign = campaignId === DEFAULT_CAMPAIGN_ID;

  function handleSelectCampaign(id: string) {
    setCampaignId(id);
    // Clear stale state from previous campaign
    setSteps(null);
    setState(null);
    setContext(null);
    setToast(null);
    setPollError(null);
  }

  // Close chat on ESC key
  useEffect(() => {
    if (!chatOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setChatOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen]);

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
        fetchWorkflow(personaId, campaignId),
        fetchCampaigns(),
        fetchCampaignState(campaignId),
        fetchCampaignContext(campaignId),
      ]);
      setSteps(w.steps);
      setCampaigns(cs);
      setState(st);
      setContext(ctx);
      setPollError(null);

      // Detect transitions to fire toasts. Three cases:
      //   1. Handoff to a new persona on a normal step advance.
      //   2. Revision requested (pending_revision goes null -> set).
      //   3. Resubmit happened (pending_revision goes set -> null).
      const prevStep = lastStepRef.current;
      const wasPending = lastPendingRef.current;
      const newStep = st.current_step;
      const isPending = st.pending_revision !== null;
      lastStepRef.current = newStep;
      lastPendingRef.current = isPending;

      const id = Date.now();
      if (!wasPending && isPending && st.pending_revision) {
        // Revision just requested.
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
        // Just resubmitted; campaign returned to resume_step.
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
  }, [personaId, campaignId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Toast auto dismiss.
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
      // Steps with inline selection advance via their own Lock In button.
      if (kind === "segment" || kind === "dam" || kind === "localize" || kind === "analyze") return;
      const cur = stateRef.current;
      if (!cur || cur.is_complete) return;
      const target = SKILL_STEP[kind];
      if (cur.current_step !== target) return;
      // Authority gate: only auto-advance when the viewer owns the step.
      // (The user may still manually click Approve from a different tab.)
      if (!isStepOwnedBy(target, personaId)) return;
      try {
        const next = await advanceCampaign(campaignId, target, `Ran ${kind}`);
        setState(next);
        const w = await fetchWorkflow(personaId, campaignId);
        setSteps(w.steps);
      } catch {
        // Race or already advanced; the next poll reconciles.
      }
    },
    [personaId, campaignId],
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
    // Close the revision modal and show AI routing panel (Feature 3)
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
      await requestRevisions(
        campaignId,
        fromStep,
        sendBackToStep,
        comment,
        personaId,
      );
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
      await resetCampaign(campaignId);
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

  // Intercept step 6 approval to show cascade animation (Feature 4)
  const [cascadeOutput, setCascadeOutput] = useState<Record<string, unknown> | undefined>(undefined);

  function handleInterceptApproval(step: number, action: string, output?: Record<string, unknown>): boolean {
    if (step === 6) {
      setCascadeOutput(output);
      setCascadeActive(true);
      return true; // intercepted
    }
    return false;
  }

  async function handleCascadeDone() {
    setCascadeActive(false);
    // Now actually advance the campaign
    try {
      await advanceCampaignWithOutput(campaignId, 6, "Final Approval", cascadeOutput);
      await refresh();
    } catch (e) {
      setPollError((e as Error).message);
    }
  }

  // Revision counts for the WorkflowPipeline badges.
  const revisionCounts: Record<string, number> = {};
  if (state) {
    for (const [stepStr, list] of Object.entries(state.revisions)) {
      revisionCounts[stepStr] = list.length;
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <div className="workspace-grain" />
      <FloatingPersonaAvatar personaId={personaId} />
      <TopBar activePersonaId={personaId} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - slides in from left */}
        <motion.aside
          initial={{ x: -240, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
          className="hidden w-[240px] flex-shrink-0 flex-col overflow-y-auto sidebar-glass md:flex"
        >
          <CampaignSidebar
            campaigns={campaigns ?? undefined}
            activeOwnerName={
              state && !state.is_complete
                ? getStepOwnerName(state.current_step)
                : null
            }
            selectedCampaignId={campaignId}
            onSelectCampaign={handleSelectCampaign}
          />
          <nav className="px-4 py-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-charcoal/55">
              Workspace
            </h2>
            <ul className="space-y-1 text-sm">
              {leftNav.map((item) => {
                const NavIcon = NAV_ICON[item.label];
                const activeClasses = item.active
                  ? "nav-item-active font-semibold text-charcoal border-l-2 border-teal-600"
                  : "text-charcoal/60 border-l-2 border-transparent";
                const sharedClasses = `flex items-center w-full px-3 py-2 text-left text-sm nav-item-glass ${activeClasses}`;
                return (
                  <li key={item.label}>
                    {item.href ? (
                      <a href={item.href} className={sharedClasses}>
                        {NavIcon && <NavIcon className="h-4 w-4 mr-2 flex-shrink-0" />}
                        {item.label}
                      </a>
                    ) : (
                      <button type="button" className={sharedClasses}>
                        {NavIcon && <NavIcon className="h-4 w-4 mr-2 flex-shrink-0" />}
                        {item.label}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </motion.aside>

        {/* Center - simple page with header + pipeline */}
        <main className="flex-1 overflow-y-auto px-6 py-6 relative">
          {/* Ambient floating orbs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="ambient-orb ambient-orb-teal" style={{ width: 400, height: 400, top: '-10%', left: '15%' }} />
            <div className="ambient-orb ambient-orb-sage" style={{ width: 350, height: 350, bottom: '5%', right: '10%' }} />
            <div className="ambient-orb ambient-orb-gold" style={{ width: 280, height: 280, top: '40%', left: '60%' }} />
          </div>

          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-2xl font-semibold text-charcoal tracking-wide">
                {context && !isActiveCampaign ? context.campaign_brief.name : headline}
              </h1>
              <p className="mt-1 text-sm text-charcoal/65">
                {context && !isActiveCampaign
                  ? context.campaign_brief.objective
                  : subhead}
              </p>
            </div>
            {isActiveCampaign && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Reset the demo? This will clear all campaign data.")) {
                    handleReset();
                  }
                }}
                disabled={resetting}
                className="btn-reset-glass inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-charcoal/65 hover:text-soft_red disabled:opacity-50"
                title="Reset the demo campaign back to step 1"
              >
                <RotateCcw className="h-3 w-3" />
                {resetting ? "Resetting..." : "Reset Demo"}
              </button>
            )}
          </motion.header>

          {pollError && (
            <div className="mb-3 rounded-md border border-soft_red/30 bg-soft_red/5 px-3 py-2 text-xs text-soft_red">
              Sync issue: {pollError}
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mb-4"
          >
            <WorkflowPipeline
              personaId={personaId}
              steps={steps ?? undefined}
              revisionCounts={revisionCounts}
              onStepClick={() => setStepPanelOpen(true)}
            />
          </motion.div>

          {centerExtras}

          <section className="mt-5">
            <AICoworkerPanel
              skills={skills}
              campaignId={campaignId}
              currentStep={state?.is_complete ? null : state?.current_step ?? null}
            />
          </section>
        </main>

      </div>

      {/* Floating bottom right buttons */}
      {!chatOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
          <Link
            href="/rag-compare"
            className="fab-glass flex h-10 w-10 items-center justify-center rounded-full text-teal-600"
            title="RAG Comparison Demo"
          >
            <Database className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="fab-primary flex items-center gap-2 rounded-full px-4 py-3 text-white"
            title="Open Claude Chat"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs font-semibold">Chat with Claude</span>
          </button>
        </div>
      )}

      {/* Chat modal - z-[70] so it layers above everything */}
      {chatOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-backdrop-in"
          style={{ backgroundColor: "rgba(25,25,25,0.5)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setChatOpen(false);
          }}
        >
          <div className="relative flex h-[85vh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-white/50 animate-modal-in">
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-charcoal/50 hover:bg-cream hover:text-charcoal"
            >
              <X className="h-4 w-4" />
            </button>
            <ChatSidebar context={context} onAction={handleAction} />
          </div>
        </div>
      )}

      {/* Floating card overlay - persona switcher top, workflow left, detail right */}
      <AnimatePresence>
        {stepPanelOpen && state && !state.is_complete && state.current_step <= 10 && (
          <StepOverlay
            personaId={personaId}
            campaignId={campaignId}
            state={state}
            steps={steps ?? []}
            context={context}
            onClose={() => setStepPanelOpen(false)}
            onLaunchSkill={launchSkillFromActionPanel}
            onRequestRevisions={handleOpenRevisionModal}
            onAdvanced={async () => { setStepPanelOpen(false); await refresh(); }}
            onInterceptApproval={handleInterceptApproval}
            onOpenChat={() => setChatOpen(true)}
          />
        )}
      </AnimatePresence>

      <ResultsModal
        state={modal}
        onClose={() => setModal(null)}
        onSuccess={handleSkillSuccess}
      />

      {/* Handoff / revision toast */}
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

      {/* AI Revision Routing overlay (Feature 3) */}
      {routingPending && context && (
        <AIRevisionRouting
          revisionComment={routingPending.comment}
          campaignId={campaignId}
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

      {/* AI Cascade overlay (Feature 4) */}
      {cascadeActive && context && (
        <ApprovalCascade
          campaignId={campaignId}
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

/* ─── Step Overlay: persona switcher + workflow list + detail card ─── */

function StepOverlay({
  personaId,
  campaignId,
  state,
  steps,
  context,
  onClose,
  onLaunchSkill,
  onRequestRevisions,
  onAdvanced,
  onInterceptApproval,
  onOpenChat,
}: {
  personaId: string;
  campaignId: string;
  state: CampaignState;
  steps: WorkflowStep[];
  context: CampaignContext | null;
  onClose: () => void;
  onLaunchSkill: (skill: import("@/components/SkillCard").SkillKind) => void;
  onRequestRevisions: (from: number, to: number) => void;
  onAdvanced: () => void;
  onInterceptApproval: (step: number, action: string, output?: Record<string, unknown>) => boolean;
  onOpenChat: () => void;
}) {
  const { personas } = usePersonas();
  const router = useRouter();
  const isCeo = personaId === "ceo" || personaId === "thales";
  const completedCount = state.completed_steps?.length ?? 0;
  const pct = Math.round((completedCount / 10) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch animate-backdrop-in"
      style={{ backgroundColor: "rgba(25,25,25,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Full-screen layout */}
      <div className="flex gap-0 w-full h-full">
        {/* LEFT - Slim workflow list */}
        <motion.div
          initial={{ opacity: 0, x: -30, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="w-[210px] flex-shrink-0 overflow-y-auto rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-white/50 p-3"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-sm font-semibold text-charcoal">Workflow</h3>
            <span className="text-xs font-bold text-teal-600">{pct}%</span>
          </div>
          {/* Mini progress bar */}
          <div className="mb-3 h-1.5 rounded-full bg-charcoal/5 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-sage transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <div className="space-y-1">
            {steps.map((step) => {
              const isActive = step.status === "active";
              const isComplete = step.status === "complete";
              const ownerMeta = OWNER_AVATAR[step.owner_persona_id];
              const ceoMeta = isCeo ? OWNER_AVATAR[personaId] : null;
              return (
                <div
                  key={step.number}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all ${
                    isActive
                      ? "bg-teal-50 border border-teal-500/25"
                      : isComplete
                        ? "bg-sage/5 border border-sage/10"
                        : "border border-transparent"
                  }`}
                >
                  <span className={`font-serif text-sm font-bold w-4 text-center ${isActive ? "text-teal-600" : isComplete ? "text-sage" : "text-charcoal/15"}`}>
                    {step.number}
                  </span>
                  {isComplete && <Check className="h-3 w-3 text-sage flex-shrink-0" />}
                  {isActive && <Circle className="h-3 w-3 text-mustard fill-mustard flex-shrink-0" />}
                  {!isComplete && !isActive && <Lock className="h-2.5 w-2.5 text-charcoal/12 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-semibold leading-tight truncate ${isActive ? "text-teal-700" : isComplete ? "text-charcoal/65" : "text-charcoal/30"}`}>
                      {step.name}
                    </div>
                  </div>
                  {/* Owner avatar */}
                  <div className="flex items-center -space-x-1.5 flex-shrink-0">
                    {ownerMeta && (
                      <div className="h-5 w-5 rounded-full border-[1.5px] border-white overflow-hidden" title={ownerMeta.name}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ownerMeta.avatar} alt={ownerMeta.name} className="h-full w-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement!.classList.add("bg-teal-600","flex","items-center","justify-center","text-[7px]","font-bold","text-white"); e.currentTarget.parentElement!.textContent = ownerMeta.name.charAt(0); }}
                        />
                      </div>
                    )}
                    {ceoMeta && isActive && (
                      <div className="h-5 w-5 rounded-full border-[1.5px] border-teal-300 overflow-hidden" title={`${ceoMeta.name} reviewing`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ceoMeta.avatar} alt={ceoMeta.name} className="h-full w-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement!.classList.add("bg-teal-600","flex","items-center","justify-center","text-[7px]","font-bold","text-white"); e.currentTarget.parentElement!.textContent = ceoMeta.name.charAt(0); }}
                        />
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <span className="rounded-full bg-teal-600 px-1 py-0.5 text-[6px] font-bold tracking-wider text-white flex-shrink-0">
                      ACTIVE
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* RIGHT - Step detail card with video background */}
        <motion.div
          initial={{ opacity: 0, x: 30, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="flex-1 flex flex-col overflow-hidden rounded-2xl shadow-2xl border border-white/50 bg-white"
        >
          {/* Clean text header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-charcoal/10 flex-shrink-0">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-teal-600/70">Step {state.current_step}</div>
              <div className="text-base font-serif font-semibold text-charcoal">
                {steps.find(s => s.number === state.current_step)?.name ?? `Step ${state.current_step}`}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-charcoal/15 text-charcoal/50 hover:bg-charcoal/5 hover:text-charcoal transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Scrollable content - opaque for readability */}
          <div className="flex-1 overflow-y-auto px-5 py-4 bg-white">
            <ActionPanel
              personaId={personaId}
              campaignId={campaignId}
              state={state}
              steps={steps}
              context={context}
              onLaunchSkill={onLaunchSkill}
              onRequestRevisions={onRequestRevisions}
              onAdvanced={onAdvanced}
              onInterceptApproval={onInterceptApproval}
            />
          </div>
        </motion.div>

        {/* FAR RIGHT - Persona switcher + Step type info */}
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 10, scale: 0.95 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="w-[180px] flex-shrink-0 overflow-y-auto rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-white/50 p-3"
        >
          {/* Persona switcher */}
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-charcoal/40 mb-2">Team</div>
          <div className="space-y-1 mb-4 pb-3 border-b border-charcoal/8">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onClose(); router.push(`/${p.id}`); }}
                className={`flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
                  p.id === personaId
                    ? "bg-teal-50 text-teal-700 ring-1 ring-teal-500/25"
                    : "text-charcoal/50 hover:bg-charcoal/5"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.avatar} alt={p.name} className="h-5 w-5 rounded-full object-cover flex-shrink-0"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
                {p.name}
              </button>
            ))}
          </div>
          <StepTypeCard stepNumber={state.current_step} label={steps.find(s => s.number === state.current_step)?.label ?? "HUMAN_ONLY"} />

        </motion.div>
      </div>

      {/* Floating Chat with Claude icon - top right of overlay */}
      <button
        type="button"
        onClick={onOpenChat}
        className="fixed bottom-6 right-6 z-[55] fab-primary flex items-center gap-2 rounded-full px-4 py-2.5 text-white"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="text-[11px] font-semibold">Chat with Claude</span>
      </button>
    </div>
  );
}

const STEP_TYPE_INFO: Record<string, { icon: LucideIconComponent; title: string; color: string; desc: string }> = {
  HUMAN_ONLY: { icon: User, title: "Human Task", color: "#8C2727", desc: "This step is performed entirely by a human. No AI, automation, or tools are involved." },
  HUMAN_PLUS_AI: { icon: Bot, title: "Human + AI Skill", color: "#3F5A1F", desc: "A human initiates and reviews, but an LLM skill provides AI-generated analysis or content." },
  HUMAN_PLUS_AUTOMATION: { icon: Cog, title: "Human + Automation", color: "#57534E", desc: "A human reviews results from a deterministic automation - rule-based code, no LLM needed." },
  HUMAN_PLUS_SKILL: { icon: Brain, title: "Human + AI Skill", color: "#0B7B8A", desc: "An AI skill uses LLM judgment (Claude) because the task requires reasoning, not just rules." },
  FULLY_AUTOMATED: { icon: Factory, title: "Fully Automated", color: "#444444", desc: "Runs without human involvement. Deterministic code handles the entire step." },
};

const STEP_TOOLS: Record<number, string[]> = {
  2: ["Segmentation Engine (automation)"],
  3: ["SKU Recommender (automation)", "macys.db catalog"],
  4: ["find_dam_assets (Python helper)"],
  5: ["Layout + Copy Generator (LLM skill)"],
  6: ["Compliance Pre-Check (agentic LLM)", "check_pricing_conflicts (MCP tool)", "Approval Brief Generator (agentic LLM)"],
  7: ["generate_locale_variants (Python helper)"],
  8: ["Activation Scheduler (automation)"],
  9: ["Analytics Engine (automation)"],
  10: ["Campaign Summary (LLM skill)", "send_campaign_summary (MCP tool)"],
};

function StepTypeCard({ stepNumber, label }: { stepNumber: number; label: string }) {
  const info = STEP_TYPE_INFO[label] ?? STEP_TYPE_INFO.HUMAN_ONLY;
  const tools = STEP_TOOLS[stepNumber] ?? [];
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-[0.15em] text-charcoal/40 mb-2">Step Type</div>
      <div className="flex items-center gap-2 mb-2">
        <info.icon size={16} style={{ color: info.color }} />
        <span className="text-[11px] font-bold" style={{ color: info.color }}>{info.title}</span>
      </div>
      <p className="text-xs leading-relaxed text-charcoal/50 mb-3">{info.desc}</p>
      {tools.length > 0 && (
        <>
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-charcoal/40 mb-1.5">Tools Used</div>
          <div className="space-y-1">
            {tools.map((t) => (
              <div key={t} className="flex items-start gap-1.5">
                <span className="mt-0.5 h-1 w-1 rounded-full bg-teal-500 flex-shrink-0" />
                <span className="text-xs text-charcoal/55 leading-tight">{t}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ToastBanner({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  let borderClass = "border-teal-600/40";
  let iconClass = "text-teal-600";
  let title = "";
  let body: React.ReactNode = null;

  if (toast.kind === "handoff") {
    title = `Step ${toast.fromStep} complete · Step ${toast.toStep} now active`;
    body = (
      <>
        Handing off to <strong className="text-charcoal/85">{toast.toOwner}</strong>{" "}
        <span className="text-charcoal/50">({toast.toTitle})</span>.
      </>
    );
  } else if (toast.kind === "revision_requested") {
    borderClass = "border-mustard/60";
    iconClass = "text-mustard";
    title = `Revision requested · sent back to Step ${toast.toStep}`;
    body = (
      <>
        Waiting on <strong className="text-charcoal/85">{toast.toOwner}</strong>{" "}
        <span className="text-charcoal/50">({toast.toTitle})</span> to resubmit.
        {toast.comment && (
          <div className="mt-1 italic text-charcoal/55">“{toast.comment}”</div>
        )}
      </>
    );
  } else if (toast.kind === "resubmitted") {
    borderClass = "border-sage/60";
    iconClass = "text-sage";
    title = `Step ${toast.fromStep} resubmitted · Step ${toast.toStep} active again`;
    body = (
      <>
        Back to <strong className="text-charcoal/85">{toast.toOwner}</strong>{" "}
        <span className="text-charcoal/50">({toast.toTitle})</span> for review.
      </>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
      <div
        className={`pointer-events-auto flex items-start gap-3 border ${borderClass} toast-glass px-4 py-3`}
      >
        <ArrowRightCircle className={`mt-0.5 h-5 w-5 flex-shrink-0 ${iconClass}`} />
        <div className="max-w-sm text-sm">
          <div className="font-semibold text-charcoal">{title}</div>
          <div className="text-charcoal/65">{body}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-xs text-charcoal/45 hover:text-charcoal"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
