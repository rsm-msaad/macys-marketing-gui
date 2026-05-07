"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightCircle, RotateCcw } from "lucide-react";

import { ActionPanel } from "@/components/ActionPanel";
import { CampaignSidebar } from "@/components/CampaignSidebar";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ResultsModal, type ModalState } from "@/components/ResultsModal";
import { SkillCard, type SkillKind } from "@/components/SkillCard";
import { TopBar } from "@/components/TopBar";
import { WorkflowPipeline } from "@/components/WorkflowPipeline";
import {
  advanceCampaign,
  fetchCampaignContext,
  fetchCampaigns,
  fetchCampaignState,
  fetchWorkflow,
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
  fromStep: number;
  toStep: number;
  toOwner: string;
  toTitle: string;
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
  const [steps, setSteps] = useState<WorkflowStep[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [state, setState] = useState<CampaignState | null>(null);
  const [context, setContext] = useState<CampaignContext | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const lastStepRef = useRef<number | null>(null);

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

      // Detect step transition for handoff toast.
      const prevStep = lastStepRef.current;
      const newStep = st.current_step;
      lastStepRef.current = newStep;
      if (prevStep !== null && newStep !== prevStep && !st.is_complete && newStep <= 10) {
        const fromOwner = prevStep <= 10 ? getStepOwnerName(prevStep) : "";
        const toOwner = getStepOwnerName(newStep);
        if (fromOwner !== toOwner) {
          const id = Date.now();
          setToast({
            id,
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
      const cur = stateRef.current;
      if (!cur || cur.is_complete) return;
      const target = SKILL_STEP[kind];
      if (cur.current_step !== target) return;
      // Authority gate: only auto-advance when the viewer owns the step.
      // (The user may still manually click Approve from a different tab.)
      if (!isStepOwnedBy(target, personaId)) return;
      try {
        const next = await advanceCampaign(CAMPAIGN_ID, target, `Ran ${kind}`);
        setState(next);
        const w = await fetchWorkflow(personaId);
        setSteps(w.steps);
      } catch {
        // Race or already advanced; the next poll reconciles.
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

  async function handleReset() {
    setResetting(true);
    try {
      await resetCampaign(CAMPAIGN_ID);
      lastStepRef.current = 1;
      await refresh();
    } catch (e) {
      setPollError((e as Error).message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <TopBar activePersonaId={personaId} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="hidden w-[240px] flex-shrink-0 flex-col overflow-y-auto border-r border-charcoal/10 bg-white md:flex">
          <CampaignSidebar
            campaigns={campaigns ?? undefined}
            activeOwnerName={
              state && !state.is_complete
                ? getStepOwnerName(state.current_step)
                : null
            }
          />
          <nav className="px-4 py-4">
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-charcoal/55">
              Workspace
            </h2>
            <ul className="space-y-1 text-sm">
              {leftNav.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    className={`block w-full rounded-md px-3 py-2 text-left ${
                      item.active
                        ? "bg-cream font-semibold text-charcoal"
                        : "text-charcoal/60 hover:bg-cream"
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Center */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <header className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-2xl font-semibold text-charcoal">{headline}</h1>
              <p className="mt-1 text-sm text-charcoal/65">{subhead}</p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium text-charcoal/65 hover:border-soft_red/40 hover:text-soft_red disabled:opacity-50"
              title="Reset the demo campaign back to step 1"
            >
              <RotateCcw className="h-3 w-3" />
              {resetting ? "Resetting…" : "Reset Demo"}
            </button>
          </header>

          {pollError && (
            <div className="mb-3 rounded-md border border-soft_red/30 bg-soft_red/5 px-3 py-2 text-xs text-soft_red">
              Sync issue: {pollError}
            </div>
          )}

          <div className="mb-4">
            <WorkflowPipeline personaId={personaId} steps={steps ?? undefined} />
          </div>

          <div className="mb-5">
            <ActionPanel
              personaId={personaId}
              state={state}
              steps={steps ?? []}
              context={context}
              onLaunchSkill={launchSkillFromActionPanel}
              onAdvanced={refresh}
            />
          </div>

          {centerExtras}

          <section className="mt-5">
            <h2 className="mb-3 font-serif text-lg font-semibold text-charcoal">Your skills</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {skills.map((kind) => (
                <SkillCard key={kind} kind={kind} onLaunch={() => setModal({ kind })} />
              ))}
            </div>
          </section>
        </main>

        {/* Right chat */}
        <div className="hidden w-[360px] flex-shrink-0 lg:block">
          <ChatSidebar personaId={personaId} onAction={handleAction} />
        </div>
      </div>

      <ResultsModal
        state={modal}
        onClose={() => setModal(null)}
        onSuccess={handleSkillSuccess}
      />

      {/* Handoff toast */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <div className="pointer-events-auto flex items-start gap-3 rounded-lg border border-teal-600/40 bg-white px-4 py-3 shadow-lg">
            <ArrowRightCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-600" />
            <div className="text-sm">
              <div className="font-semibold text-charcoal">
                Step {toast.fromStep} complete · Step {toast.toStep} now active
              </div>
              <div className="text-charcoal/65">
                Handing off to <strong className="text-charcoal/85">{toast.toOwner}</strong>{" "}
                <span className="text-charcoal/50">({toast.toTitle})</span>.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 text-xs text-charcoal/45 hover:text-charcoal"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
