"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  Layers,
  MessageSquare,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";

import { fetchEvidence } from "@/lib/api";
import {
  getStepEvidence,
  RAG_DOC_META,
  type RagDocEvidence,
  type StepEvidence,
} from "@/lib/evidence";

/* ---- Relevance indicator ---- */

function RelevanceDots({ level }: { level: "high" | "medium" | "low" }) {
  const count = level === "high" ? 3 : level === "medium" ? 2 : 1;
  const color = level === "high" ? "bg-sage" : level === "medium" ? "bg-mustard" : "bg-soft_red";
  return (
    <span className="inline-flex items-center gap-0.5" title={`${level} relevance`}>
      {Array.from({ length: 3 }).map((_, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < count ? color : "bg-charcoal/15"}`} />
      ))}
    </span>
  );
}

/* ---- Status badge ---- */

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "success" ? "bg-sage/15 text-sage" :
    status === "failure" ? "bg-soft_red/15 text-soft_red" :
    "bg-mustard/15 text-mustard";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}

/* ---- Section wrapper ---- */

function Section({ icon: Icon, title, count, children }: {
  icon: typeof FileText;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white">
      <div className="flex items-center gap-2 border-b border-charcoal/10 px-5 py-3">
        <Icon className="h-4 w-4 text-teal-600" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">{title}</h3>
        {count !== undefined && (
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">{count}</span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ---- Document viewer modal ---- */

function DocumentViewer({ doc, onClose }: { doc: RagDocEvidence; onClose: () => void }) {
  const meta = RAG_DOC_META[doc.doc_id];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(45,45,45,0.4)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-charcoal/10 px-5 py-4">
          <div>
            <div className="font-mono text-[11px] text-teal-600">{doc.doc_id}</div>
            <h3 className="font-serif text-lg font-semibold text-charcoal">{meta?.title ?? doc.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1.5 text-charcoal/50 hover:bg-cream hover:text-charcoal">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <div className="mb-3 text-xs text-charcoal/50">{meta?.description}</div>
          <div className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">
            Section: {doc.section}
          </div>
          <div className="rounded-md border-l-4 border-teal-400 bg-teal-50/30 px-4 py-3 text-sm leading-relaxed text-charcoal/80">
            {doc.passage}
          </div>
          <p className="mt-4 text-[11px] italic text-charcoal/40">
            This passage was retrieved by the FAISS vector index and used as context for the AI skill.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---- Step selector tabs ---- */

const STEPS = [
  { id: "6a", label: "Compliance Pre Check", icon: ShieldCheck },
  { id: "6b", label: "Approval Brief", icon: FileText },
  { id: "6c", label: "Revision Router", icon: MessageSquare },
];

/* ---- Page ---- */

function EvidenceContent() {
  const searchParams = useSearchParams();
  const initialStep = searchParams.get("step") ?? "6a";
  const campaignId = searchParams.get("campaign") ?? "MDC-2026-MD-001";
  const [activeStep, setActiveStep] = useState(initialStep);
  const [viewDoc, setViewDoc] = useState<RagDocEvidence | null>(null);
  const [liveEvidence, setLiveEvidence] = useState<Record<string, unknown> | null>(null);
  const [isLive, setIsLive] = useState(false);

  // Try to fetch live captured evidence from the API
  useEffect(() => {
    fetchEvidence(campaignId, activeStep).then((ev) => {
      if (ev) {
        setLiveEvidence(ev);
        setIsLive(true);
      } else {
        setLiveEvidence(null);
        setIsLive(false);
      }
    });
  }, [campaignId, activeStep]);

  // Use static fallback if no live evidence
  const evidence = getStepEvidence(activeStep);

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="border-b border-charcoal/10 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/campaign-manager" className="inline-flex items-center gap-1.5 text-sm text-charcoal/50 hover:text-charcoal">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Workflow
          </Link>
          <Link href="/" className="font-serif text-xl font-bold tracking-wide text-charcoal">MACY&apos;S</Link>
          <div className="w-20" />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Title */}
        <div className="mb-6">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1">
            <BookOpen className="h-4 w-4 text-teal-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">Evidence Inspector</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-charcoal">What the AI Used to Decide</h1>
          <p className="mt-1 text-sm text-charcoal/55">
            Inspect the RAG documents, MCP tool calls, data sources, and assumptions behind each AI output.
          </p>
          {isLive ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sage/15 px-2.5 py-0.5 text-[10px] font-medium text-sage">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              Live evidence captured from this campaign
            </div>
          ) : (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-medium text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Showing example evidence. Run the AI workflow to capture live data.
            </div>
          )}
        </div>

        {/* Step tabs */}
        <div className="mb-6 flex gap-2">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveStep(s.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                activeStep === s.id
                  ? "bg-teal-600 text-white"
                  : "border border-charcoal/15 bg-white text-charcoal/65 hover:border-charcoal/30"
              }`}
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          ))}
        </div>

        {!evidence ? (
          <p className="text-sm text-charcoal/50">No evidence data for this step.</p>
        ) : (
          <div className="space-y-4">
            {/* Step header */}
            <div className="rounded-lg border border-charcoal/10 bg-white px-5 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">Step {evidence.step}</span>
                  <h2 className="font-serif text-lg font-semibold text-charcoal">{evidence.step_name}</h2>
                </div>
                <div className="text-right text-[11px] text-charcoal/50">
                  <div>Skill: <span className="font-mono text-charcoal/70">{evidence.skill_name}</span></div>
                  <div>Triggered by: {evidence.triggered_by}</div>
                </div>
              </div>
            </div>

            {/* Section 1: RAG Documents */}
            <Section icon={FileText} title="RAG Documents Retrieved" count={evidence.rag_docs.length}>
              {evidence.rag_docs.length === 0 ? (
                <p className="text-sm text-charcoal/45 italic">No RAG documents were queried for this skill.</p>
              ) : (
                <div className="space-y-3">
                  {evidence.rag_docs.map((doc) => (
                    <div key={doc.doc_id} className="rounded-md border border-charcoal/10 bg-cream/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-medium text-teal-700">{doc.doc_id}</span>
                            <RelevanceDots level={doc.relevance} />
                          </div>
                          <div className="mt-0.5 text-sm font-semibold text-charcoal">{doc.title}</div>
                          <div className="text-[11px] text-charcoal/50">Section: {doc.section}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewDoc(doc)}
                          className="flex-shrink-0 rounded-md border border-teal-600/20 px-2.5 py-1 text-[10px] font-medium text-teal-600 hover:bg-teal-50"
                        >
                          View document
                        </button>
                      </div>
                      <div className="mt-2 rounded border border-charcoal/5 bg-white px-3 py-2 text-[12px] leading-relaxed text-charcoal/65">
                        &ldquo;{doc.passage.slice(0, 200)}{doc.passage.length > 200 ? "..." : ""}&rdquo;
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Section 2: MCP Tools */}
            <Section icon={Wrench} title="MCP Tools Called" count={evidence.mcp_tools.length}>
              {evidence.mcp_tools.length === 0 ? (
                <p className="text-sm text-charcoal/45 italic">No MCP tools were called for this skill.</p>
              ) : (
                <div className="space-y-3">
                  {evidence.mcp_tools.map((tool) => (
                    <div key={tool.tool_name} className="rounded-md border border-charcoal/10 bg-cream/30 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-semibold text-charcoal">{tool.tool_name}</span>
                        <StatusBadge status={tool.status} />
                      </div>
                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">Input</div>
                          <pre className="overflow-x-auto rounded bg-charcoal/5 p-2 text-[11px] text-charcoal/70">
                            {JSON.stringify(tool.inputs, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">Output</div>
                          <div className="rounded bg-charcoal/5 p-2 text-[11px] text-charcoal/70">{tool.output_summary}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Section 3: Data Sources */}
            <Section icon={Database} title="Data Sources" count={evidence.data_sources.length}>
              {evidence.data_sources.length === 0 ? (
                <p className="text-sm text-charcoal/45 italic">No external data sources were accessed.</p>
              ) : (
                <div className="space-y-2">
                  {evidence.data_sources.map((ds) => (
                    <div key={ds.name} className="flex items-start gap-3 rounded-md border border-charcoal/5 bg-cream/20 px-4 py-3">
                      <Database className="mt-0.5 h-4 w-4 flex-shrink-0 text-charcoal/35" />
                      <div>
                        <div className="text-sm font-medium text-charcoal">{ds.name}</div>
                        <div className="text-[12px] text-charcoal/60">{ds.description}</div>
                        {ds.rows && <div className="mt-0.5 text-[10px] text-charcoal/40">Scale: {ds.rows}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Section 4: Prior Step Outputs */}
            <Section icon={Layers} title="Prior Step Outputs Referenced" count={evidence.prior_outputs.length}>
              {evidence.prior_outputs.length === 0 ? (
                <p className="text-sm text-charcoal/45 italic">This is the first AI step. No prior outputs were referenced.</p>
              ) : (
                <div className="space-y-2">
                  {evidence.prior_outputs.map((po) => (
                    <div key={po.field} className="flex items-start gap-3 rounded-md border border-charcoal/5 bg-cream/20 px-4 py-3">
                      <Layers className="mt-0.5 h-4 w-4 flex-shrink-0 text-charcoal/35" />
                      <div>
                        <div className="text-sm font-medium text-charcoal">Step {po.step}: {po.step_name}</div>
                        <div className="text-[12px] text-charcoal/60">{po.summary}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-charcoal/40">Field: {po.field}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Section 5: Assumptions */}
            <Section icon={MessageSquare} title="Assumptions and Limitations" count={evidence.assumptions.length}>
              <ul className="space-y-1.5">
                {evidence.assumptions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-charcoal/70">
                    <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-charcoal/30" />
                    {a}
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        )}
      </div>

      {/* Document viewer modal */}
      {viewDoc && <DocumentViewer doc={viewDoc} onClose={() => setViewDoc(null)} />}
    </div>
  );
}

export default function EvidencePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-cream text-charcoal/50">Loading evidence...</div>}>
      <EvidenceContent />
    </Suspense>
  );
}
