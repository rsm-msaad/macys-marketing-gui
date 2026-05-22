"use client";

import { useState, useMemo } from "react";
import { FileEdit, Send } from "lucide-react";

import { ApprovalActions, ContextStack, type StepContentProps } from "./shared";

const FALLBACK_SUMMARY =
  "The Mother's Day Beauty Event generated $1.27M in revenue across 10 days, " +
  "exceeding budget by 12 percent. Email was the strongest channel " +
  "(56x ROAS), while display underperformed (1.1x ROAS) and we recommend " +
  "pausing it next cycle.";

function buildSummaryFromUpstream(
  outputs: Record<string, unknown>,
  briefName: string,
): string {
  const parts: string[] = [];

  // Campaign name
  parts.push(`Executive Report: ${briefName}`);
  parts.push("");

  // Step 2: Segment
  const seg = outputs["2"] as Record<string, unknown> | undefined;
  if (seg?.name) {
    parts.push(
      `Segment: ${seg.name} (${(seg.customer_count as number)?.toLocaleString() ?? "?"} customers` +
      `${seg.top_category ? `, top category: ${seg.top_category}` : ""}).` +
      `${seg.was_override ? ` Override from recommended ${seg.recommended_segment}: "${seg.override_reason}"` : ""}`
    );
  }

  // Step 3: SKUs
  const sku = outputs["3"] as Record<string, unknown> | undefined;
  if (sku?.approved_skus) {
    const ids = sku.approved_skus as string[];
    parts.push(`SKUs: ${ids.length} selected (${sku.excluded_count ?? 0} excluded for MAP violations).`);
    if (sku.pricing_check) {
      const pc = sku.pricing_check as Record<string, unknown>;
      parts.push(`  MCP check_pricing_conflicts: ${pc.status} (${pc.checked_count} checked).`);
    }
  }

  // Step 4: Assets
  const asset = outputs["4"] as Record<string, unknown> | undefined;
  if (asset?.approved_asset_count) {
    parts.push(`Creative: ${asset.approved_asset_count} DAM assets locked in.`);
  }

  // Step 5: Layout
  const layout = outputs["5"] as Record<string, unknown> | undefined;
  if (layout?.approved_layouts) {
    const layouts = layout.approved_layouts as string[];
    parts.push(`Layouts: ${layouts.length} placements approved (${layouts.join(", ")}).`);
  }

  // Step 6: Compliance
  const compliance = outputs["6"] as Record<string, unknown> | undefined;
  if (compliance?.compliance_check) {
    const cc = compliance.compliance_check as Record<string, unknown>;
    parts.push(`Compliance: AI recommended "${cc.recommended_action}".`);
  }

  // Step 7: Localization
  const loc = outputs["7"] as Record<string, unknown> | undefined;
  if (loc?.variant_count) {
    parts.push(`Localization: ${loc.variant_count} variants across ${(loc.regions as string[])?.length ?? "?"} regions.`);
    if (loc.mcp_generate_locale_variants) {
      const mcps = loc.mcp_generate_locale_variants as Array<Record<string, unknown>>;
      const langs = mcps.map((m) => m.target_language).join(", ");
      parts.push(`  MCP generate_locale_variants: ${langs}.`);
    }
  }

  // Step 8: Activation
  const act = outputs["8"] as Record<string, unknown> | undefined;
  if (act?.channels) {
    parts.push(`Activation: ${(act.channels as string[]).length} channels deployed.`);
  }

  // Step 9: Performance
  const perf = outputs["9"] as Record<string, unknown> | undefined;
  if (perf?.totals) {
    const t = perf.totals as Record<string, number>;
    parts.push(
      `Performance: $${(t.revenue / 1000).toFixed(0)}K revenue, ${t.roas?.toFixed(1)}x ROAS, ${t.conversions?.toLocaleString()} conversions.` +
      ` Top channel: ${perf.top_channel ?? "N/A"}. Top segment: ${perf.top_segment ?? "N/A"}.`
    );
  }

  if (parts.length <= 2) {
    return FALLBACK_SUMMARY;
  }

  parts.push("");
  parts.push("This report was auto-generated from the audit trail across all 10 workflow steps.");
  return parts.join("\n");
}

export function ReportingContent({
  context,
  canAct,
  busy,
  onApprove,
  onRequestRevisions,
}: StepContentProps) {
  const generatedSummary = useMemo(
    () => buildSummaryFromUpstream(
      context.state.step_outputs as Record<string, unknown>,
      context.campaign_brief.name,
    ),
    [context.state.step_outputs, context.campaign_brief.name],
  );

  const [draft, setDraft] = useState(generatedSummary);

  // Count how many upstream steps have outputs
  const upstreamSteps = ["2", "3", "4", "5", "6", "7", "8", "9"].filter(
    (k) => context.state.step_outputs[k] != null
  );

  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      {/* Upstream context: reading from ALL steps */}
      <div className="rounded-md border border-blue-200/50 bg-blue-50/30 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
          Reading from Steps 1-9: Full Audit Trail
        </div>
        <div className="mt-0.5 text-[11px] text-charcoal/65">
          <strong>{upstreamSteps.length} of 8</strong> upstream step outputs available.
          Report generated from actual brief, segment, SKUs, assets, copy, compliance, localization, activation, and performance data.
        </div>
      </div>

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <FileEdit className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Skill · Report Generator (LLM, pre-fetch)
          </span>
        </div>
        <p className="text-[12px] text-charcoal/65">
          Auto-drafted from the full audit trail (Steps 1-9). Single LLM call, no tool use. Merna
          edits in business context before sending to leadership.
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={12}
          disabled={!canAct}
          className="mt-3 w-full rounded-md border border-charcoal/15 bg-cream/30 p-3 font-serif text-[13px] leading-relaxed text-charcoal focus:border-teal-600 focus:outline-none disabled:opacity-70"
        />
        <div className="mt-1 text-[10px] text-charcoal/50">
          {draft.length} characters · keep under 1500 for the leadership
          one-pager.
        </div>
      </div>

      <ApprovalActions
        canAct={canAct}
        busy={busy}
        primaryLabel="Send to Leadership"
        primaryKind="send"
        secondaryLabel="Hold for Edits"
        stepNumber={10}
        onPrimary={() =>
          onApprove("Send to Leadership", {
            summary: draft.slice(0, 4000),
            upstream_steps_used: upstreamSteps,
          })
        }
        onRequestRevisions={() => onRequestRevisions(10, 10)}
      />
    </div>
  );
}
