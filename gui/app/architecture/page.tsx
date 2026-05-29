"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Layers,
  Cpu,
  User,
  Zap,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & Data                                                       */
/* ------------------------------------------------------------------ */

type StepType = "human" | "ai" | "automation" | "human-ai";

type Pill = {
  label: string;
  kind: "rag" | "mcp" | "data";
};

type Step = {
  id: number;
  label: string;
  name: string;
  type: StepType;
  hasReview?: boolean;
  pills: Pill[];
  lane: "merch" | "creative" | "dist";
};

const STEPS: Step[] = [
  {
    id: 1,
    label: "1",
    name: "Briefing",
    type: "human-ai",
    pills: [],
    lane: "merch",
  },
  {
    id: 2,
    label: "2",
    name: "Segmentation",
    type: "automation",
    pills: [{ label: "50K customers", kind: "data" }],
    lane: "merch",
  },
  {
    id: 3,
    label: "3",
    name: "SKU Selection",
    type: "automation",
    pills: [
      { label: "check_pricing", kind: "mcp" },
      { label: "2K SKUs", kind: "data" },
    ],
    lane: "merch",
  },
  {
    id: 4,
    label: "4",
    name: "Creative Production",
    type: "automation",
    pills: [
      { label: "find_dam_assets", kind: "mcp" },
      { label: "5K DAM assets", kind: "data" },
    ],
    lane: "creative",
  },
  {
    id: 5,
    label: "5",
    name: "Layout Assembly",
    type: "ai",
    pills: [{ label: "Layout Copy Generator", kind: "mcp" }],
    lane: "creative",
  },
  {
    id: 6,
    label: "6a",
    name: "Compliance Pre-Check",
    type: "ai",
    hasReview: true,
    pills: [
      { label: "BRAND-GL", kind: "rag" },
      { label: "LEGAL-DIS", kind: "rag" },
      { label: "PRICE-RULES", kind: "rag" },
      { label: "COMP-EX", kind: "rag" },
      { label: "check_pricing", kind: "mcp" },
    ],
    lane: "creative",
  },
  {
    id: 7,
    label: "6b",
    name: "Approval Brief",
    type: "ai",
    hasReview: true,
    pills: [
      { label: "RETRO-Q4", kind: "rag" },
      { label: "RETRO-SP-BTY", kind: "rag" },
    ],
    lane: "creative",
  },
  {
    id: 8,
    label: "6c",
    name: "Revision Router",
    type: "ai",
    pills: [
      { label: "TICKET-INC-4471", kind: "rag" },
      { label: "TICKET-INC-0212", kind: "rag" },
    ],
    lane: "creative",
  },
  {
    id: 9,
    label: "7",
    name: "Localization",
    type: "automation",
    pills: [
      { label: "generate_locale_variants", kind: "mcp" },
      { label: "LOC-STYLE", kind: "rag" },
    ],
    lane: "creative",
  },
  {
    id: 10,
    label: "8",
    name: "Activation",
    type: "automation",
    pills: [],
    lane: "dist",
  },
  {
    id: 11,
    label: "9",
    name: "Monitoring",
    type: "automation",
    pills: [{ label: "Campaign KPIs", kind: "data" }],
    lane: "dist",
  },
  {
    id: 12,
    label: "10",
    name: "Reporting",
    type: "ai",
    pills: [{ label: "send_campaign_summary", kind: "mcp" }],
    lane: "dist",
  },
];

const TYPE_CONFIG: Record<
  StepType,
  { border: string; bg: string; label: string; icon: typeof Cpu }
> = {
  human: {
    border: "border-emerald-400",
    bg: "bg-emerald-400/10",
    label: "Human",
    icon: User,
  },
  ai: {
    border: "border-red-400",
    bg: "bg-red-400/10",
    label: "AI Skill",
    icon: Cpu,
  },
  automation: {
    border: "border-blue-400",
    bg: "bg-blue-400/10",
    label: "Automation",
    icon: Zap,
  },
  "human-ai": {
    border: "border-orange-400",
    bg: "bg-orange-400/10",
    label: "Human + AI",
    icon: User,
  },
};

const PILL_COLORS: Record<string, { bg: string; text: string }> = {
  rag: { bg: "bg-amber-500/20", text: "text-amber-300" },
  mcp: { bg: "bg-teal-500/20", text: "text-teal-300" },
  data: { bg: "bg-slate-500/20", text: "text-slate-300" },
};

/* Lane labels are rendered inline below */

/* ------------------------------------------------------------------ */
/*  Step Card Component                                                */
/* ------------------------------------------------------------------ */

function StepCard({ step, index }: { step: Step; index: number }) {
  const cfg = TYPE_CONFIG[step.type];
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.08, duration: 0.5, ease: "easeOut" }}
      className={`step-card relative rounded-xl border ${cfg.border} ${cfg.bg} backdrop-blur-md p-4 w-full`}
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
        boxShadow: `0 0 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      {/* Step number badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${cfg.border} border`}
            style={{ color: "white" }}
          >
            {step.label}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white leading-tight">
              {step.name}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {step.hasReview && (
            <span className="flex items-center gap-0.5 rounded-full bg-purple-500/20 border border-purple-400/40 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300">
              <ShieldCheck className="h-2.5 w-2.5" />
              Review
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full ${cfg.bg} border ${cfg.border} px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/80`}
          >
            <Icon className="h-2.5 w-2.5" />
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Pills */}
      {step.pills.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {step.pills.map((pill) => {
            const pc = PILL_COLORS[pill.kind];
            return (
              <span
                key={pill.label}
                className={`inline-flex items-center rounded-full ${pc.bg} ${pc.text} px-2 py-0.5 text-[9px] font-medium`}
              >
                {pill.kind === "rag" && "📄 "}
                {pill.kind === "mcp" && "🔧 "}
                {pill.kind === "data" && "💾 "}
                {pill.label}
              </span>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  SVG Connection Lines                                               */
/* ------------------------------------------------------------------ */

function ConnectionLines() {
  const [dims, setDims] = useState<{
    cards: DOMRect[];
    container: DOMRect;
  } | null>(null);
  useEffect(() => {
    const measure = () => {
      const container = document.getElementById("flow-container");
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const cards = Array.from(container.querySelectorAll(".step-card"));
      const rects = cards.map((c) => c.getBoundingClientRect());
      if (rects.length === STEPS.length) {
        setDims({ cards: rects, container: containerRect });
      }
    };

    const timer = setTimeout(measure, 800);
    window.addEventListener("resize", () => setTimeout(measure, 100));
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", () => setTimeout(measure, 100));
    };
  }, []);

  if (!dims || dims.cards.length < 2) return null;

  const ox = dims.container.left;
  const oy = dims.container.top;

  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  for (let i = 0; i < dims.cards.length - 1; i++) {
    const from = dims.cards[i];
    const to = dims.cards[i + 1];
    lines.push({
      x1: from.left - ox + from.width / 2,
      y1: from.top - oy + from.height,
      x2: to.left - ox + to.width / 2,
      y2: to.top - oy,
    });
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    >
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(45,212,191,0.6)" />
          <stop offset="100%" stopColor="rgba(45,212,191,0.15)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {lines.map((line, i) => {
        const midY = (line.y1 + line.y2) / 2;
        const path = `M ${line.x1} ${line.y1} C ${line.x1} ${midY}, ${line.x2} ${midY}, ${line.x2} ${line.y2}`;
        return (
          <g key={i}>
            {/* Glow line */}
            <path
              d={path}
              fill="none"
              stroke="rgba(45,212,191,0.15)"
              strokeWidth="4"
              filter="url(#glow)"
            />
            {/* Main line */}
            <path
              d={path}
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            {/* Animated dot */}
            <circle r="3" fill="#2dd4bf">
              <animateMotion
                dur={`${2 + i * 0.15}s`}
                repeatCount="indefinite"
                path={path}
              />
            </circle>
            <circle r="6" fill="rgba(45,212,191,0.2)">
              <animateMotion
                dur={`${2 + i * 0.15}s`}
                repeatCount="indefinite"
                path={path}
              />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function ArchitecturePage() {
  const [showLines, setShowLines] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowLines(true), 900);
    return () => clearTimeout(t);
  }, []);

  const merchSteps = STEPS.filter((s) => s.lane === "merch");
  const creativeSteps = STEPS.filter((s) => s.lane === "creative");
  const distSteps = STEPS.filter((s) => s.lane === "dist");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <div className="h-5 w-px bg-white/10" />
            <span className="font-serif text-lg font-bold tracking-widest text-white">
              MACY&apos;S
            </span>
          </div>
          <div className="flex items-center gap-2">
            {[
              { href: "/story", label: "Story" },
              { href: "/rag-compare", label: "RAG" },
              { href: "/evals", label: "Evals" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-medium text-white/50 hover:border-white/25 hover:text-white/80 transition-all"
              >
                {link.label}
              </Link>
            ))}
            <span className="rounded-full border border-teal-400/40 bg-teal-400/10 px-3 py-1 text-[11px] font-semibold text-teal-300">
              Architecture
            </span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-6 py-10">
        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/5 px-4 py-1.5">
            <Layers className="h-4 w-4 text-teal-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-teal-300">
              System Architecture
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            10-Step Campaign Workflow
          </h1>
          <p className="mt-3 text-base text-white/40 max-w-2xl mx-auto">
            How Macy&apos;s AI Coworker orchestrates merchandising, creative
            production, and distribution through skills, automations, and MCP
            tools.
          </p>
        </motion.div>

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-4 mb-10"
        >
          {[
            { color: "border-orange-400 bg-orange-400/10", label: "Human + AI" },
            { color: "border-blue-400 bg-blue-400/10", label: "Automation" },
            { color: "border-red-400 bg-red-400/10", label: "AI Skill" },
            { color: "border-emerald-400 bg-emerald-400/10", label: "Human Task" },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 rounded-full border ${item.color} px-3 py-1`}
            >
              <span className="text-[10px] font-medium text-white/70">
                {item.label}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-400/10 px-3 py-1">
            <ShieldCheck className="h-3 w-3 text-purple-300" />
            <span className="text-[10px] font-medium text-white/70">
              Has Human Review
            </span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          {[
            { emoji: "📄", label: "RAG Doc", cls: "text-amber-300 bg-amber-500/20" },
            { emoji: "🔧", label: "MCP Tool", cls: "text-teal-300 bg-teal-500/20" },
            { emoji: "💾", label: "Data Source", cls: "text-slate-300 bg-slate-500/20" },
          ].map((p) => (
            <span
              key={p.label}
              className={`inline-flex items-center gap-1 rounded-full ${p.cls} px-2 py-0.5 text-[10px] font-medium`}
            >
              {p.emoji} {p.label}
            </span>
          ))}
        </motion.div>

        {/* 3-Lane Layout */}
        <div id="flow-container" className="relative">
          {showLines && <ConnectionLines />}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Merchandising Lane */}
            <div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-4 text-center"
              >
                <h2 className="text-sm font-bold uppercase tracking-widest text-blue-400">
                  Merchandising
                </h2>
                <p className="text-[10px] text-white/30 mt-0.5">Steps 1 - 3</p>
              </motion.div>
              <div className="space-y-4">
                {merchSteps.map((step, i) => (
                  <StepCard key={step.id} step={step} index={i} />
                ))}
              </div>
            </div>

            {/* Creative Lane */}
            <div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-4 text-center"
              >
                <h2 className="text-sm font-bold uppercase tracking-widest text-purple-400">
                  Creative
                </h2>
                <p className="text-[10px] text-white/30 mt-0.5">Steps 4 - 7</p>
              </motion.div>
              <div className="space-y-4">
                {creativeSteps.map((step, i) => (
                  <StepCard key={step.id} step={step} index={i + 3} />
                ))}
              </div>
            </div>

            {/* Distribution Lane */}
            <div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mb-4 text-center"
              >
                <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-400">
                  Distribution
                </h2>
                <p className="text-[10px] text-white/30 mt-0.5">Steps 8 - 10</p>
              </motion.div>
              <div className="space-y-4">
                {distSteps.map((step, i) => (
                  <StepCard key={step.id} step={step} index={i + 9} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Flow Arrows Between Lanes (visible on md+) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="hidden md:flex items-center justify-center gap-2 mt-8 mb-2"
        >
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm px-6 py-2.5">
            <span className="text-xs font-semibold text-blue-400">Merchandising</span>
            <svg width="24" height="12" viewBox="0 0 24 12">
              <path d="M0 6 L18 6 M14 2 L18 6 L14 10" stroke="rgba(45,212,191,0.5)" strokeWidth="1.5" fill="none" />
              <circle r="2" fill="#2dd4bf">
                <animateMotion dur="1.5s" repeatCount="indefinite" path="M0 6 L18 6" />
              </circle>
            </svg>
            <span className="text-xs font-semibold text-purple-400">Creative</span>
            <svg width="24" height="12" viewBox="0 0 24 12">
              <path d="M0 6 L18 6 M14 2 L18 6 L14 10" stroke="rgba(45,212,191,0.5)" strokeWidth="1.5" fill="none" />
              <circle r="2" fill="#2dd4bf">
                <animateMotion dur="1.5s" repeatCount="indefinite" path="M0 6 L18 6" />
              </circle>
            </svg>
            <span className="text-xs font-semibold text-emerald-400">Distribution</span>
          </div>
        </motion.div>

        {/* Global animation styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes flowDown {
            0% { transform: translateY(-8px); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translateY(8px); opacity: 0; }
          }
          .flow-dot {
            animation: flowDown 1.5s ease-in-out infinite;
          }
        ` }} />

        {/* Summary Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6"
        >
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {[
              { value: "4", label: "AI Skills", color: "text-red-400" },
              { value: "7", label: "Automations", color: "text-blue-400" },
              { value: "3", label: "MCP Tools", color: "text-teal-400" },
              { value: "12", label: "RAG Documents", color: "text-amber-400" },
              { value: "57K+", label: "Data Records", color: "text-slate-300" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-white/40 mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs text-white/25">
              4 AI Skills &middot; 7 Automations &middot; 3 MCP Tools &middot;
              12 RAG Documents &middot; 57K+ Data Records
            </p>
          </div>
        </motion.div>

        {/* Within-lane connection lines */}
        <svg className="absolute inset-0 pointer-events-none hidden md:block" style={{ width: "100%", height: "100%", overflow: "visible" }}>
          <defs>
            <linearGradient id="laneLineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(45,212,191,0.4)" />
              <stop offset="100%" stopColor="rgba(45,212,191,0.05)" />
            </linearGradient>
          </defs>
        </svg>
      </main>
    </div>
  );
}
