"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Clock,
  Edit3,
  Loader2,
  RotateCcw,
  ShieldAlert,
  ThumbsDown,
  X,
} from "lucide-react";

import {
  approveStep,
  editStepOutput,
  escalateStep,
  fetchAuditLog,
  fetchCampaignState,
  rejectStep,
} from "@/lib/api";

const STEP_NAMES: Record<string, string> = {
  "6a": "Compliance Pre Check",
  "6b": "Approval Brief Generator",
  "6c": "Revision Router",
};

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  approved: { bg: "bg-sage/15", text: "text-sage", label: "Approved" },
  rejected: { bg: "bg-soft_red/15", text: "text-soft_red", label: "Rejected" },
  escalated: { bg: "bg-purple-100", text: "text-purple-700", label: "Escalated" },
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
    approve: "text-sage", reject: "text-soft_red", edit: "text-amber-600", escalate: "text-purple-600", rerun: "text-teal-600",
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

  const refresh = useCallback(async () => {
    try {
      const state = await fetchCampaignState(campaignId);
      const stepOutput = (state.step_outputs as Record<string, unknown>)?.[stepId] ?? null;
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
            <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">Human Review</div>
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

        {/* Section 2: AI Output */}
        {output && !loading && (
          <div className="mb-6 rounded-lg border border-charcoal/10 bg-white p-5">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">AI Output</h2>
            <div className="space-y-2">
              {Object.entries(output).filter(([k]) => k !== "retrieved_docs").map(([key, value]) => (
                <div key={key} className="rounded-md border border-charcoal/5 bg-cream/20 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">{key.replace(/_/g, " ")}</div>
                  <div className="mt-0.5 text-sm text-charcoal/75">
                    {typeof value === "object" && value !== null
                      ? Array.isArray(value)
                        ? (value as string[]).map((v, i) => <div key={i} className="flex items-start gap-1.5"><span className="mt-1.5 h-1 w-1 rounded-full bg-charcoal/30 flex-shrink-0" />{String(v)}</div>)
                        : <pre className="text-[11px] whitespace-pre-wrap font-mono text-charcoal/60">{JSON.stringify(value, null, 2)}</pre>
                      : String(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 4: Action buttons */}
        {output && !loading && (
          <div className="mb-6 rounded-lg border border-charcoal/10 bg-white p-5">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">Review Actions</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setModal("approve")} className="inline-flex items-center gap-1.5 rounded-md bg-sage px-4 py-2 text-sm font-medium text-white hover:bg-sage/90">
                <Check className="h-3.5 w-3.5" /> Approve
              </button>
              <Link href={`/evidence?step=${stepId}&campaign=${campaignId}`} className="inline-flex items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-4 py-2 text-sm font-medium text-charcoal/65 hover:bg-cream">
                <Edit3 className="h-3.5 w-3.5" /> View Evidence
              </Link>
              <button type="button" onClick={() => setModal("reject")} className="inline-flex items-center gap-1.5 rounded-md border border-soft_red/30 bg-white px-4 py-2 text-sm font-medium text-soft_red hover:bg-soft_red/5">
                <ThumbsDown className="h-3.5 w-3.5" /> Reject
              </button>
              <button type="button" onClick={() => setModal("escalate")} className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-white px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50">
                <ShieldAlert className="h-3.5 w-3.5" /> Escalate to CEO
              </button>
            </div>
          </div>
        )}

        {/* Section 5: Audit log */}
        <div className="rounded-lg border border-charcoal/10 bg-white p-5">
          <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">
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
          title="Approve this output?"
          description="This marks the step as approved and continues the workflow."
          confirmLabel="Approve"
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
      {modal === "escalate" && (
        <ConfirmModal
          title="Escalate to CEO?"
          description="The CEO will see this in their escalation queue and can override any decision."
          confirmLabel="Escalate"
          confirmColor="bg-purple-600 hover:bg-purple-700"
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
