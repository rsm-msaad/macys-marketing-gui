"use client";

import { Image as ImageIcon, Sparkles } from "lucide-react";

import { ActionFooter, ContextStack, type StepContentProps } from "./shared";

const HERO_PICKS = [
  "Spring Beauty editorial photo (4K, free rights)",
  "Lipstick close up flatlay (HD, free rights)",
  "Mother's Day gift set lifestyle shot (4K, free rights)",
  "Skincare hero on cream backdrop (4K, free rights)",
  "Beauty counter in store still (HD, restricted to in store use)",
  "Mascara application close up (HD, free rights)",
];

export function CreativeProductionContent({
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
            Skill: DAM Asset Finder
          </span>
        </div>
        <p className="text-sm text-charcoal/70">
          Filter the 5,000-asset DAM down to clean, on-brief candidates,
          ranked by tag relevance with photo-backed assets bucketed first so
          the thumbnail grid renders real images.
        </p>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {HERO_PICKS.map((label) => (
            <div
              key={label}
              className="flex items-start gap-2 rounded-md border border-charcoal/10 bg-cream/30 px-3 py-2 text-[12px] text-charcoal/80"
            >
              <ImageIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-teal-600" />
              {label}
            </div>
          ))}
        </div>

        {canAct && (
          <button
            type="button"
            onClick={() => onLaunchSkill("dam")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-teal-600 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
          >
            Open the skill to browse all ranked assets →
          </button>
        )}
      </div>

      <ActionFooter
        canAct={canAct}
        busy={busy}
        cta="Approve hero assets"
        ctaKind="approve"
        stepNumber={4}
        onClick={() =>
          onApprove("Approve Assets", {
            approved_asset_count: HERO_PICKS.length,
          })
        }
      />
    </div>
  );
}
