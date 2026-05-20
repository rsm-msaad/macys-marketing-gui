"use client";

import { useEffect, useState } from "react";
import { ArrowLeftCircle, Loader2, X } from "lucide-react";

import { getStepOwnerName } from "@/lib/authorities";

const STEP_NAMES: Record<number, string> = {
  1: "Briefing",
  2: "Segmentation",
  3: "SKU Selection",
  4: "Creative Production",
  5: "Layout Assembly",
  6: "Final Approval",
  7: "Localization",
  8: "Activation",
  9: "Monitoring",
  10: "Reporting",
};

const MIN_COMMENT_LEN = 10;

export type RevisionModalState = {
  fromStep: number;
  defaultSendBackToStep: number;
  // optional override label for the destination dropdown (e.g. "Marketing Leadership"
  // for step 1's "send back to leadership" semantics)
  destinationLabel?: string;
} | null;

export function RevisionRequestModal({
  state,
  onClose,
  onSubmit,
  busy,
  error,
}: {
  state: RevisionModalState;
  onClose: () => void;
  onSubmit: (sendBackToStep: number, comment: string) => Promise<void> | void;
  busy: boolean;
  error: string | null;
}) {
  const [comment, setComment] = useState("");
  const [sendBackToStep, setSendBackToStep] = useState<number>(
    state?.defaultSendBackToStep ?? 1,
  );

  useEffect(() => {
    if (state) {
      setComment("");
      setSendBackToStep(state.defaultSendBackToStep);
    }
  }, [state]);

  if (!state) return null;

  const { fromStep, destinationLabel } = state;
  const fromName = STEP_NAMES[fromStep] ?? `Step ${fromStep}`;

  // Options: any prior step (or self for step 1 / step 10 hold-for-edits cases).
  const options: number[] = [];
  if (fromStep === state.defaultSendBackToStep) {
    // Hold-for-edits / step 1 self-loop: only the self option makes sense.
    options.push(fromStep);
  } else {
    for (let s = fromStep - 1; s >= 1; s -= 1) options.push(s);
  }

  const valid = comment.trim().length >= MIN_COMMENT_LEN;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-charcoal/10 px-5 py-3">
          <div className="flex items-center gap-2">
            <ArrowLeftCircle className="h-5 w-5 text-mustard" />
            <h2 className="font-serif text-lg font-semibold text-charcoal">
              Request Revisions
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1 text-charcoal/60 hover:bg-cream hover:text-charcoal disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-3 px-5 py-4">
          <div className="text-sm text-charcoal/70">
            You are at <strong className="text-charcoal">Step {fromStep}: {fromName}</strong>.
          </div>

          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wider text-charcoal/55">
              Send back to
            </span>
            {options.length === 1 && options[0] === fromStep ? (
              <div className="mt-1 rounded-md border border-charcoal/15 bg-cream/30 px-3 py-2 text-sm text-charcoal/75">
                {destinationLabel ?? `Step ${fromStep}: ${fromName}`}
              </div>
            ) : (
              <select
                value={sendBackToStep}
                onChange={(e) => setSendBackToStep(parseInt(e.target.value, 10))}
                disabled={busy}
                className="mt-1 w-full rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm text-charcoal focus:border-teal-600 focus:outline-none disabled:opacity-50"
              >
                {options.map((s) => (
                  <option key={s} value={s}>
                    Step {s}: {STEP_NAMES[s]} (owner: {getStepOwnerName(s)})
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wider text-charcoal/55">
              Revision comment <span className="text-charcoal/40">(min {MIN_COMMENT_LEN} chars)</span>
            </span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              disabled={busy}
              placeholder="What needs to change? Be specific so the previous owner can address it quickly."
              className="mt-1 w-full rounded-md border border-charcoal/15 bg-white p-3 text-sm text-charcoal focus:border-teal-600 focus:outline-none disabled:opacity-50"
            />
            <div className="mt-1 text-[10px] text-charcoal/45">
              {comment.length} characters
            </div>
          </label>

          {error && (
            <div className="rounded-md border border-soft_red/30 bg-soft_red/5 p-2 text-xs text-soft_red">
              {error}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-charcoal/10 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-charcoal/15 bg-white px-3.5 py-2 text-sm font-medium text-charcoal hover:bg-cream disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(sendBackToStep, comment.trim())}
            disabled={busy || !valid}
            className="inline-flex items-center gap-1.5 rounded-md bg-mustard px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Submit revision request
          </button>
        </footer>
      </div>
    </div>
  );
}
