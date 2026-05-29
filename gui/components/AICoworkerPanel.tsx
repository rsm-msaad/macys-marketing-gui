"use client";

import { useCallback, useEffect, useState } from "react";
import { Diamond } from "lucide-react";

import { fetchActivity, type ActivityEvent } from "@/lib/ai_client";
import type { SkillKind } from "@/components/SkillCard";

// Which invokable tools belong to each workflow step.
// Steps not listed (or mapped to []) show the "Human task" message.
const STEP_TOOLS: Record<number, SkillKind[]> = {
  2: ["segment"],
  3: ["sku-recommend"],
  4: ["dam"],
  5: ["layout-copy"],
  7: ["localize"],
  9: ["analyze"],
};

// Steps where AI fires automatically (not via the invokable panel).
const STEP_AI_NOTE: Record<number, string> = {
  6: "Three AI skills fire automatically at this step: Compliance Pre Check, Approval Brief Generator, and Revision Router. Skills use LLM judgment because reading copy and deciding what to flag cannot be reduced to fixed rules.",
  8: "The Activation Scheduler automation fires automatically after VP approval. Timezone math and send time computation are deterministic, so no LLM is needed.",
};

// Tools that fire on each step. Only check_pricing_conflicts and
// send_campaign_summary are real MCP tools used by AI agents.
// find_dam_assets and generate_locale_variants are Python helper
// functions called directly by automations.
type ToolMeta = {
  name: string;
  description: string;
  calledBy: string;
  kind: "mcp" | "helper";
};

const STEP_TOOL_META: Record<number, ToolMeta[]> = {
  4: [
    {
      name: "find_dam_assets",
      description: "Searches the DAM database by category and tags, filtered by resolution, rights status, and recency.",
      calledBy: "DAM Asset Finder automation",
      kind: "helper",
    },
  ],
  6: [
    {
      name: "check_pricing_conflicts",
      description: "Validates SKUs against MAP (Minimum Advertised Price) rules at the campaign discount. Claude calls this tool agentically mid-reasoning.",
      calledBy: "Compliance Pre Check (agentic)",
      kind: "mcp",
    },
  ],
  7: [
    {
      name: "generate_locale_variants",
      description: "Generates Spanish and Quebec French translations of ad copy via phrase substitution.",
      calledBy: "Localization Generator automation",
      kind: "helper",
    },
  ],
};

const SKILL_META: Record<
  SkillKind,
  {
    title: string;
    description: string;
    rationale: string;
    stepType: "skill" | "automation";
  }
> = {
  segment: {
    title: "Audience Segment Builder",
    description:
      "RFM k-means clustering on 50,000 customers. Returns three behavior-based segments with counts, recency, frequency, and monetary lift.",
    rationale:
      "Same data always produces the same segments. No interpretation needed, just math.",
    stepType: "automation",
  },
  dam: {
    title: "DAM Asset Finder",
    description:
      "Scans 5,000 DAM records, filters out degraded and expired assets, and ranks the rest by tag relevance plus recency and resolution boosts.",
    rationale:
      "Scoring rules are deterministic. Same brief and catalog always return the same ranked list.",
    stepType: "automation",
  },
  localize: {
    title: "Localization Generator",
    description:
      "Generates 40 regional/placement variants per master SKU, with regional pricing, regional inventory, and regionally voiced copy.",
    rationale:
      "Template expansion with lookup tables. Region, language, and pricing are fixed mappings.",
    stepType: "automation",
  },
  analyze: {
    title: "Campaign Performance Analyzer",
    description:
      "Last-touch attribution across channels, segments, and SKUs, plus a 14-day forecast with 80 percent confidence intervals.",
    rationale:
      "Statistical model with reproducible results. Same campaign data always yields the same attribution and forecast.",
    stepType: "automation",
  },
  "sku-recommend": {
    title: "SKU Recommender",
    description:
      "Filters and ranks SKUs by inventory, margin, vendor commitment, seasonality, and MAP compliance. Returns top candidates for the campaign manager to review.",
    rationale:
      "Deterministic scoring formula. Same inputs always give the same outputs. No LLM judgment needed.",
    stepType: "automation",
  },
  "layout-copy": {
    title: "Layout Copy Generator",
    description:
      "Generates marketing copy (tagline, body, CTA, visual direction) for 4 ad placements based on the campaign brief, audience segment, and SKUs.",
    rationale:
      "Writing brand voice copy that fits character limits and audience tone requires LLM judgment, not fixed rules.",
    stepType: "skill",
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
  currentStep,
}: {
  skills: SkillKind[];
  campaignId?: string;
  currentStep?: number | null;
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
        <h2 className="text-xs font-semibold uppercase tracking-widest text-teal-600">
          AI Tools
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-teal-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
          Ready
        </span>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Activity feed */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-charcoal/55">
            Recent AI Work
          </h3>
          {events.length === 0 ? (
            <p className="text-xs text-charcoal/45 italic">
              Click a tool below to see what the AI does
            </p>
          ) : (
            <ul className="space-y-2">
              {events.slice(0, 5).map((evt, i) => (
                <li key={`${evt.timestamp}_${i}`} className="flex items-start gap-2">
                  <Diamond className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 fill-teal-500 text-teal-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-charcoal/45">
                        {relativeTime(evt.timestamp)}
                      </span>
                      <span className="rounded bg-charcoal/5 px-1 py-px text-[11px] font-medium text-charcoal/50">
                        {friendlyName(evt.skill_name)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-charcoal/75">{evt.summary}</p>
                    {evt.retrieved_docs.length > 0 && (
                      <p className="mt-0.5 truncate font-mono text-xs text-charcoal/40">
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

        {/* Informational tools panel, filtered by current step */}
        <StepToolsSection
          skills={skills}
          currentStep={currentStep}
        />
      </div>
    </section>
  );
}

function StepToolsSection({
  skills,
  currentStep,
}: {
  skills: SkillKind[];
  currentStep?: number | null;
}) {
  const step = currentStep ?? 0;
  const allowedKinds = STEP_TOOLS[step] ?? [];
  const visibleSkills = skills.filter((k) => allowedKinds.includes(k));
  const aiNote = STEP_AI_NOTE[step];
  const mcpTools = STEP_TOOL_META[step] ?? [];
  const hasAnything = visibleSkills.length > 0 || aiNote || mcpTools.length > 0;

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-charcoal/55">
        Available for this step
      </h3>

      {!hasAnything && (
        <p className="text-sm text-charcoal/60 italic">
          Human task. No AI tools at this step.
        </p>
      )}

      {visibleSkills.length === 0 && aiNote && (
        <p className="text-sm text-charcoal/60 italic">{aiNote}</p>
      )}

      {visibleSkills.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleSkills.map((kind) => {
            const m = SKILL_META[kind];
            return (
              <div
                key={kind}
                className="rounded-lg border border-charcoal/10 bg-cream/30 p-4"
              >
                <div
                  className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor:
                      m.stepType === "skill" ? "#0B7B8A1A" : "#78716C1A",
                    color:
                      m.stepType === "skill" ? "#0B7B8A" : "#57534E",
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        m.stepType === "skill" ? "#0B7B8A" : "#78716C",
                    }}
                  />
                  {m.stepType === "skill" ? "Skill" : "Automation"}
                </div>
                <h4 className="font-serif text-base font-semibold text-charcoal">
                  {m.title}
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-charcoal/65">
                  {m.description}
                </p>
                <p className="mt-2 text-[11px] italic text-charcoal/45">
                  Why {m.stepType === "skill" ? "a skill" : "an automation"}? {m.rationale}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tools (MCP or Python helpers) */}
      {mcpTools.length > 0 && (
        <div className={visibleSkills.length > 0 || aiNote ? "mt-3" : ""}>
          <div className="grid gap-3 md:grid-cols-2">
            {mcpTools.map((tool) => (
              <div
                key={tool.name}
                className="rounded-lg border border-charcoal/10 bg-cream/30 p-4"
              >
                {tool.kind === "mcp" ? (
                  <div
                    className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ backgroundColor: "#4338CA1A", color: "#4338CA" }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#4338CA" }} />
                    MCP Tool (Agentic)
                  </div>
                ) : (
                  <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-charcoal/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-charcoal/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-charcoal/30" />
                    Python Helper
                  </div>
                )}
                <h4 className="font-mono text-sm font-semibold text-charcoal">
                  {tool.name}
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-charcoal/65">
                  {tool.description}
                </p>
                <p className="mt-2 text-[11px] italic text-charcoal/45">
                  Called by {tool.calledBy}.{tool.kind === "mcp" ? " Claude decides when to call this tool." : " Called as a Python function, not via MCP."}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
