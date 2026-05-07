"use client";

import { Globe, Sparkles } from "lucide-react";

import { ActionFooter, ContextStack, type StepContentProps } from "./shared";

const REGIONS = [
  "Northeast",
  "Mid-Atlantic",
  "Southeast",
  "Midwest-North",
  "Midwest-South",
  "South",
  "Southwest",
  "Mountain",
  "Pacific-Northwest",
  "Pacific-Southwest",
];

const PLACEMENTS = ["web_banner", "email", "in_store_signage", "mobile"];

export function LocalizationContent({
  context,
  canAct,
  busy,
  onApprove,
  onLaunchSkill,
}: StepContentProps) {
  const variantCount = REGIONS.length * PLACEMENTS.length * 2; // 2 master SKUs
  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Skill: Localization Generator (fully automated)
          </span>
        </div>
        <p className="text-sm text-charcoal/70">
          Spin up {REGIONS.length} regions × {PLACEMENTS.length} placements ×
          2 master SKUs = <strong className="text-charcoal">{variantCount}</strong>{" "}
          regionally-voiced variants in one shot. Pricing pulled from
          regional_pricing, copy templated by regional_context, dimensions
          stamped per placement.
        </p>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-md border border-charcoal/10 bg-cream/30 p-3 text-[11px] text-charcoal/75">
            <div className="font-semibold text-charcoal">Regions</div>
            <div className="mt-1 leading-relaxed">{REGIONS.join(" · ")}</div>
          </div>
          <div className="rounded-md border border-charcoal/10 bg-cream/30 p-3 text-[11px] text-charcoal/75">
            <div className="font-semibold text-charcoal">Placements</div>
            <div className="mt-1 leading-relaxed">{PLACEMENTS.join(" · ")}</div>
          </div>
        </div>

        {canAct && (
          <button
            type="button"
            onClick={() => onLaunchSkill("localize")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-teal-600 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
          >
            <Globe className="h-3 w-3" />
            Open the skill to inspect generated variants →
          </button>
        )}
      </div>

      <ActionFooter
        canAct={canAct}
        busy={busy}
        cta={`Confirm ${variantCount} variants`}
        ctaKind="skill"
        hint="Running the skill auto-advances the campaign on success."
        stepNumber={7}
        onClick={() =>
          onApprove("Confirm Variants", { variant_count: variantCount })
        }
      />
    </div>
  );
}
