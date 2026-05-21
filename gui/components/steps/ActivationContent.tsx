"use client";

import { Radio, Send } from "lucide-react";

import { ApprovalActions, ContextStack, type StepContentProps } from "./shared";

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  web: "Web",
  mobile: "Mobile",
  in_store: "In-Store",
  paid_social: "Paid Social",
};

export function ActivationContent({
  context,
  canAct,
  busy,
  onApprove,
  onRequestRevisions,
}: StepContentProps) {
  const schedule = context.mock_data.channel_schedule;

  // Read upstream: localization variants from Step 7
  const locOutput = context.state.step_outputs["7"] as Record<string, unknown> | undefined;
  const variantCount = (locOutput?.variant_count as number | undefined) ?? 0;
  const locRegions = (locOutput?.regions as string[] | undefined) ?? [];

  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      {/* Upstream context: reading from Step 7 */}
      {variantCount > 0 && (
        <div className="rounded-md border border-blue-200/50 bg-blue-50/30 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
            Reading from Step 7: Localization
          </div>
          <div className="mt-0.5 text-[11px] text-charcoal/65">
            <strong>{variantCount} variants</strong> across {locRegions.length} regions locked in — activation covers all localized placements.
          </div>
        </div>
      )}

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Channel deployment schedule ({schedule.length})
          </span>
        </div>
        <div className="space-y-2">
          {schedule.map((c) => (
            <div
              key={c.channel}
              className="grid grid-cols-[120px_1fr] gap-3 rounded-md border border-charcoal/10 bg-cream/30 px-3 py-2 text-[12px]"
            >
              <div className="flex flex-col">
                <span className="font-semibold text-charcoal">
                  {CHANNEL_LABEL[c.channel] ?? c.channel}
                </span>
                <span className="text-[10px] text-charcoal/55">{c.deployment_time}</span>
              </div>
              <div className="text-charcoal/75">
                <div>{c.audience}</div>
                <div className="text-charcoal/55">{c.expected_volume}</div>
                <div className="mt-0.5 inline-block rounded-full bg-mustard/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-mustard">
                  {c.status}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-start gap-2 text-[12px] text-charcoal/70">
          <Send className="mt-0.5 h-3 w-3 flex-shrink-0 text-teal-600" />
          Activating pushes all 5 channels live in deployment order. Email and
          paid social fire Tuesday morning; web and mobile go live at midnight
          Wednesday; in-store kits arrive Thursday.
        </p>
      </div>

      <ApprovalActions
        canAct={canAct}
        busy={busy}
        primaryLabel="Activate Campaign"
        primaryKind="send"
        secondaryLabel="Hold for Revisions"
        stepNumber={8}
        onPrimary={() =>
          onApprove("Activate Campaign", {
            channels: schedule.map((c) => c.channel),
            locale_variant_count: variantCount,
            locale_regions: locRegions,
          })
        }
        onRequestRevisions={() => onRequestRevisions(8, 7)}
      />
    </div>
  );
}
