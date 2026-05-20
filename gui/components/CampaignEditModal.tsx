"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

import {
  createCampaign,
  updateCampaign,
  type CampaignBrief,
  type CampaignBriefInput,
} from "@/lib/api";

const ALL_REGIONS = ["NY", "FL", "CA", "TX", "IL", "PR", "QC"];

const APPROVED_TAGLINES = [
  "The Magic of Macys",
  "Find Your Magic",
  "Star Rewards Every Day",
  "New In Store, New Online",
];

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-charcoal/60">
        {label}
        {required && <span className="ml-0.5 text-mustard">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";

export function CampaignEditModal({
  mode,
  brief,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  brief: CampaignBrief | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [offers, setOffers] = useState("");
  const [paidMedia, setPaidMedia] = useState("");
  const [storeExp, setStoreExp] = useState("");
  const [emailCrm, setEmailCrm] = useState("");
  const [softLaunch, setSoftLaunch] = useState("");
  const [peak, setPeak] = useState("");
  const [closeout, setCloseout] = useState("");
  const [revenueTarget, setRevenueTarget] = useState("");
  const [roasGoal, setRoasGoal] = useState("");
  const [newCust, setNewCust] = useState("");
  const [emailRate, setEmailRate] = useState("");
  const [constraintsText, setConstraintsText] = useState("");
  const [skusText, setSkusText] = useState("");
  const [tagline, setTagline] = useState(APPROVED_TAGLINES[0]);
  const [discountPct, setDiscountPct] = useState(15);
  const [regions, setRegions] = useState<string[]>(["NY", "CA", "FL", "TX"]);
  const [daysBeforeLaunch, setDaysBeforeLaunch] = useState(14);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "edit" && brief) {
      setName(brief.name || "");
      setObjective(brief.objective || "");
      setTargetCustomer(brief.target_customer || "");
      setOffers((brief.promotional_offer || []).join("\n"));
      setPaidMedia(brief.budget?.paid_media || "");
      setStoreExp(brief.budget?.store_experience || "");
      setEmailCrm(brief.budget?.email_crm || "");
      setSoftLaunch(brief.campaign_window?.soft_launch || "");
      setPeak(brief.campaign_window?.peak || "");
      setCloseout(brief.campaign_window?.closeout || "");
      setRevenueTarget(brief.success_metrics?.revenue_target || "");
      setRoasGoal(brief.success_metrics?.roas_goal || "");
      setNewCust(brief.success_metrics?.new_beauty_customer_acquisition || "");
      setEmailRate(brief.success_metrics?.email_open_rate || "");
      setConstraintsText((brief.constraints || []).join("\n"));
      setDaysBeforeLaunch(brief.filed_days_before_launch || 14);
    }
  }, [mode, brief]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleRegion(r: string) {
    setRegions((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Campaign name is required");
      return;
    }
    if (!objective.trim()) {
      setError("Strategic objective is required");
      return;
    }
    setError(null);
    setBusy(true);

    const data: CampaignBriefInput = {
      name: name.trim(),
      filed_days_before_launch: daysBeforeLaunch,
      objective: objective.trim(),
      target_customer: targetCustomer.trim(),
      promotional_offer: offers
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      campaign_window: {
        soft_launch: softLaunch || "14 days before launch",
        peak: peak || "7 days before launch",
        closeout: closeout || "Launch day end of day",
      },
      budget: {
        paid_media: paidMedia || "$0",
        store_experience: storeExp || "$0",
        email_crm: emailCrm || "$0",
      },
      success_metrics: {
        revenue_target: revenueTarget,
        roas_goal: roasGoal,
        new_beauty_customer_acquisition: newCust,
        email_open_rate: emailRate,
      },
      constraints: constraintsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      tagline,
      discount_pct: discountPct,
      regions,
      skus: skusText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      if (mode === "edit" && brief) {
        await updateCampaign(brief.campaign_id, data);
      } else {
        await createCampaign(data);
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-charcoal/35 p-4 pt-12"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b border-charcoal/10 bg-white px-6 py-4">
          <h2 className="font-serif text-lg font-semibold text-charcoal">
            {mode === "create" ? "New Campaign" : "Edit Campaign"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-charcoal/50 hover:bg-cream hover:text-charcoal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Campaign Name" required>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Father's Day Tech Gifts"
                className={inputCls}
              />
            </Field>
          </div>

          {mode === "edit" && brief && (
            <Field label="Campaign ID">
              <input
                type="text"
                value={brief.campaign_id}
                readOnly
                className={`${inputCls} bg-cream text-charcoal/50`}
              />
            </Field>
          )}

          <Field label="Days Before Launch">
            <input
              type="number"
              value={daysBeforeLaunch}
              onChange={(e) => setDaysBeforeLaunch(parseInt(e.target.value, 10) || 14)}
              min={1}
              className={inputCls}
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Strategic Objective" required>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                rows={3}
                placeholder="What should this campaign achieve?"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Target Customer">
              <textarea
                value={targetCustomer}
                onChange={(e) => setTargetCustomer(e.target.value)}
                rows={2}
                placeholder="Who is this campaign for?"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Promotional Offers (one per line)">
              <textarea
                value={offers}
                onChange={(e) => setOffers(e.target.value)}
                rows={3}
                placeholder={"25% off all Beauty\nFree gift with purchase $75+"}
                className={inputCls}
              />
            </Field>
          </div>

          {/* Budget */}
          <Field label="Budget: Paid Media">
            <input
              type="text"
              value={paidMedia}
              onChange={(e) => setPaidMedia(e.target.value)}
              placeholder="$1.2M"
              className={inputCls}
            />
          </Field>
          <Field label="Budget: Store Experience">
            <input
              type="text"
              value={storeExp}
              onChange={(e) => setStoreExp(e.target.value)}
              placeholder="$400K"
              className={inputCls}
            />
          </Field>
          <Field label="Budget: Email and CRM">
            <input
              type="text"
              value={emailCrm}
              onChange={(e) => setEmailCrm(e.target.value)}
              placeholder="$200K"
              className={inputCls}
            />
          </Field>

          {/* Campaign window */}
          <Field label="Soft Launch">
            <input
              type="text"
              value={softLaunch}
              onChange={(e) => setSoftLaunch(e.target.value)}
              placeholder="14 days before launch"
              className={inputCls}
            />
          </Field>
          <Field label="Peak">
            <input
              type="text"
              value={peak}
              onChange={(e) => setPeak(e.target.value)}
              placeholder="7 days before launch"
              className={inputCls}
            />
          </Field>
          <Field label="Closeout">
            <input
              type="text"
              value={closeout}
              onChange={(e) => setCloseout(e.target.value)}
              placeholder="Launch day end of day"
              className={inputCls}
            />
          </Field>

          {/* Success metrics */}
          <Field label="Revenue Target">
            <input type="text" value={revenueTarget} onChange={(e) => setRevenueTarget(e.target.value)} placeholder="$4.2M" className={inputCls} />
          </Field>
          <Field label="ROAS Goal">
            <input type="text" value={roasGoal} onChange={(e) => setRoasGoal(e.target.value)} placeholder="3.5x" className={inputCls} />
          </Field>

          {/* Tagline */}
          <Field label="Tagline">
            <select
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className={inputCls}
            >
              {APPROVED_TAGLINES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          {/* Discount */}
          <Field label="Discount Percentage">
            <input
              type="number"
              value={discountPct}
              onChange={(e) => setDiscountPct(parseFloat(e.target.value) || 0)}
              min={0}
              max={100}
              className={inputCls}
            />
          </Field>

          {/* Regions */}
          <div className="md:col-span-2">
            <span className="block text-xs font-medium text-charcoal/60">Regions</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {ALL_REGIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRegion(r)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    regions.includes(r)
                      ? "bg-teal-600 text-white"
                      : "border border-charcoal/15 bg-white text-charcoal/60 hover:border-teal-600 hover:text-teal-600"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* SKUs */}
          <div className="md:col-span-2">
            <Field label="SKU Names (comma separated)">
              <input
                type="text"
                value={skusText}
                onChange={(e) => setSkusText(e.target.value)}
                placeholder="MAC Lipstick, Clinique Moisturizer, Coach Bag"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Constraints */}
          <div className="md:col-span-2">
            <Field label="Constraints (one per line)">
              <textarea
                value={constraintsText}
                onChange={(e) => setConstraintsText(e.target.value)}
                rows={3}
                placeholder={"Legal review required\nCannot include prestige brands"}
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between rounded-b-lg border-t border-charcoal/10 bg-white px-6 py-4">
          {error && <p className="text-xs text-soft_red">{error}</p>}
          <div className="ml-auto flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-charcoal/15 bg-white px-4 py-2 text-sm font-medium text-charcoal hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {mode === "create" ? "Create Campaign" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
