"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Loader2,
  RotateCcw,
  ShieldAlert,
  ThumbsDown,
  X,
  XCircle,
  AlertTriangle,
  Zap,
} from "lucide-react";

import {
  approveStep,
  editStepOutput,
  escalateStep,
  fetchAuditLog,
  fetchCampaignState,
  rejectStep,
} from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const STEP_NAMES: Record<string, string> = {
  "6a": "Compliance Pre Check",
  "6b": "Approval Brief Generator",
  "6c": "Revision Router",
};

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  approved: { bg: "bg-sage/15", text: "text-sage", label: "Approved" },
  rejected: { bg: "bg-soft_red/15", text: "text-soft_red", label: "Rejected" },
  escalated: { bg: "bg-teal-100", text: "text-teal-700", label: "Escalated" },
  edited: { bg: "bg-amber-100", text: "text-amber-700", label: "Edited" },
  pending: { bg: "bg-charcoal/10", text: "text-charcoal/60", label: "Pending Review" },
};

/* ---- Confirmation modal ---- */

function ConfirmModal({
  title,
  description,
  confirmLabel,
  confirmColor,
  requireReason,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  confirmColor: string;
  requireReason?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(45,45,45,0.4)" }}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="font-serif text-lg font-semibold text-charcoal">{title}</h3>
        <p className="mt-2 text-sm text-charcoal/65">{description}</p>
        {requireReason && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter your reason (at least 10 characters)..."
            rows={3}
            className="mt-3 w-full rounded-md border border-charcoal/20 bg-cream/30 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
          />
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-md border border-charcoal/15 px-4 py-2 text-sm text-charcoal/65 hover:bg-cream">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={busy || (requireReason === true && reason.trim().length < 10)}
            className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${confirmColor}`}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Audit log entry ---- */

function AuditEntry({ entry }: { entry: Record<string, unknown> }) {
  const action = String(entry.action ?? "");
  const persona = String(entry.persona ?? "");
  const ts = String(entry.timestamp ?? "");
  const reason = entry.reason ? String(entry.reason) : null;
  const time = ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const actionColors: Record<string, string> = {
    approve: "text-sage", reject: "text-soft_red", edit: "text-amber-600", escalate: "text-teal-600", rerun: "text-teal-600",
  };
  return (
    <div className="flex items-start gap-2 py-2 border-b border-charcoal/5 last:border-0">
      <Clock className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${actionColors[action] ?? "text-charcoal/40"}`} />
      <div className="text-[12px]">
        <span className="font-medium text-charcoal/80">{persona}</span>{" "}
        <span className={actionColors[action] ?? "text-charcoal/60"}>{action}d</span>{" "}
        <span className="text-charcoal/50">at {time}</span>
        {reason && <div className="mt-0.5 italic text-charcoal/50">&ldquo;{reason}&rdquo;</div>}
      </div>
    </div>
  );
}

/* ---- Main content ---- */

function ReviewContent() {
  const params = useSearchParams();
  const campaignId = params.get("campaign") ?? "MDC-2026-MD-001";
  const stepId = params.get("step") ?? "6a";
  const stepName = STEP_NAMES[stepId] ?? `Step ${stepId}`;

  const [output, setOutput] = useState<Record<string, unknown> | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>("pending");
  const [auditLog, setAuditLog] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [rerunning, setRerunning] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const state = await fetchCampaignState(campaignId);
      const stepOutput = (state.step_outputs as Record<string, unknown>)?.[stepId]
        ?? (state.evidence as Record<string, unknown>)?.[stepId + "_output"]
        ?? null;
      setOutput(stepOutput as Record<string, unknown> | null);
      const statuses = (state as Record<string, unknown>).step_review_status as Record<string, string> | undefined;
      setReviewStatus(statuses?.[stepId] ?? "pending");
      const log = await fetchAuditLog(campaignId);
      setAuditLog(log.filter((e) => String(e.step_id) === stepId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [campaignId, stepId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleAction(action: string, reason = "") {
    setBusy(true);
    setError(null);
    try {
      if (action === "approve") await approveStep(campaignId, stepId);
      else if (action === "reject") await rejectStep(campaignId, stepId, reason);
      else if (action === "escalate") await escalateStep(campaignId, stepId, reason);
      setModal(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startEditing() {
    if (!output) return;
    const d: Record<string, string> = {};
    for (const [k, v] of Object.entries(output)) {
      if (k === "retrieved_docs") continue;
      d[k] = typeof v === "object" ? JSON.stringify(v, null, 2) : String(v ?? "");
    }
    setDraft(d);
    setEditing(true);
  }

  async function saveEdit() {
    setBusy(true);
    setError(null);
    try {
      const parsed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(draft)) {
        try { parsed[k] = JSON.parse(v); } catch { parsed[k] = v; }
      }
      if (output?.retrieved_docs) parsed.retrieved_docs = output.retrieved_docs;
      await editStepOutput(campaignId, stepId, parsed);
      setEditing(false);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRerun() {
    setRerunning(true);
    setError(null);
    setModal(null);
    try {
      const res = await fetch(`${API_BASE}/campaigns/${encodeURIComponent(campaignId)}/steps/${encodeURIComponent(stepId)}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: "campaign-manager" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Rerun failed: ${res.status}`);
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRerunning(false);
    }
  }

  const sts = STATUS_STYLE[reviewStatus] ?? STATUS_STYLE.pending;

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-charcoal/10 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/campaign-manager" className="inline-flex items-center gap-1.5 text-sm text-charcoal/50 hover:text-charcoal">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Workflow
          </Link>
          <span className="font-serif text-xl font-bold tracking-wide text-charcoal">MACY&apos;S</span>
          <div className="w-20" />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Section 1: Header */}
        <div className="mb-6 flex items-start justify-between rounded-lg border border-charcoal/10 bg-white p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-charcoal/40">Human Review</div>
            <h1 className="mt-1 font-serif text-2xl font-bold text-charcoal">{stepName}</h1>
            <div className="mt-1 font-mono text-[11px] text-charcoal/45">{campaignId} / {stepId}</div>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${sts.bg} ${sts.text}`}>
            {sts.label}
          </span>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-charcoal/50">
            <Loader2 className="h-4 w-4 animate-spin text-teal-600" /> Loading step output...
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-md border border-soft_red/30 bg-soft_red/5 px-4 py-3 text-sm text-soft_red">{error}</div>
        )}

        {!loading && !output && (
          <div className="rounded-lg border border-charcoal/10 bg-white p-8 text-center">
            <p className="text-charcoal/50">No AI output to review for this step yet.</p>
            <Link href="/campaign-manager" className="mt-3 inline-flex items-center gap-1 text-sm text-teal-600 hover:underline">
              Go back and fire the skill first
            </Link>
          </div>
        )}

        {/* Section 2: AI Output (read mode or edit mode) */}
        {output && !loading && !editing && (() => {
          // Detect compliance findings (has brand_alignment, disclaimers, pricing_cross_check)
          const isCompliance = "brand_alignment" in output || "disclaimers" in output || "pricing_cross_check" in output;
          // Detect brief (has campaign_goal, target_audience)
          const isBrief = "campaign_goal" in output || "target_audience" in output;
          const recommendedAction = output.recommended_action as string | undefined ?? output.ai_recommendation as string | undefined;
          const agenticTrace = output._agentic_trace as Array<Record<string, unknown>> | undefined;
          const FINDING_KEYS = ["brand_alignment", "disclaimers", "pricing_cross_check"];
          const SKIP_KEYS = new Set(["retrieved_docs", "_agentic_trace", "_agentic_iterations", "_agentic_tool_calls", "_parse_error", "_raw_response", "recommended_action"]);

          const statusStyle = (s: string) => {
            const lower = (s ?? "").toLowerCase();
            if (lower === "pass" || lower === "approved" || lower === "proceed" || lower === "approve")
              return { icon: CheckCircle2, bg: "bg-green-100", text: "text-green-700", label: s };
            if (lower === "fail" || lower === "reject" || lower === "block")
              return { icon: XCircle, bg: "bg-red-100", text: "text-red-700", label: s };
            return { icon: AlertTriangle, bg: "bg-amber-100", text: "text-amber-700", label: s };
          };

          return (
            <>
              {/* Recommended action banner */}
              {recommendedAction && (
                <div className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 ${
                  recommendedAction.toLowerCase().includes("proceed") || recommendedAction.toLowerCase().includes("approve")
                    ? "border border-green-200 bg-green-50"
                    : "border border-amber-200 bg-amber-50"
                }`}>
                  {recommendedAction.toLowerCase().includes("proceed") || recommendedAction.toLowerCase().includes("approve")
                    ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                    : <AlertTriangle className="h-5 w-5 text-amber-600" />}
                  <div>
                    <div className="text-sm font-semibold text-charcoal">
                      {recommendedAction.toLowerCase().includes("revise") ? "Revisions Needed" : "Ready to Proceed"}
                    </div>
                    <div className="text-[11px] text-charcoal/60">
                      AI recommendation: <strong>{recommendedAction}</strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-6 rounded-lg border border-charcoal/10 bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-charcoal/50">AI Output</h2>
                  {reviewStatus === "edited" && (
                    <span className="text-xs italic text-amber-600">(manually edited)</span>
                  )}
                </div>

                {/* Compliance findings as styled cards */}
                {isCompliance && (
                  <div className="space-y-3">
                    {FINDING_KEYS.map((key) => {
                      const finding = output[key] as Record<string, unknown> | undefined;
                      if (!finding || typeof finding !== "object") return null;
                      const st = statusStyle(String(finding.status ?? "warn"));
                      const Icon = st.icon;
                      return (
                        <div key={key} className="rounded-md border border-charcoal/8 p-4">
                          <div className="flex items-start gap-3">
                            <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${st.text}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-charcoal">{key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${st.bg} ${st.text}`}>{st.label}</span>
                              </div>
                              <p className="mt-1 text-[12px] leading-relaxed text-charcoal/70">{String(finding.reason ?? "")}</p>
                              {finding.cited_doc ? (
                                <div className="mt-1.5 text-xs text-charcoal/40">Source: {String(finding.cited_doc)}</div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Brief fields as styled sections */}
                {isBrief && (
                  <div className="space-y-3">
                    {Object.entries(output).filter(([k]) => !SKIP_KEYS.has(k) && !k.startsWith("_")).map(([key, value]) => (
                      <div key={key} className="rounded-md border border-charcoal/8 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wider text-charcoal/40">{key.replace(/_/g, " ")}</div>
                        <div className="mt-1 text-[12px] leading-relaxed text-charcoal/75">
                          {Array.isArray(value)
                            ? (value as string[]).map((v, i) => (
                              <div key={i} className="flex items-start gap-1.5 mt-0.5">
                                <span className="mt-1.5 h-1 w-1 rounded-full bg-charcoal/30 flex-shrink-0" />
                                <span>{String(v)}</span>
                              </div>
                            ))
                            : String(value ?? "")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Generic output (non-compliance, non-brief) */}
                {!isCompliance && !isBrief && (
                  <div className="space-y-2">
                    {Object.entries(output).filter(([k]) => !SKIP_KEYS.has(k) && !k.startsWith("_")).map(([key, value]) => (
                      <div key={key} className="rounded-md border border-charcoal/5 bg-cream/20 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wider text-charcoal/40">{key.replace(/_/g, " ")}</div>
                        <div className="mt-0.5 text-sm text-charcoal/75">
                          {typeof value === "object" && value !== null
                            ? Array.isArray(value)
                              ? (value as string[]).map((v, i) => <div key={i} className="flex items-start gap-1.5"><span className="mt-1.5 h-1 w-1 rounded-full bg-charcoal/30 flex-shrink-0" />{String(v)}</div>)
                              : <pre className="text-[11px] whitespace-pre-wrap font-mono text-charcoal/60">{JSON.stringify(value, null, 2)}</pre>
                            : String(value ?? "")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Agentic trace timeline */}
              {agenticTrace && agenticTrace.length > 0 && (
                <div className="mb-6 rounded-lg border border-violet-200/50 bg-violet-50/10 p-5">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-violet-500">
                    Agentic Trace - Claude&apos;s Reasoning ({agenticTrace.filter((t) => t.type === "tool_call").length} tool calls)
                  </h2>
                  <div className="space-y-3">
                    {agenticTrace.map((entry, i) => {
                      if (entry.type === "tool_call") {
                        const reasoning = entry.reasoning_before as string | undefined;
                        return (
                          <div key={i} className="rounded-md border border-violet-200/40 bg-white p-3">
                            {reasoning && reasoning.length > 0 && (
                              <div className="mb-2 rounded border-l-2 border-violet-300 bg-violet-50/30 px-3 py-2">
                                <div className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-violet-400">Claude&apos;s reasoning</div>
                                <div className="text-[11px] leading-relaxed text-charcoal/65 italic">{reasoning.slice(0, 400)}{reasoning.length > 400 ? "..." : ""}</div>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <Zap className="h-3 w-3 text-teal-600" />
                              <span className="font-mono text-[11px] font-semibold text-teal-700">{String(entry.tool_name)}</span>
                              <span className="text-xs text-charcoal/40">iteration {String(entry.iteration)}</span>
                            </div>
                            <div className="mt-1 rounded bg-charcoal/3 p-2 text-xs font-mono text-charcoal/55">
                              <div><strong>Input:</strong> {JSON.stringify(entry.tool_input, null, 1).slice(0, 200)}</div>
                              <div className="mt-1"><strong>Output:</strong> {JSON.stringify(entry.tool_output, null, 1).slice(0, 200)}</div>
                            </div>
                          </div>
                        );
                      }
                      if (entry.type === "final_response" && entry.reasoning) {
                        return (
                          <div key={i} className="rounded-md border border-charcoal/10 bg-cream/30 p-3">
                            <div className="text-xs font-semibold uppercase tracking-wider text-charcoal/40">Final analysis</div>
                            <div className="mt-0.5 text-[11px] text-charcoal/60 italic">{String(entry.reasoning).slice(0, 300)}...</div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* Edit mode */}
        {output && !loading && editing && (
          <div className="mb-6 rounded-lg border-2 border-amber-300/50 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-600">Editing AI Output</h2>
              <div className="flex gap-2">
                <button type="button" onClick={saveEdit} disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50">
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                </button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-charcoal/15 px-3 py-1.5 text-xs text-charcoal/60 hover:bg-cream">
                  Cancel
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {Object.entries(draft).map(([key, value]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal/50">
                    {key.replace(/_/g, " ")}
                  </label>
                  <textarea
                    value={value}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                    rows={value.length > 100 ? 4 : 2}
                    className="w-full rounded-md border border-charcoal/20 bg-cream/30 px-3 py-2 text-sm text-charcoal/80 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600/30"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rerunning state */}
        {rerunning && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-teal-600/30 bg-teal-50/30 p-5">
            <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
            <div>
              <div className="text-sm font-medium text-teal-700">Re-running AI...</div>
              <div className="text-[11px] text-teal-600/70">This may take 30 to 60 seconds. Please wait.</div>
            </div>
          </div>
        )}

        {/* Section 4: Action buttons (all 5 + evidence link) */}
        {output && !loading && !editing && !rerunning && (
          <div className="mb-6 rounded-lg border border-charcoal/10 bg-white p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-charcoal/50">Review Actions</h2>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setModal("approve")} className="inline-flex items-center gap-1.5 rounded-md bg-sage px-5 py-2.5 text-sm font-medium text-white hover:bg-sage/90">
                <Check className="h-4 w-4" /> {stepId === "6a" ? "Accept Findings" : stepId === "6b" ? "Accept Brief" : "Approve"}
              </button>
              <button type="button" onClick={startEditing} className="inline-flex items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-4 py-2.5 text-sm font-medium text-charcoal/65 hover:bg-cream">
                <Edit3 className="h-4 w-4" /> Edit
              </button>
              <Link href={`/evidence?step=${stepId}&campaign=${campaignId}`} className="inline-flex items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-4 py-2.5 text-sm font-medium text-charcoal/65 hover:bg-cream">
                Evidence
              </Link>
              <button type="button" onClick={() => setModal("rerun")} className="inline-flex items-center gap-1.5 rounded-md border border-teal-600/30 bg-white px-4 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-50">
                <RotateCcw className="h-4 w-4" /> Rerun
              </button>
              <button type="button" onClick={() => setModal("reject")} className="inline-flex items-center gap-1.5 rounded-md border border-soft_red/30 bg-white px-4 py-2.5 text-sm font-medium text-soft_red hover:bg-soft_red/5">
                <ThumbsDown className="h-4 w-4" /> Reject
              </button>
              <button type="button" onClick={() => setModal("escalate")} className="inline-flex items-center gap-1.5 rounded-md border border-teal-300 bg-white px-4 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-50">
                <ShieldAlert className="h-4 w-4" /> Escalate to CEO
              </button>
            </div>
          </div>
        )}

        {/* Section 5: Audit log */}
        <div className="rounded-lg border border-charcoal/10 bg-white p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-charcoal/50">
            Action History ({auditLog.length})
          </h2>
          {auditLog.length === 0 ? (
            <p className="text-sm text-charcoal/40 italic">No actions taken yet.</p>
          ) : (
            <div>{auditLog.map((e, i) => <AuditEntry key={i} entry={e} />)}</div>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal === "approve" && (
        <ConfirmModal
          title={stepId === "6a" ? "Accept these compliance findings?" : stepId === "6b" ? "Accept this brief?" : "Approve this output?"}
          description={
            stepId === "6a" || stepId === "6b"
              ? `This locks Step ${stepId} as accepted but does not advance the campaign. Use "Final Approval" at the bottom of Step 6 to advance the workflow.`
              : "This marks the step as approved and continues the workflow."
          }
          confirmLabel={stepId === "6a" ? "Accept Findings" : stepId === "6b" ? "Accept Brief" : "Approve"}
          confirmColor="bg-sage hover:bg-sage/90"
          onConfirm={() => handleAction("approve")}
          onCancel={() => setModal(null)}
          busy={busy}
        />
      )}
      {modal === "reject" && (
        <ConfirmModal
          title="Reject this output?"
          description="Explain why this output is not acceptable. The step will need to be re-run."
          confirmLabel="Submit Rejection"
          confirmColor="bg-soft_red hover:bg-soft_red/90"
          requireReason
          onConfirm={(reason) => handleAction("reject", reason)}
          onCancel={() => setModal(null)}
          busy={busy}
        />
      )}
      {modal === "rerun" && (
        <ConfirmModal
          title="Re-run this AI step?"
          description="Current output and evidence will be replaced. This calls TritonAI and may take 30 to 60 seconds."
          confirmLabel="Re-run"
          confirmColor="bg-teal-600 hover:bg-teal-700"
          onConfirm={() => handleRerun()}
          onCancel={() => setModal(null)}
          busy={rerunning}
        />
      )}
      {modal === "escalate" && (
        <ConfirmModal
          title="Escalate to CEO?"
          description="The CEO will see this in their escalation queue and can override any decision."
          confirmLabel="Escalate"
          confirmColor="bg-teal-600 hover:bg-teal-700"
          onConfirm={(reason) => handleAction("escalate", reason)}
          onCancel={() => setModal(null)}
          busy={busy}
        />
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-cream text-charcoal/50">Loading review...</div>}>
      <ReviewContent />
    </Suspense>
  );
}
