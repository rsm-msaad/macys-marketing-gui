"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Bot,
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  FileText,
  Layers,
  MessageSquare,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import { fetchEvidence } from "@/lib/api";
import {
  getStepEvidence,
  RAG_DOC_META,
  type RagDocEvidence,
  type StepEvidence,
} from "@/lib/evidence";

/* ---- Shared sub-components ---- */

function RelevanceDots({ level }: { level: string }) {
  const count = level === "high" ? 3 : level === "medium" ? 2 : 1;
  const color = level === "high" ? "bg-sage" : level === "medium" ? "bg-mustard" : "bg-soft_red";
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < count ? color : "bg-charcoal/15"}`} />
      ))}
    </span>
  );
}

function MiniSection({ icon: Icon, title, count, children }: {
  icon: typeof FileText;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-charcoal/5 pb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-2 text-left"
      >
        <Icon className="h-3.5 w-3.5 text-teal-600" />
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal/55">{title}</span>
        {count !== undefined && (
          <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold text-teal-700">{count}</span>
        )}
        {open ? <ChevronDown className="h-3 w-3 text-charcoal/30" /> : <ChevronRight className="h-3 w-3 text-charcoal/30" />}
      </button>
      {open && <div className="pl-5">{children}</div>}
    </div>
  );
}

/* ---- Side panel ---- */

export function EvidenceSidePanel({
  stepId,
  campaignId = "MDC-2026-MD-001",
  open,
  onClose,
}: {
  stepId: string;
  campaignId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [liveEvidence, setLiveEvidence] = useState<Record<string, unknown> | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetchEvidence(campaignId, stepId).then((ev) => {
      setLiveEvidence(ev);
      setIsLive(!!ev);
    });
  }, [open, campaignId, stepId]);

  // ESC key closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const staticEvidence = getStepEvidence(stepId);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-charcoal/10 bg-white shadow-2xl transition-transform duration-300 sm:w-[480px] lg:w-[520px]"
        role="dialog"
        aria-label="Evidence panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-charcoal/10 px-5 py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-teal-600" />
            <span className="text-xs font-semibold text-charcoal">Evidence: {staticEvidence?.step_name ?? stepId}</span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1.5 text-charcoal/50 hover:bg-cream hover:text-charcoal">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live / static indicator */}
        <div className="border-b border-charcoal/5 px-5 py-2">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-sage">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" /> Live evidence captured
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Example evidence (run AI to capture live)
            </span>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {staticEvidence ? (
            <div className="space-y-1">
              {/* RAG Documents */}
              <MiniSection icon={FileText} title="RAG Documents" count={staticEvidence.rag_docs.length}>
                {staticEvidence.rag_docs.length === 0 ? (
                  <p className="text-[11px] italic text-charcoal/40">No RAG docs queried.</p>
                ) : (
                  <div className="space-y-2">
                    {staticEvidence.rag_docs.map((doc) => {
                      const meta = RAG_DOC_META[doc.doc_id];
                      const isExpanded = expandedDoc === doc.doc_id;
                      return (
                        <div key={doc.doc_id} className="rounded border border-charcoal/8 bg-cream/20 p-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-teal-700">{doc.doc_id}</span>
                            <RelevanceDots level={doc.relevance} />
                          </div>
                          <div className="mt-0.5 text-[11px] font-medium text-charcoal/80">{meta?.title ?? doc.title}</div>
                          <button
                            type="button"
                            onClick={() => setExpandedDoc(isExpanded ? null : doc.doc_id)}
                            className="mt-1 text-[10px] font-medium text-teal-600 hover:text-teal-700"
                          >
                            {isExpanded ? "Hide passage" : "Show passage"}
                          </button>
                          {isExpanded && (
                            <div className="mt-1.5 rounded border-l-2 border-teal-400 bg-teal-50/30 px-2.5 py-2 text-[11px] leading-relaxed text-charcoal/65">
                              {doc.passage}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </MiniSection>

              {/* MCP Tools */}
              <MiniSection icon={Wrench} title="MCP Tools" count={staticEvidence.mcp_tools.length}>
                {staticEvidence.mcp_tools.length === 0 ? (
                  <p className="text-[11px] italic text-charcoal/40">No MCP tools called.</p>
                ) : (
                  <div className="space-y-2">
                    {staticEvidence.mcp_tools.map((t) => (
                      <div key={t.tool_name} className="rounded border border-charcoal/8 bg-cream/20 p-2.5">
                        <div className="font-mono text-[11px] font-medium text-charcoal">{t.tool_name}</div>
                        <div className="mt-0.5 text-[10px] text-charcoal/50">{t.output_summary}</div>
                      </div>
                    ))}
                  </div>
                )}
              </MiniSection>

              {/* Data Sources */}
              <MiniSection icon={Database} title="Data Sources" count={staticEvidence.data_sources.length}>
                {staticEvidence.data_sources.map((ds) => (
                  <div key={ds.name} className="mb-1 text-[11px] text-charcoal/65">
                    <span className="font-medium text-charcoal/80">{ds.name}</span>: {ds.description}
                  </div>
                ))}
              </MiniSection>

              {/* Prior Outputs */}
              <MiniSection icon={Layers} title="Prior Outputs" count={staticEvidence.prior_outputs.length}>
                {staticEvidence.prior_outputs.length === 0 ? (
                  <p className="text-[11px] italic text-charcoal/40">First AI step, no prior outputs.</p>
                ) : (
                  staticEvidence.prior_outputs.map((po) => (
                    <div key={po.field} className="mb-1 text-[11px] text-charcoal/65">
                      <span className="font-medium text-charcoal/80">Step {po.step}: {po.step_name}</span> ({po.field})
                    </div>
                  ))
                )}
              </MiniSection>

              {/* Assumptions */}
              <MiniSection icon={MessageSquare} title="Assumptions" count={staticEvidence.assumptions.length}>
                <ul className="space-y-0.5">
                  {staticEvidence.assumptions.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-charcoal/60">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-charcoal/25" />
                      {a}
                    </li>
                  ))}
                </ul>
              </MiniSection>

              {/* Agentic Trace (from live evidence) */}
              {liveEvidence && Array.isArray((liveEvidence as Record<string, unknown>)?.agentic_trace) && (() => {
                const trace = (liveEvidence as Record<string, unknown>).agentic_trace as Array<Record<string, unknown>>;
                const toolCalls = trace.filter((t) => t.type === "tool_call");
                if (toolCalls.length === 0) return null;
                return (
                  <MiniSection icon={Bot} title="Agentic Trace — Claude's Tool Calls" count={toolCalls.length}>
                    <div className="space-y-3">
                      {trace.map((entry, i) => {
                        if (entry.type === "tool_call") {
                          const reasoning = entry.reasoning_before as string | undefined;
                          return (
                            <div key={i} className="rounded border border-teal-200/50 bg-teal-50/20 p-2.5">
                              {/* Claude's reasoning before the call */}
                              {reasoning && reasoning.length > 0 && (
                                <div className="mb-2 rounded border-l-2 border-violet-300 bg-violet-50/30 px-2.5 py-1.5">
                                  <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-500">
                                    Claude&apos;s reasoning
                                  </div>
                                  <div className="text-[11px] leading-relaxed text-charcoal/65 italic">
                                    {(reasoning as string).slice(0, 300)}{(reasoning as string).length > 300 ? "..." : ""}
                                  </div>
                                </div>
                              )}
                              {/* Tool call */}
                              <div className="flex items-center gap-1.5">
                                <Zap className="h-3 w-3 text-teal-600" />
                                <span className="font-mono text-[11px] font-semibold text-teal-700">
                                  {entry.tool_name as string}
                                </span>
                                <span className="text-[9px] text-charcoal/40">
                                  iteration {entry.iteration as number}
                                </span>
                              </div>
                              <div className="mt-1 text-[10px] text-charcoal/50">
                                Input: {JSON.stringify(entry.tool_input).slice(0, 120)}
                              </div>
                              <div className="mt-0.5 text-[10px] text-charcoal/50">
                                Output: {JSON.stringify(entry.tool_output).slice(0, 150)}
                              </div>
                            </div>
                          );
                        }
                        if (entry.type === "final_response" && entry.reasoning) {
                          return (
                            <div key={i} className="rounded border border-charcoal/10 bg-cream/30 p-2.5">
                              <div className="text-[9px] font-semibold uppercase tracking-wider text-charcoal/40">
                                Claude&apos;s final analysis
                              </div>
                              <div className="mt-0.5 text-[11px] text-charcoal/60 italic">
                                {(entry.reasoning as string).slice(0, 200)}...
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </MiniSection>
                );
              })()}
            </div>
          ) : (
            <p className="text-sm text-charcoal/45 italic">No evidence data for this step.</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-charcoal/10 px-5 py-3">
          <Link
            href={`/evidence?step=${stepId}&campaign=${campaignId}`}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-600 hover:text-teal-700"
          >
            Open full evidence view
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </aside>
    </>
  );
}
