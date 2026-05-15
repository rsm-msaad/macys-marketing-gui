"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, Sparkles } from "lucide-react";

import { fetchActivity, type ActivityEvent } from "@/lib/ai_client";
import type { SkillKind } from "@/components/SkillCard";

const SKILL_META: Record<
  SkillKind,
  {
    title: string;
    description: string;
    cta: string;
    accent: string;
    stepType: "skill" | "automation";
  }
> = {
  segment: {
    title: "Audience Segment Builder",
    description:
      "RFM k means clustering on 50,000 customers. Returns three behavior based segments with counts, recency, frequency, and monetary lift.",
    cta: "Build Segments",
    accent: "#0B7B8A",
    stepType: "automation",
  },
  dam: {
    title: "DAM Asset Finder",
    description:
      "Scans 5,000 DAM records, filters out degraded and expired assets, and ranks the rest by tag relevance plus recency and resolution boosts.",
    cta: "Search DAM",
    accent: "#D4A843",
    stepType: "automation",
  },
  localize: {
    title: "Localization Generator",
    description:
      "Generates 40 regional/placement variants per master SKU, with regional pricing, regional inventory, and regionally voiced copy.",
    cta: "Generate Variants",
    accent: "#8DA67E",
    stepType: "automation",
  },
  analyze: {
    title: "Campaign Performance Analyzer",
    description:
      "Last touch attribution across channels, segments, and SKUs, plus a 14 day forecast with 80 percent confidence intervals.",
    cta: "Analyze Campaign",
    accent: "#C97373",
    stepType: "automation",
  },
};

const FRIENDLY_SKILL: Record<string, string> = {
  compliance_pre_check: "Compliance",
  approval_brief_generator: "Brief Generator",
  revision_router: "Revision Router",
  approval_cascade: "Approval Cascade",
  ai_chat: "AI Chat",
};

function friendlyName(skillName: string): string {
  return FRIENDLY_SKILL[skillName] || skillName;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const POLL_MS = 30_000;

export function AICoworkerPanel({
  skills,
  campaignId,
  onLaunchSkill,
}: {
  skills: SkillKind[];
  campaignId?: string;
  onLaunchSkill: (kind: SkillKind) => void;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const refresh = useCallback(() => {
    fetchActivity(campaignId, 10)
      .then((data) => setEvents(data.events))
      .catch(() => {});
  }, [campaignId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <section className="rounded-panel border border-charcoal/[0.06] bg-white shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-charcoal/[0.06] px-6 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-600">
            AI Coworker
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: "#0B7B8A1A", color: "#0B7B8A" }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-600" />
          Active
        </span>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Activity feed */}
        <div>
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone">
            Recent activity
          </h3>
          {events.length === 0 ? (
            <p className="text-xs italic text-stone/50">
              No AI activity in this session yet
            </p>
          ) : (
            <ul className="space-y-2.5">
              {events.slice(0, 5).map((evt, i) => (
                <li key={`${evt.timestamp}_${i}`} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gold" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-stone/60">
                        {relativeTime(evt.timestamp)}
                      </span>
                      <span className="rounded-full bg-charcoal/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-stone">
                        {friendlyName(evt.skill_name)}
                      </span>
                    </div>
                    <p className="truncate text-[12px] text-charcoal/70">{evt.summary}</p>
                    {evt.retrieved_docs.length > 0 && (
                      <p className="mt-0.5 truncate font-mono text-[10px] text-stone/40">
                        {evt.retrieved_docs[0]}
                        {evt.retrieved_docs.length > 1 &&
                          ` +${evt.retrieved_docs.length - 1} more`}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-charcoal/[0.06]" />

        {/* Invokable actions */}
        <div>
          <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone">
            Now invokable
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {skills.map((kind) => {
              const m = SKILL_META[kind];
              const isSkill = m.stepType === "skill";
              return (
                <div
                  key={kind}
                  className="card-hover rounded-card border border-charcoal/[0.06] bg-cream/40 p-5"
                >
                  <div
                    className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: isSkill ? "#0B7B8A1A" : "#78716C1A",
                      color: isSkill ? "#0B7B8A" : "#57534E",
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: isSkill ? "#0B7B8A" : "#78716C",
                      }}
                    />
                    {isSkill ? "Skill" : "Automation"}
                  </div>
                  <h4 className="font-display text-base font-semibold text-charcoal">
                    {m.title}
                  </h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-stone">
                    {m.description}
                  </p>
                  <button
                    type="button"
                    onClick={() => onLaunchSkill(kind)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium text-white transition-colors"
                    style={{ backgroundColor: m.accent }}
                  >
                    <Play className="h-3 w-3" />
                    {m.cta}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
