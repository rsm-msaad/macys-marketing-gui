"use client";

import { LayoutGrid } from "lucide-react";

import { ActionFooter, ContextStack, type StepContentProps } from "./shared";

const PLACEMENT_LABEL: Record<string, string> = {
  web_banner: "Web Banner",
  email: "Email",
  mobile: "Mobile",
  in_store_signage: "In-Store Signage",
};

export function LayoutAssemblyContent({
  context,
  canAct,
  busy,
  onApprove,
}: StepContentProps) {
  const layouts = context.mock_data.layout_previews;

  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Layout previews ({layouts.length} placements)
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {layouts.map((p) => (
            <div
              key={p.placement}
              className="rounded-md border border-charcoal/10 bg-cream/30 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">
                  {PLACEMENT_LABEL[p.placement] ?? p.placement}
                </span>
                <span className="text-[10px] text-charcoal/55">{p.dimensions}</span>
              </div>
              <div className="mt-2 font-serif text-sm font-semibold text-charcoal">
                {p.headline}
              </div>
              <div className="mt-1 text-[12px] text-charcoal/70">{p.subhead}</div>
              <div className="mt-2 text-[11px] font-medium text-teal-700">
                CTA: {p.cta}
              </div>
              <div className="mt-2 border-t border-charcoal/5 pt-2 text-[11px] italic text-charcoal/55">
                {p.notes}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ActionFooter
        canAct={canAct}
        busy={busy}
        cta="Approve layouts"
        ctaKind="approve"
        stepNumber={5}
        onClick={() =>
          onApprove("Approve Layout", {
            approved_layouts: layouts.map((l) => l.placement),
          })
        }
      />
    </div>
  );
}
