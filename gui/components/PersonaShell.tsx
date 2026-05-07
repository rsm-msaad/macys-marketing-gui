"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { ActionPanel } from "@/components/ActionPanel";
import { CampaignSidebar } from "@/components/CampaignSidebar";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ResultsModal, type ModalState } from "@/components/ResultsModal";
import { SkillCard, type SkillKind } from "@/components/SkillCard";
import { TopBar } from "@/components/TopBar";
import { WorkflowPipeline } from "@/components/WorkflowPipeline";
import {
  advanceCampaign,
  fetchCampaigns,
  fetchCampaignState,
  fetchWorkflow,
  resetCampaign,
  type Campaign,
  type CampaignState,
  type WorkflowStep,
} from "@/lib/api";
import { ACTION_TO_SKILL } from "@/lib/scripted-chat";

type LeftNavItem = { label: string; active?: boolean };

const CAMPAIGN_ID = "MDC-2026-MD-001";
const POLL_INTERVAL_MS = 5_000;

// Map a skill modal's kind to the workflow step it satisfies. After a skill
// runs successfully we use this to advance the campaign automatically.
const SKILL_STEP: Record<SkillKind, number> = {
  segment: 2,
  dam: 4,
  localize: 7,
  analyze: 9,
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
  const [pollError, setPollError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [w, cs, st] = await Promise.all([
        fetchWorkflow(personaId),
        fetchCampaigns(),
        fetchCampaignState(CAMPAIGN_ID),
      ]);
      setSteps(w.steps);
      setCampaigns(cs);
      setState(st);
      setPollError(null);
    } catch (e) {
      setPollError((e as Error).message);
    }
  }, [personaId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Auto-advance: when a skill runs successfully and matches the current
  // step, mark the step complete server-side. We use a ref to read the
  // freshest state without making the callback identity churn.
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
      try {
        const next = await advanceCampaign(
          CAMPAIGN_ID,
          target,
          `Ran ${kind}`,
        );
        setState(next);
        // Workflow step statuses depend on state; refresh to sync them.
        const w = await fetchWorkflow(personaId);
        setSteps(w.steps);
      } catch {
        // Race or already-advanced; the next poll will reconcile.
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
        {/* Left sidebar: campaigns panel + workspace nav */}
        <aside className="hidden w-[240px] flex-shrink-0 flex-col overflow-y-auto border-r border-charcoal/10 bg-white md:flex">
          <CampaignSidebar campaigns={campaigns ?? undefined} />
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
    </div>
  );
}
