"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { createCampaign } from "@/lib/api";
import { EXAMPLE_CAMPAIGNS, type ExampleCampaign } from "@/lib/example-campaigns";

const CATEGORIES = ["Beauty", "Fashion", "Home", "Accessories", "Children", "Men's"];
const CHANNELS = ["Email", "SMS", "Push", "In-Store", "Display", "Social"];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-soft_red">{message}</p>;
}

export default function StartPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Beauty");
  const [launchDate, setLaunchDate] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [channels, setChannels] = useState<Set<string>>(new Set());

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  function toggleChannel(ch: string) {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }

  function loadExample(ex: ExampleCampaign) {
    setName(ex.name);
    setCategory(ex.category);
    setLaunchDate(ex.launch_date);
    setBudget((ex.budget?.total ?? "").replace(/[$,]/g, ""));
    setDescription(ex.objective ?? "");
    setChannels(new Set(ex.channels));
    setErrors({});
    setApiError(null);
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (name.trim().length < 5) errs.name = "Campaign name must be at least 5 characters.";
    if (!launchDate) errs.launchDate = "Launch date is required.";
    else if (new Date(launchDate) <= new Date()) errs.launchDate = "Launch date must be in the future.";
    if (description.trim().length < 200) errs.description = `Brief must be at least 200 characters (currently ${description.trim().length}).`;
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setApiError(null);
    try {
      await createCampaign({
        name: name.trim(),
        sponsor: "Campaign Manager",
        objective: description.trim(),
        target_customer: `${category} audience`,
        promotional_offer: [],
        campaign_window: { soft_launch: launchDate, peak: launchDate, closeout: launchDate },
        budget: budget ? { total: `$${budget}` } : {},
        constraints: [],
      });
      router.push("/campaign-manager");
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-charcoal/20 bg-white px-3 py-2.5 text-sm text-charcoal focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600/30";
  const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-charcoal/55";

  return (
    <main className="min-h-screen bg-cream">
      {/* Header */}
      <header className="border-b border-charcoal/10 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-charcoal/50 hover:text-charcoal">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <Link href="/" className="font-serif text-xl font-bold tracking-wide text-charcoal">
            MACY&apos;S
          </Link>
          <div className="w-16" />
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-3xl px-6 py-10"
      >
        {/* Title */}
        <div className="mb-8 text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1">
            <Sparkles className="h-4 w-4 text-teal-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">New Campaign</span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-charcoal">Start a Campaign Workflow</h1>
          <p className="mt-2 text-sm text-charcoal/60">
            Enter the campaign details below. The AI coworker will guide you through 10 steps from
            briefing to performance analysis.
          </p>
        </div>

        {/* Load Example */}
        <div className="mb-8 rounded-lg border border-charcoal/10 bg-white p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-charcoal/45">
            Quick start with an example
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_CAMPAIGNS.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => loadExample(ex)}
                className="rounded-md border border-teal-600/20 bg-teal-50/50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* API Error */}
        {apiError && (
          <div className="mb-6 rounded-md border border-soft_red/30 bg-soft_red/5 px-4 py-3 text-sm text-soft_red">
            {apiError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-charcoal/10 bg-white p-6">
          {/* Campaign Name */}
          <div>
            <label className={labelCls}>Campaign Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Mother's Day Beauty Event"
              className={inputCls}
            />
            <FieldError message={errors.name} />
          </div>

          {/* Category + Launch Date row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Target Launch Date *</label>
              <input
                type="date"
                value={launchDate}
                onChange={(e) => setLaunchDate(e.target.value)}
                className={inputCls}
              />
              <FieldError message={errors.launchDate} />
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className={labelCls}>Budget (optional)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-charcoal/40">$</span>
              <input
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value.replace(/[^0-9.KMkm]/g, ""))}
                placeholder="e.g., 1.8M"
                className={`${inputCls} pl-7`}
              />
            </div>
          </div>

          {/* Brief Description */}
          <div>
            <label className={labelCls}>Brief Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the campaign objective, target audience, and key offers. At least 200 characters."
              className={inputCls}
            />
            <div className="mt-1 flex items-center justify-between">
              <FieldError message={errors.description} />
              <span className={`text-[11px] ${description.length >= 200 ? "text-sage" : "text-charcoal/40"}`}>
                {description.length}/200
              </span>
            </div>
          </div>

          {/* Channels */}
          <div>
            <label className={labelCls}>Channels</label>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    channels.has(ch)
                      ? "border-teal-600 bg-teal-50 text-teal-700"
                      : "border-charcoal/15 text-charcoal/55 hover:border-charcoal/30"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="border-t border-charcoal/10 pt-5">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-teal-700 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Start Workflow
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </main>
  );
}
