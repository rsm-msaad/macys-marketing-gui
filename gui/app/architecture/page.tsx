"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

type Component = {
  name: string;
  badge?: "skill" | "automation" | "mcp";
  description: string;
  path?: string;
  example?: string;
};

type Layer = {
  id: string;
  title: string;
  subtitle: string;
  bg: string;
  accent: string;
  description: string;
  components: Component[];
};

const LAYERS: Layer[] = [
  {
    id: "frontend",
    title: "Frontend",
    subtitle: "Next.js 14 on Vercel",
    bg: "bg-[#FDF8F0]",
    accent: "border-[#D4A537]",
    description:
      "The user-facing layer. Renders the campaign workflow, persona-specific views, AI outputs, and supporting pages. Hosted on Vercel with auto-deploy from main.",
    components: [
      { name: "Next.js 14 (App Router)", description: "React framework with server components, file-based routing, and static generation.", path: "gui/app/", example: "Each persona has its own route: /campaign-manager, /senior-designer, etc." },
      { name: "4 Persona Views", description: "Merna (Campaign Manager), Abdullah (Senior Designer), Shankar (Production Artist), Anna (Marketing Analyst). Each sees the same workflow from their role's perspective.", path: "gui/app/campaign-manager/page.tsx" },
      { name: "Workflow Pipeline UI", description: "10-step horizontal progress bar showing completed, active, and pending steps with badges.", path: "gui/components/WorkflowPipeline.tsx" },
      { name: "Storyboard (/story)", description: "Slide-based narrative walkthrough of the project for presentations and grading.", path: "gui/app/story/page.tsx" },
      { name: "RAG Demo (/rag-compare)", description: "Side-by-side comparison of naive vs HyQ retrieval on the same query.", path: "gui/app/rag-compare/page.tsx" },
      { name: "Eval Dashboard (/evals)", description: "Live display of the 67 DeepEval test results across compliance, brief, routing, and RAG.", path: "gui/app/evals/page.tsx" },
    ],
  },
  {
    id: "api",
    title: "API",
    subtitle: "FastAPI on Render",
    bg: "bg-[#FEF0E8]",
    accent: "border-[#C84B4B]",
    description:
      "The backend layer. Handles HTTP requests from the frontend, routes to skills and automations, persists workflow state to disk. FastAPI on Render free tier.",
    components: [
      { name: "FastAPI App", description: "Python web framework with automatic OpenAPI docs, async support, and Pydantic validation.", path: "api/main.py" },
      { name: "Campaign Endpoints", description: "CRUD for campaigns, workflow state, advance/reset/revisions. Powers the sidebar and step transitions.", path: "api/routes/workflow.py" },
      { name: "Skill Endpoints", description: "POST endpoints for each automation and skill: /skills/segment, /skills/dam-search, /skills/sku-recommend, /skills/generate-layout-copy, etc.", path: "api/routes/skills.py" },
      { name: "State Persistence", description: "In-memory dict backed by /tmp/macys_state.json. Survives Render restarts. Written after every mutation.", path: "api/state.py" },
      { name: "RAG Compare API", description: "Runs naive and HyQ retrieval side by side for the demo comparison page.", path: "api/routes/rag_compare.py" },
    ],
  },
  {
    id: "orchestrator",
    title: "Orchestrator",
    subtitle: "Deterministic routing, no LLM in the router",
    bg: "bg-[#EDF5E8]",
    accent: "border-[#87A96B]",
    description:
      "The control layer. Reads workflow state and picks the next step using 8 deterministic rules. The LLM never decides what runs next. Pre-fetches RAG and MCP context before calling Claude.",
    components: [
      { name: "Routing Table", description: "8 priority rules: first match wins. Maps state predicates to skill/automation names. Pure Python, no network calls.", path: "ai_engine/orchestrator/routing_table.py", example: "Rule 1: if status=submitted and no compliance check, run compliance-pre-check." },
      { name: "Skill Invoker", description: "Pre-fetch pattern (Option A). Loads SKILL.md, runs RAG queries, runs MCP tools, builds prompt, calls Claude once, parses JSON.", path: "ai_engine/orchestrator/skill_invoker.py" },
      { name: "Workflow State Engine", description: "Reads and writes workflow_state.json. Each skill output is checkpointed. The next_action field tells the router what to evaluate.", path: "ai_engine/orchestrator/orchestrator.py" },
      { name: "Activity Logger", description: "In-memory deque (max 50 events) tracking which skills ran, when, and what RAG docs were retrieved.", path: "api/main.py" },
    ],
  },
  {
    id: "ai-engine",
    title: "AI Engine",
    subtitle: "4 skills + 7 automations + 3 MCP tools",
    bg: "bg-[#E0F2F1]",
    accent: "border-[#0B7B8A]",
    description:
      "The work layer. Skills call Claude via TritonAI for judgment tasks. Automations are pure deterministic Python. MCP tools provide structured data lookups that skills can invoke.",
    components: [
      { name: "Compliance Pre Check", badge: "skill", description: "Scans campaign copy for banned words, validates taglines, checks pricing claims. Cites 4 RAG docs.", path: "ai_engine/skills/compliance-pre-check/SKILL.md" },
      { name: "Approval Brief Generator", badge: "skill", description: "Writes a prose VP approval brief with goal, audience, ROI, risks, and recommendation.", path: "ai_engine/skills/approval-brief-generator/SKILL.md" },
      { name: "Revision Router", badge: "skill", description: "Parses free-text VP revision comments into change_type, owner, urgency.", path: "ai_engine/skills/revision-router/SKILL.md" },
      { name: "Layout Copy Generator", badge: "skill", description: "Generates tagline, body, CTA, and visual direction for 4 ad placements.", path: "ai_engine/skills/layout-copy-generator/SKILL.md" },
      { name: "Audience Segment Builder", badge: "automation", description: "k-means clustering (k=3) on RFM features across 50K customers.", path: "ai_engine/automations/audience-segment-builder/segment.py" },
      { name: "SKU Recommender", badge: "automation", description: "Scores SKUs by inventory, margin, vendor commitment, seasonality. Excludes MAP violations.", path: "ai_engine/automations/sku-recommender/recommend.py" },
      { name: "DAM Asset Finder", badge: "automation", description: "Filters 5,000 DAM records by quality, ranks by tag relevance with photo boost.", path: "ai_engine/automations/dam-asset-finder/search.py" },
      { name: "Localization Generator", badge: "automation", description: "Region/language mapping, regional pricing overrides, holiday calendar overlays.", path: "ai_engine/automations/localization-generator/helpers.py" },
      { name: "Activation Scheduler", badge: "automation", description: "Timezone math, send time computation, frequency cap rules for channel scheduling.", path: "ai_engine/automations/activation-scheduler/helpers.py" },
      { name: "Campaign Performance Analyzer", badge: "automation", description: "Last-touch attribution + linear regression forecast with 80% confidence intervals.", path: "ai_engine/automations/campaign-performance-analyzer/analyze.py" },
      { name: "Localization Generator v1", badge: "automation", description: "Generates 40 regional/placement variant records from templates (10 regions x 4 placements).", path: "ai_engine/automations/localization-generator-v1/generate.py" },
      { name: "check_pricing_conflicts", badge: "mcp", description: "MCP Tool: Validates SKU list against MAP rules. Called agentically by Claude at Steps 6a/6b.", path: "ai_engine/tools/check_pricing_conflicts.py" },
      { name: "send_campaign_summary", badge: "mcp", description: "MCP Tool: Sends campaign report via Gmail SMTP. Triggered by user at Step 10.", path: "ai_engine/tools/send_campaign_summary.py" },
      { name: "find_dam_assets", badge: "automation", description: "Python helper: DAM lookup by category and region. Called by DAM Asset Finder automation at Step 4.", path: "ai_engine/tools/find_dam_assets.py" },
      { name: "generate_locale_variants", badge: "automation", description: "Python helper: Phrase substitution for Spanish/Quebec French. Called by Localization Generator at Step 7.", path: "ai_engine/tools/generate_locale_variants.py" },
    ],
  },
  {
    id: "data",
    title: "Data",
    subtitle: "RAG corpus, databases, catalogs",
    bg: "bg-[#FDE8E8]",
    accent: "border-[#C84B4B]",
    description:
      "The data layer. 12 proprietary documents for RAG retrieval, product and customer databases for automations, 300 Unsplash photos for DAM thumbnails, and persistent campaign state.",
    components: [
      { name: "RAG Knowledge Base (12 docs)", description: "Brand guidelines, legal disclaimers, pricing rules, campaign retros, approval tickets, compliance examples, team FAQ.", path: "ai_engine/rag/knowledge_base/" },
      { name: "Naive FAISS Index (78 chunks)", description: "L2 heading splits, paragraph sub-splits over 500 words. all-MiniLM-L6-v2 embeddings. Exact inner product search.", path: "ai_engine/rag/index/" },
      { name: "HyQ Index (381 entries)", description: "78 original chunks + 303 generated questions. Matches intent-phrased queries that raw chunks miss. 8/8 recall vs 5/8 for naive.", path: "ai_engine/rag/hyq/index/" },
      { name: "Product Catalog (2,000 SKUs)", description: "macys.db sku_catalog: 5 categories (Beauty, Apparel, Accessories, Home, Shoes), 33 brands. MAP protection derived from 14-brand enforced list. Margins, vendor commitment, and seasonality derived per SKU.", path: "data/macys.db" },
      { name: "DAM Database (5,000 assets)", description: "Synthetic digital asset records with tags, resolution, rights status, quality flags. 300 backed by real Unsplash photos.", path: "data/macys.db" },
      { name: "Customer Database (50K)", description: "Synthetic customer transactions for RFM clustering. Loyalty tiers, purchase history, category preferences.", path: "data/macys.db" },
      { name: "Campaign State", description: "3 seeded campaigns (active, completed, planned). Persisted to /tmp/macys_state.json across Render restarts.", path: "api/state.py" },
    ],
  },
];

const EXTERNAL_SERVICES = [
  { name: "TritonAI (Claude)", note: "UCSD shared LLM proxy" },
  { name: "FastMCP", note: "MCP server for tool calling" },
  { name: "Unsplash API", note: "Real photos for DAM + hero" },
  { name: "Vercel", note: "Frontend hosting" },
  { name: "Render", note: "Backend hosting" },
  { name: "GitHub", note: "Version control" },
];

const BADGE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  skill: { bg: "#0B7B8A1A", text: "#0B7B8A", label: "SKILL" },
  automation: { bg: "#78716C1A", text: "#57534E", label: "AUTOMATION" },
  mcp: { bg: "#4338CA1A", text: "#4338CA", label: "MCP TOOL" },
};

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

function Badge({ type }: { type: "skill" | "automation" | "mcp" }) {
  const s = BADGE_STYLE[type];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.text }} />
      {s.label}
    </span>
  );
}

function ComponentCard({
  comp,
  onClick,
}: {
  comp: Component;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-charcoal/10 bg-white p-3 text-left transition-all hover:border-charcoal/25 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-semibold text-charcoal">{comp.name}</span>
        {comp.badge && <Badge type={comp.badge} />}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-charcoal/60">
        {comp.description}
      </p>
    </button>
  );
}

function LayerCard({
  layer,
  expanded,
  onToggle,
  onSelectComponent,
}: {
  layer: Layer;
  expanded: boolean;
  onToggle: () => void;
  onSelectComponent: (comp: Component) => void;
}) {
  return (
    <div className={`rounded-lg border ${layer.accent} ${layer.bg} shadow-sm transition-shadow hover:shadow-md`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-5 w-5 flex-shrink-0 text-charcoal/50" />
        ) : (
          <ChevronRight className="h-5 w-5 flex-shrink-0 text-charcoal/50" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-serif text-lg font-semibold text-charcoal">
            {layer.title}
          </div>
          <div className="text-[12px] text-charcoal/60">{layer.subtitle}</div>
        </div>
        <span className="rounded-full bg-white/60 px-2.5 py-0.5 text-xs font-medium text-charcoal/50">
          {layer.components.length} components
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: expanded ? `${layer.components.length * 120 + 100}px` : "0" }}
      >
        <div className="border-t border-charcoal/10 px-5 pb-4 pt-3">
          <p className="mb-3 text-[12px] leading-relaxed text-charcoal/70">
            {layer.description}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {layer.components.map((comp) => (
              <ComponentCard
                key={comp.name}
                comp={comp}
                onClick={() => onSelectComponent(comp)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailModal({
  comp,
  onClose,
}: {
  comp: Component;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(45,45,45,0.35)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1.5 text-charcoal/50 hover:bg-cream hover:text-charcoal"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-2">
          <h3 className="font-serif text-lg font-semibold text-charcoal">{comp.name}</h3>
          {comp.badge && <Badge type={comp.badge} />}
        </div>

        <p className="mt-3 text-sm leading-relaxed text-charcoal/75">{comp.description}</p>

        {comp.path && (
          <div className="mt-4 rounded-md bg-charcoal/5 px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-charcoal/45">
              File path
            </div>
            <div className="mt-0.5 font-mono text-[12px] text-charcoal/75">{comp.path}</div>
          </div>
        )}

        {comp.example && (
          <div className="mt-3 rounded-md border border-teal-600/20 bg-teal-50/30 px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-teal-600">
              Example
            </div>
            <div className="mt-0.5 text-[12px] text-charcoal/70">{comp.example}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ArchitecturePage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedComp, setSelectedComp] = useState<Component | null>(null);

  return (
    <div className="min-h-screen bg-cream">
      {/* Header bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-charcoal/10 bg-white px-6 shadow-sm">
        <Link href="/" className="font-serif text-2xl font-bold tracking-wide text-charcoal">
          MACY&apos;S
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/story" className="rounded-full border border-teal-600/20 px-3 py-1 text-[11px] font-medium text-teal-600 hover:bg-teal-50">
            Story
          </Link>
          <Link href="/rag-compare" className="rounded-full border border-teal-600/20 px-3 py-1 text-[11px] font-medium text-teal-600 hover:bg-teal-50">
            RAG Demo
          </Link>
          <Link href="/evals" className="rounded-full border border-teal-600/20 px-3 py-1 text-[11px] font-medium text-teal-600 hover:bg-teal-50">
            Evals
          </Link>
          <span className="rounded-full border border-teal-600 bg-teal-50 px-3 py-1 text-[11px] font-semibold text-teal-700">
            Architecture
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Title */}
        <div className="mb-8 text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1">
            <Layers className="h-4 w-4 text-teal-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
              System Architecture
            </span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-charcoal">
            How Macy&apos;s AI Coworker is Built
          </h1>
          <p className="mt-2 text-sm text-charcoal/60">
            Click any layer to explore its components. Click a component for details.
          </p>
        </div>

        <div className="flex gap-6">
          {/* Main layers */}
          <div className="min-w-0 flex-1 space-y-3">
            {LAYERS.map((layer) => (
              <LayerCard
                key={layer.id}
                layer={layer}
                expanded={expandedId === layer.id}
                onToggle={() =>
                  setExpandedId((prev) => (prev === layer.id ? null : layer.id))
                }
                onSelectComponent={setSelectedComp}
              />
            ))}
          </div>

          {/* External services sidebar */}
          <aside className="hidden w-52 flex-shrink-0 lg:block">
            <div className="sticky top-20 rounded-lg border border-charcoal/10 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-charcoal/55">
                External Services
              </h3>
              <ul className="space-y-2.5">
                {EXTERNAL_SERVICES.map((svc) => (
                  <li key={svc.name} className="flex items-start gap-2">
                    <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0 text-charcoal/35" />
                    <div>
                      <div className="text-[11px] font-medium text-charcoal/80">{svc.name}</div>
                      <div className="text-xs text-charcoal/45">{svc.note}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Counts summary */}
            <div className="mt-3 rounded-lg border border-charcoal/10 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-charcoal/55">
                By the Numbers
              </h3>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between"><span className="text-charcoal/60">Skills (LLM)</span><span className="font-semibold text-teal-700">4</span></div>
                <div className="flex justify-between"><span className="text-charcoal/60">Automations</span><span className="font-semibold text-charcoal/80">7</span></div>
                <div className="flex justify-between"><span className="text-charcoal/60">MCP Tools</span><span className="font-semibold" style={{ color: "#4338CA" }}>3</span></div>
                <div className="flex justify-between"><span className="text-charcoal/60">RAG Documents</span><span className="font-semibold text-charcoal/80">12</span></div>
                <div className="flex justify-between"><span className="text-charcoal/60">Eval Tests</span><span className="font-semibold text-charcoal/80">67</span></div>
                <div className="flex justify-between"><span className="text-charcoal/60">Unit Tests</span><span className="font-semibold text-charcoal/80">270</span></div>
                <div className="flex justify-between"><span className="text-charcoal/60">Workflow Steps</span><span className="font-semibold text-charcoal/80">10</span></div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Detail modal */}
      {selectedComp && (
        <DetailModal comp={selectedComp} onClose={() => setSelectedComp(null)} />
      )}
    </div>
  );
}
