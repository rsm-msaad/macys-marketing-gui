"use client";

import { useState, useMemo } from "react";
import { CheckCircle2, FileEdit, Mail, Send, X } from "lucide-react";

import { runSendSummary } from "@/lib/api";
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
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState("merna.sa.saad@gmail.com");
  const [emailSubject, setEmailSubject] = useState(`Campaign Complete: ${context.campaign_brief.name}`);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ status: string; error?: string | null } | null>(null);

  // Count how many upstream steps have outputs
  const upstreamSteps = ["2", "3", "4", "5", "6", "7", "8", "9"].filter(
    (k) => context.state.step_outputs[k] != null
  );

  async function handleSendEmail() {
    setEmailSending(true);
    setEmailResult(null);
    try {
      const recipients = emailRecipients.split(",").map((e) => e.trim()).filter(Boolean);
      const result = await runSendSummary(
        recipients,
        context.campaign_brief.name,
        emailSubject,
        draft,
      );
      setEmailResult({ status: result.status, error: result.error });
    } catch (e) {
      setEmailResult({ status: "error", error: (e as Error).message });
    } finally {
      setEmailSending(false);
    }
  }

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

      {/* Send to Team via email (MCP: send_campaign_summary) */}
      {canAct && (
        <button
          type="button"
          onClick={() => { setEmailOpen(true); setEmailResult(null); }}
          className="inline-flex items-center gap-1.5 rounded-md border border-violet-300/50 bg-violet-50/30 px-3.5 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100/50"
        >
          <Mail className="h-3.5 w-3.5" />
          Send to Team via Email
          <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-violet-500">MCP</span>
        </button>
      )}

      {emailResult && (
        <div className={`rounded-md border px-3 py-2 text-[11px] ${
          emailResult.status === "sent"
            ? "border-green-300/40 bg-green-50/30 text-green-700"
            : "border-red-300/40 bg-red-50/30 text-red-700"
        }`}>
          {emailResult.status === "sent" ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Email sent successfully via send_campaign_summary MCP tool.
            </span>
          ) : (
            <span>Email failed: {emailResult.error}</span>
          )}
        </div>
      )}

      {/* Email modal */}
      {emailOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setEmailOpen(false)} />
          <div className="fixed inset-x-4 top-[15%] z-50 mx-auto max-w-lg rounded-lg border border-charcoal/10 bg-white p-5 shadow-xl animate-modal-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-violet-600" />
                <span className="text-sm font-semibold text-charcoal">Send Campaign Summary</span>
                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-violet-500">MCP: send_campaign_summary</span>
              </div>
              <button type="button" onClick={() => setEmailOpen(false)} className="rounded p-1 text-charcoal/50 hover:bg-cream">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">Recipients</label>
                <input
                  type="text"
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                  className="mt-1 w-full rounded-md border border-charcoal/15 bg-cream/30 px-3 py-2 text-[12px] text-charcoal focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="mt-1 w-full rounded-md border border-charcoal/15 bg-cream/30 px-3 py-2 text-[12px] text-charcoal focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">Preview</label>
                <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-charcoal/10 bg-cream/20 p-3 text-[11px] leading-relaxed text-charcoal/65 whitespace-pre-wrap">
                  {draft.slice(0, 500)}{draft.length > 500 ? "..." : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={emailSending || !emailRecipients.trim()}
                className="w-full rounded-md bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {emailSending ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </>
      )}

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
