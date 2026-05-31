"use client";

import { useState, useMemo } from "react";
import { FileEdit, Play, Send, Sparkles } from "lucide-react";

import { runGenerateReport } from "@/lib/api";
import { ApprovalActions, ContextStack, StepVideoBackground, type StepContentProps } from "./shared";

function makeFallbackSummary(campaignName: string): string {
  return (
    `${campaignName} - Executive Summary (draft)\n\n` +
    "This is a placeholder summary. Click 'Generate Report via Claude' above " +
    "to produce an AI-written executive report from the full audit trail."
  );
}

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
    if (loc.locale_variant_results) {
      const variants = loc.locale_variant_results as Array<Record<string, unknown>>;
      const langs = variants.map((m) => m.target_language).join(", ");
      parts.push(`  Localization helpers: ${langs}.`);
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
    return makeFallbackSummary(briefName);
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
  const [generating, setGenerating] = useState(false);
  const [genMethod, setGenMethod] = useState<string | null>(null);
  // Count how many upstream steps have outputs
  const upstreamSteps = ["2", "3", "4", "5", "6", "7", "8", "9"].filter(
    (k) => context.state.step_outputs[k] != null
  );

  async function handleGenerate() {
    setGenerating(true);
    setGenMethod(null);
    try {
      const segName = (context.state.step_outputs["2"] as Record<string, unknown> | undefined)?.name as string | undefined;
      const result = await runGenerateReport(
        context.campaign_brief.campaign_id,
        context.campaign_brief.name,
        context.state.step_outputs as Record<string, unknown>,
        (context.state.history ?? []) as Array<Record<string, unknown>>,
        "Beauty",
        segName,
      );
      if (result.report?.executive_summary) {
        setDraft(result.report.executive_summary);
      }
      setGenMethod(result.generation_metadata?.method ?? "unknown");
    } catch {
      // Keep existing draft on error
    } finally {
      setGenerating(false);
    }
  }

  return (
    <StepVideoBackground stepNumber={10}>
    <div className="space-y-3">
      <ContextStack context={context} />

      {/* Upstream context: reading from ALL steps */}
      <div className="rounded-md border border-blue-200/50 bg-blue-50/30 px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
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
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-600">
            Skill · Report Generator
          </span>
        </div>
        <p className="text-[12px] text-charcoal/65">
          Generates an executive summary from the full audit trail (Steps 1-9) via Claude.
          Click Generate to produce a fresh AI-written report, then edit before sending.
        </p>

        {/* Generate button */}
        {canAct && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {generating ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Claude is writing the executive summary, about 10 seconds...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Generate Report via Claude
              </>
            )}
          </button>
        )}
        {genMethod && (
          <div className="mt-1 text-xs text-charcoal/40">
            Generated via: {genMethod === "claude_via_skill_invoker" ? "Claude (TritonAI)" : genMethod}
          </div>
        )}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={12}
          disabled={!canAct}
          className="mt-3 w-full rounded-md border border-charcoal/15 bg-cream/30 p-3 font-serif text-[13px] leading-relaxed text-charcoal focus:border-teal-600 focus:outline-none disabled:opacity-70"
        />
        <div className="mt-1 text-xs text-charcoal/50">
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
    </StepVideoBackground>
  );
}
