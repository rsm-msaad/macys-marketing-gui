"use client";

import {
  AlertTriangle,
  ArrowLeftCircle,
  BadgePercent,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Hourglass,
  Pencil,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import type { CampaignContext } from "@/lib/api";
import { getStepOwnerName, getStepOwnerTitle } from "@/lib/authorities";

// Step video map - used by the floating modal header in PersonaShell.
export const STEP_VIDEO: Record<number, string> = {
  1: "/step1-briefing.mp4",
  2: "/step2-segments.mp4",
  3: "/step3-products.mp4",
  4: "/step4-studio.mp4",
  5: "/step5-layout.mp4",
  6: "/robot-army.mp4",
  7: "/step7-globe.mp4",
  8: "/robot-runner.mp4",
  9: "/step9-dashboard.mp4",
  10: "/step10-report.mp4",
};

export function StepVideoBackground({
  children,
}: {
  stepNumber: number;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

// Common props every step content component receives.
export type StepContentProps = {
  context: CampaignContext;
  canAct: boolean;
  busy: boolean;
  onApprove: (action: string, output?: Record<string, unknown>) => void;
  onLaunchSkill: (skill: import("@/components/SkillCard").SkillKind) => void;
  // Open the "Request Revisions" modal. The step component supplies the
  // step it is requesting from and the default step to send back to.
  onRequestRevisions: (
    fromStep: number,
    defaultSendBackToStep: number,
  ) => void;
};

// ---------- Action footer ----------

function ViewOnlyMessage({ stepNumber }: { stepNumber: number }) {
  const owner = getStepOwnerName(stepNumber);
  const title = getStepOwnerTitle(stepNumber);
  return (
    <div className="mt-4 flex items-start gap-2 rounded-md border border-charcoal/10 bg-cream/30 px-3 py-3 text-sm text-charcoal/65">
      <Eye className="mt-0.5 h-4 w-4 flex-shrink-0 text-charcoal/45" />
      <div>
        <div className="font-semibold text-charcoal/80">View only</div>
        <div className="text-xs">
          Waiting on <span className="font-medium text-charcoal/85">{owner}</span>{" "}
          <span className="text-charcoal/50">({title})</span> to take action.
        </div>
        <div className="mt-2 text-xs font-bold text-teal-700">
          Please login as {owner} to take action on this step.
        </div>
      </div>
    </div>
  );
}

export function ActionFooter({
  canAct,
  busy,
  cta,
  ctaKind = "approve",
  hint,
  onClick,
  stepNumber,
}: {
  canAct: boolean;
  busy: boolean;
  cta: string;
  ctaKind?: "approve" | "skill" | "send";
  hint?: string;
  onClick: () => void;
  stepNumber: number;
}) {
  if (!canAct) {
    return <ViewOnlyMessage stepNumber={stepNumber} />;
  }
  const Icon =
    ctaKind === "skill" ? Play : ctaKind === "send" ? Send : CheckCircle2;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        <Icon className="h-3.5 w-3.5" />
        {cta}
      </button>
      {hint && (
        <span className="text-[11px] text-charcoal/55">{hint}</span>
      )}
    </div>
  );
}

// ---------- Approval actions: primary Approve + secondary Request Revisions ----------

export function ApprovalActions({
  canAct,
  busy,
  primaryLabel,
  primaryKind = "approve",
  primaryDisabled,
  secondaryLabel,
  hint,
  onPrimary,
  onRequestRevisions,
  stepNumber,
}: {
  canAct: boolean;
  busy: boolean;
  primaryLabel: string;
  primaryKind?: "approve" | "send";
  primaryDisabled?: boolean;
  secondaryLabel: string;
  hint?: string;
  onPrimary: () => void;
  onRequestRevisions: () => void;
  stepNumber: number;
}) {
  if (!canAct) {
    return <ViewOnlyMessage stepNumber={stepNumber} />;
  }
  const PrimaryIcon = primaryKind === "send" ? Send : CheckCircle2;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onPrimary}
        disabled={busy || primaryDisabled}
        className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        <PrimaryIcon className="h-3.5 w-3.5" />
        {primaryLabel}
      </button>
      <button
        type="button"
        onClick={onRequestRevisions}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-charcoal/20 bg-white px-3.5 py-2 text-sm font-medium text-charcoal/75 hover:border-charcoal/40 hover:text-charcoal disabled:opacity-50"
      >
        <ArrowLeftCircle className="h-3.5 w-3.5" />
        {secondaryLabel}
      </button>
      {hint && (
        <span className="text-[11px] text-charcoal/55">{hint}</span>
      )}
    </div>
  );
}

// ---------- Brief card (used at step 1 + collapsed in ContextStack) ----------

function BriefSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-600">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <div className="text-[12px] leading-relaxed text-charcoal/80">{children}</div>
    </section>
  );
}

function BriefKV({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-x-3 py-0.5">
      <span className="text-charcoal/55">{label}</span>
      <span className="text-charcoal/85">{value}</span>
    </div>
  );
}

function BriefBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5 py-0.5">
      <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-charcoal/40" />
      <span>{children}</span>
    </li>
  );
}

export function BriefCard({
  brief,
  editable,
  onSave,
}: {
  brief: CampaignContext["campaign_brief"];
  editable?: boolean;
  onSave?: (updated: CampaignContext["campaign_brief"]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [wasEdited, setWasEdited] = useState(false);
  const [draft, setDraft] = useState({
    name: brief.name,
    objective: brief.objective,
    target_customer: brief.target_customer,
    promotional_offer: brief.promotional_offer.join("\n"),
    constraints: brief.constraints.join("\n"),
  });

  function startEditing() {
    setDraft({
      name: brief.name,
      objective: brief.objective,
      target_customer: brief.target_customer,
      promotional_offer: brief.promotional_offer.join("\n"),
      constraints: brief.constraints.join("\n"),
    });
    setEditing(true);
  }

  function handleSave() {
    const updated = {
      ...brief,
      name: draft.name,
      objective: draft.objective,
      target_customer: draft.target_customer,
      promotional_offer: draft.promotional_offer.split("\n").map((s) => s.trim()).filter(Boolean),
      constraints: draft.constraints.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    onSave?.(updated);
    setWasEdited(true);
    setEditing(false);
  }

  function handleCancel() {
    setEditing(false);
  }

  function resetToOriginal() {
    setWasEdited(false);
  }

  const inputCls =
    "w-full rounded-md border border-charcoal/20 bg-white px-3 py-1.5 text-[12px] text-charcoal/80 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600/30";

  return (
    <div className="rounded-md border border-charcoal/10 bg-cream/50 p-5">
      <div className="mb-4 flex items-start justify-between border-b border-charcoal/10 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-charcoal/45">
            Campaign Brief · Filed by {brief.sponsor}
            {wasEdited && (
              <span className="normal-case italic tracking-normal text-charcoal/40">
                (manually edited)
              </span>
            )}
          </div>
          <div className="mt-0.5 font-serif text-base font-semibold text-charcoal">
            {brief.name}
          </div>
        </div>
        {editable && !editing && (
          <button
            type="button"
            onClick={startEditing}
            className="rounded p-1 text-charcoal/40 hover:bg-cream hover:text-charcoal/70"
            title="Edit brief"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal/50">Campaign Name</label>
            <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal/50">Strategic Objective</label>
            <textarea value={draft.objective} onChange={(e) => setDraft({ ...draft, objective: e.target.value })} rows={3} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal/50">Target Customer</label>
            <textarea value={draft.target_customer} onChange={(e) => setDraft({ ...draft, target_customer: e.target.value })} rows={2} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal/50">Promotional Offer (one per line)</label>
            <textarea value={draft.promotional_offer} onChange={(e) => setDraft({ ...draft, promotional_offer: e.target.value })} rows={3} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal/50">Constraints (one per line)</label>
            <textarea value={draft.constraints} onChange={(e) => setDraft({ ...draft, constraints: e.target.value })} rows={3} className={inputCls} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={handleSave} className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700">Save Changes</button>
            <button type="button" onClick={handleCancel} className="inline-flex items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium text-charcoal/65 hover:border-charcoal/30">Cancel</button>
          </div>
          <p className="text-xs italic text-mustard">
            Editing the brief may require downstream steps (segmentation, SKU selection, compliance) to be re-run.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <BriefSection icon={FileText} title="Campaign Overview">
            <div className="space-y-0">
              <BriefKV label="Campaign Name" value={brief.name} />
              <BriefKV label="Campaign ID" value={brief.campaign_id} />
              <BriefKV label="Sponsored by" value={brief.sponsor} />
              <BriefKV label="Filed" value={`${brief.filed_days_before_launch} days before launch`} />
            </div>
          </BriefSection>

          <BriefSection icon={Target} title="Strategic Objective">
            <p>{brief.objective}</p>
          </BriefSection>

          <BriefSection icon={Users} title="Target Customer">
            <p>{brief.target_customer}</p>
          </BriefSection>

          <div className="grid gap-4 md:grid-cols-2">
            <BriefSection icon={BadgePercent} title="Promotional Offer">
              <ul className="space-y-0">
                {brief.promotional_offer.map((line) => (
                  <BriefBullet key={line}>{line}</BriefBullet>
                ))}
              </ul>
            </BriefSection>

            <BriefSection icon={Calendar} title="Campaign Window">
              <ul className="space-y-0">
                <BriefBullet>Soft launch: {brief.campaign_window.soft_launch}</BriefBullet>
                <BriefBullet>Peak: {brief.campaign_window.peak}</BriefBullet>
                <BriefBullet>Closeout: {brief.campaign_window.closeout}</BriefBullet>
              </ul>
            </BriefSection>

            <BriefSection icon={Wallet} title="Budget Allocation">
              <ul className="space-y-0">
                <BriefBullet>Paid media: {brief.budget.paid_media}</BriefBullet>
                <BriefBullet>Store experience: {brief.budget.store_experience}</BriefBullet>
                <BriefBullet>Email and CRM: {brief.budget.email_crm}</BriefBullet>
                <BriefBullet>
                  <span className="font-semibold text-charcoal">Total: {brief.budget.total}</span>
                </BriefBullet>
              </ul>
            </BriefSection>

            <BriefSection icon={TrendingUp} title="Success Metrics">
              <ul className="space-y-0">
                <BriefBullet>Revenue target: {brief.success_metrics.revenue_target}</BriefBullet>
                <BriefBullet>ROAS goal: {brief.success_metrics.roas_goal}</BriefBullet>
                <BriefBullet>New Beauty acquisition: {brief.success_metrics.new_beauty_customer_acquisition}</BriefBullet>
                <BriefBullet>Email open rate: {brief.success_metrics.email_open_rate}</BriefBullet>
              </ul>
            </BriefSection>
          </div>

          <BriefSection icon={AlertTriangle} title="Constraints">
            <ul className="space-y-0">
              {brief.constraints.map((line) => (
                <BriefBullet key={line}>{line}</BriefBullet>
              ))}
            </ul>
          </BriefSection>

          {wasEdited && (
            <button
              type="button"
              onClick={resetToOriginal}
              className="inline-flex items-center gap-1 text-[11px] text-teal-600 hover:underline"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to original brief
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Context stack: brief summary + completed step decisions ----------

const STEP_DECISION_SUMMARY: Record<number, string> = {
  1: "Brief approved on behalf of Marketing Leadership.",
  2: "Segment selected: VIP Loyalists (≈9,590 customers, +5% Accessories lift).",
  3: "18 Beauty SKUs approved (MAC, Estee Lauder, Clinique, Lancome, NARS, +others).",
  4: "12 hero DAM assets approved, prioritizing photo-backed Beauty thumbnails.",
  5: "4 placement layouts approved: web banner, email, mobile, in-store.",
  6: "Final approval signed by Brand Compliance, Legal, and VP Marketing.",
  7: "80 regional variants generated (10 regions × 4 placements × 2 SKUs).",
  8: "Campaign activated across email, web, mobile, in-store, paid social.",
  9: "Performance pulled. Top channel: email (56× ROAS). Top segment: Platinum (+44%).",
};

function DecisionCard({
  step,
  decision,
}: {
  step: number;
  decision: string;
}) {
  const stepName = [
    "Briefing",
    "Segmentation",
    "SKU Selection",
    "Creative Production",
    "Layout Assembly",
    "Final Approval",
    "Localization",
    "Activation",
    "Monitoring",
    "Reporting",
  ][step - 1];
  return (
    <div className="flex items-start gap-2 rounded-md border border-sage/30 bg-sage/5 px-3 py-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-sage" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-sage">
            Step {step}
          </span>
          <span className="text-[11px] font-semibold text-charcoal">
            {stepName}
          </span>
        </div>
        <div className="text-[12px] text-charcoal/70">{decision}</div>
      </div>
    </div>
  );
}

export function ContextStack({ context }: { context: CampaignContext }) {
  const [briefOpen, setBriefOpen] = useState(false);
  const completed = context.state.completed_steps;
  return (
    <div className="space-y-2">
      {/* Collapsible brief summary */}
      <button
        type="button"
        onClick={() => setBriefOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md border border-charcoal/10 bg-cream/40 px-3 py-2 text-left hover:border-charcoal/20"
      >
        {briefOpen ? (
          <ChevronDown className="h-4 w-4 text-charcoal/55" />
        ) : (
          <ChevronRight className="h-4 w-4 text-charcoal/55" />
        )}
        <FileText className="h-3.5 w-3.5 text-charcoal/55" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-charcoal/65">
          Campaign Brief
        </span>
        <span className="ml-auto text-[11px] text-charcoal/50">
          {context.campaign_brief.name}
        </span>
      </button>
      {briefOpen && <BriefCard brief={context.campaign_brief} />}

      {/* Completed step decisions, in order */}
      {completed.map((step) => {
        let decision = STEP_DECISION_SUMMARY[step] ?? "Step completed.";
        // Use the dynamically selected segment name for step 2 if available.
        if (step === 2) {
          const out = context.state.step_outputs["2"] as Record<string, unknown> | undefined;
          if (out && typeof out.name === "string") {
            const count = typeof out.customer_count === "number" ? out.customer_count : 0;
            decision = `Segment selected: ${out.name} (${count.toLocaleString()} customers).`;
          }
        }
        return (
          <DecisionCard
            key={step}
            step={step}
            decision={decision}
          />
        );
      })}
    </div>
  );
}

// ---------- Helpers ----------

export function ActiveBadge({ stepNumber, total = 10 }: { stepNumber: number; total?: number }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wider text-teal-600">
      Step {stepNumber} of {total} · Active
    </span>
  );
}

export function ActiveIcon({ canAct }: { canAct: boolean }) {
  return (
    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
      {canAct ? <Sparkles className="h-5 w-5" /> : <Hourglass className="h-5 w-5" />}
    </span>
  );
}
