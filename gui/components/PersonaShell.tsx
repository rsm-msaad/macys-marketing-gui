"use client";

import { useState } from "react";

import { CampaignSidebar } from "@/components/CampaignSidebar";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ResultsModal, type ModalState } from "@/components/ResultsModal";
import { SkillCard, type SkillKind } from "@/components/SkillCard";
import { TopBar } from "@/components/TopBar";
import { WorkflowPipeline } from "@/components/WorkflowPipeline";
import { ACTION_TO_SKILL } from "@/lib/scripted-chat";

type LeftNavItem = { label: string; active?: boolean };

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

  function handleAction(action: string, data: Record<string, unknown> | null) {
    const kind = ACTION_TO_SKILL[action];
    if (kind) {
      setModal({ kind, prefill: data ?? undefined });
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <TopBar activePersonaId={personaId} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: campaigns panel + workspace nav */}
        <aside className="hidden w-[240px] flex-shrink-0 flex-col overflow-y-auto border-r border-charcoal/10 bg-white md:flex">
          <CampaignSidebar />
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
          <header className="mb-5">
            <h1 className="font-serif text-2xl font-semibold text-charcoal">{headline}</h1>
            <p className="mt-1 text-sm text-charcoal/65">{subhead}</p>
          </header>

          <div className="mb-5">
            <WorkflowPipeline personaId={personaId} />
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

      <ResultsModal state={modal} onClose={() => setModal(null)} />
    </div>
  );
}
