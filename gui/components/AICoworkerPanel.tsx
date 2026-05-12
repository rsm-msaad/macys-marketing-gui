"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, Diamond } from "lucide-react";

import { fetchActivity, type ActivityEvent } from "@/lib/ai_client";
import type { SkillKind } from "@/components/SkillCard";

const SKILL_META: Record<
  SkillKind,
  { title: string; description: string; cta: string; accent: string }
> = {
  segment: {
    title: "Audience Segment Builder",
    description:
      "RFM k means clustering on 50,000 customers. Returns three behavior based segments with counts, recency, frequency, and monetary lift.",
    cta: "Build Segments",
    accent: "#0B7B8A",
  },
  dam: {
    title: "DAM Asset Finder",
    description:
      "Scans 5,000 DAM records, filters out degraded and expired assets, and ranks the rest by tag relevance plus recency and resolution boosts.",
    cta: "Search DAM",
    accent: "#D4A537",
  },
  localize: {
    title: "Localization Generator",
    description:
      "Generates 40 regional/placement variants per master SKU, with regional pricing, regional inventory, and regionally voiced copy.",
    cta: "Generate Variants",
    accent: "#87A96B",
  },
  analyze: {
    title: "Campaign Performance Analyzer",
    description:
      "Last touch attribution across channels, segments, and SKUs, plus a 14 day forecast with 80 percent confidence intervals.",
    cta: "Analyze Campaign",
    accent: "#C84B4B",
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
    <section className="rounded-lg border border-charcoal/10 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-charcoal/10 px-5 py-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-teal-600">
          AI Coworker
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-teal-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
          Active
        </span>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Activity feed */}
        <div>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-charcoal/55">
            Recent activity
          </h3>
          {events.length === 0 ? (
            <p className="text-xs text-charcoal/45 italic">
              No AI activity in this session yet
            </p>
          ) : (
            <ul className="space-y-2">
              {events.slice(0, 5).map((evt, i) => (
                <li key={`${evt.timestamp}_${i}`} className="flex items-start gap-2">
                  <Diamond className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 fill-teal-500 text-teal-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-charcoal/45">
                        {relativeTime(evt.timestamp)}
                      </span>
                      <span className="rounded bg-charcoal/5 px-1 py-px text-[9px] font-medium text-charcoal/50">
                        {friendlyName(evt.skill_name)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-charcoal/75">{evt.summary}</p>
                    {evt.retrieved_docs.length > 0 && (
                      <p className="mt-0.5 truncate font-mono text-[10px] text-charcoal/40">
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
        <div className="border-t border-charcoal/10" />

        {/* Invokable skills */}
        <div>
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-charcoal/55">
            Now invokable
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {skills.map((kind) => {
              const m = SKILL_META[kind];
              return (
                <div
                  key={kind}
                  className="rounded-lg border border-charcoal/10 bg-cream/30 p-4"
                >
                  <div
                    className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${m.accent}1A`,
                      color: m.accent,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: m.accent }}
                    />
                    Skill
                  </div>
                  <h4 className="font-serif text-base font-semibold text-charcoal">
                    {m.title}
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-charcoal/65">
                    {m.description}
                  </p>
                  <button
                    type="button"
                    onClick={() => onLaunchSkill(kind)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white"
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
