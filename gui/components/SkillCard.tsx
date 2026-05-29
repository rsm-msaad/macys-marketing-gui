"use client";

import { Play } from "lucide-react";

export type SkillKind = "segment" | "dam" | "localize" | "analyze" | "sku-recommend" | "layout-copy";

const META: Record<
  SkillKind,
  { title: string; description: string; cta: string; accent: string }
> = {
  segment: {
    title: "Audience Segment Builder",
    description:
      "RFM k-means clustering on 50,000 customers. Returns three behavior based segments with counts, recency, frequency, and monetary lift.",
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
      "Generates 40 regional/placement variants per master SKU, with regional pricing, regional inventory, and regionally voiced copy. Fully automated.",
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
  "sku-recommend": {
    title: "SKU Recommender",
    description:
      "Filters and ranks SKUs by inventory, margin, vendor commitment, seasonality, and MAP compliance.",
    cta: "Recommend SKUs",
    accent: "#78716C",
  },
  "layout-copy": {
    title: "Layout Copy Generator",
    description:
      "Generates marketing copy (tagline, body, CTA) for 4 ad placements based on the campaign brief and audience.",
    cta: "Generate Copy",
    accent: "#0B7B8A",
  },
};

export function SkillCard({
  kind,
  onLaunch,
}: {
  kind: SkillKind;
  onLaunch: () => void;
}) {
  const m = META[kind];
  return (
    <div className="flex flex-col rounded-lg border border-charcoal/10 bg-white p-5 shadow-sm">
      <div
        className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider"
        style={{ backgroundColor: `${m.accent}1A`, color: m.accent }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m.accent }} />
        Skill
      </div>
      <h3 className="font-serif text-lg font-semibold text-charcoal">{m.title}</h3>
      <p className="mt-2 text-sm text-charcoal/70 leading-relaxed">{m.description}</p>
      <button
        type="button"
        onClick={onLaunch}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white"
        style={{ backgroundColor: m.accent }}
      >
        <Play className="h-3.5 w-3.5" /> {m.cta}
      </button>
    </div>
  );
}
