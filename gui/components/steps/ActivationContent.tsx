"use client";

import { useState } from "react";
import { Clock, Play, Radio, Send } from "lucide-react";

import { runActivate, type RegionSchedule } from "@/lib/api";
import { ApprovalActions, ContextStack, StepVideoBackground, type StepContentProps } from "./shared";

const REGION_LABEL: Record<string, string> = {
  NY: "New York",
  CA: "California",
  FL: "Florida",
  TX: "Texas",
  PR: "Puerto Rico",
  QC: "Quebec",
};

function formatUtc(utc: string): string {
  try {
    const d = new Date(utc);
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return utc;
  }
}

export function ActivationContent({
  context,
  canAct,
  busy,
  onApprove,
  onRequestRevisions,
}: StepContentProps) {
  // Read upstream: localization variants from Step 7
  const locOutput = context.state.step_outputs["7"] as Record<string, unknown> | undefined;
  const variantCount = (locOutput?.variant_count as number | undefined) ?? 0;
  const locRegions = (locOutput?.regions as string[] | undefined) ?? ["NY", "CA", "FL", "TX"];

  // Campaign data for the scheduler
  const brief = context.campaign_brief;
  const estimatedSpend = (brief as Record<string, unknown>).estimated_spend as number | undefined ?? 200_000;
  const launchDate = ((brief as Record<string, unknown>).campaign_window as Record<string, string> | undefined)?.soft_launch ?? "2026-06-01";

  const [schedule, setSchedule] = useState<RegionSchedule[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const result = await runActivate(locRegions, estimatedSpend, launchDate);
      setSchedule(result.schedule.schedule_by_region);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <StepVideoBackground stepNumber={8}>
    <div className="space-y-3">
      <ContextStack context={context} />

      {/* Upstream context: reading from Step 7 */}
      {variantCount > 0 && (
        <div className="rounded-md border border-blue-200/50 bg-blue-50/30 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
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
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-600">
            Automation · Activation Scheduler
          </span>
        </div>

        {!schedule && (
          <>
            <p className="text-[12px] text-charcoal/65">
              Computes timezone-aware send times, paid social windows, display frequency caps,
              and in-store signage windows for {locRegions.length} regions.
            </p>
            {canAct && (
              <button
                type="button"
                onClick={handleRun}
                disabled={running}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {running ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Computing schedule...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Run Activation Scheduler
                  </>
                )}
              </button>
            )}
          </>
        )}

        {error && (
          <p className="mt-2 text-xs text-soft_red">{error}</p>
        )}

        {schedule && (
          <div className="space-y-2">
            {schedule.map((r) => (
              <div
                key={r.region}
                className="grid grid-cols-[120px_1fr] gap-3 rounded-md border border-charcoal/10 bg-cream/30 px-3 py-2 text-[12px]"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-charcoal">
                    {REGION_LABEL[r.region] ?? r.region}
                  </span>
                  <span className="text-xs text-charcoal/55">{r.timezone}</span>
                </div>
                <div className="space-y-0.5 text-charcoal/75">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-teal-600" />
                    <span className="font-medium">Email:</span> {formatUtc(r.email_send_utc)}
                  </div>
                  <div>
                    <span className="font-medium">Paid Social:</span> {r.paid_social_window_local} local
                  </div>
                  <div>
                    <span className="font-medium">Display Cap:</span> {r.display_frequency_cap} impressions/user/day
                  </div>
                  <div>
                    <span className="font-medium">In-Store Signage:</span> {r.signage_window_local} local
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 flex items-start gap-2 text-[12px] text-charcoal/70">
          <Send className="mt-0.5 h-3 w-3 flex-shrink-0 text-teal-600" />
          Activating pushes all channels live per the computed schedule.
          Email fires at 10 AM local in each region; paid social runs 6-9 PM local.
        </p>
      </div>

      <ApprovalActions
        canAct={canAct}
        busy={busy}
        primaryLabel="Activate Campaign"
        primaryKind="send"
        primaryDisabled={!schedule}
        secondaryLabel="Hold for Revisions"
        stepNumber={8}
        onPrimary={() =>
          onApprove("Activate Campaign", {
            channels: ["email", "web", "mobile", "in_store", "paid_social"],
            schedule_by_region: schedule,
            locale_variant_count: variantCount,
            locale_regions: locRegions,
          })
        }
        onRequestRevisions={() => onRequestRevisions(8, 7)}
      />
    </div>
    </StepVideoBackground>
  );
}
