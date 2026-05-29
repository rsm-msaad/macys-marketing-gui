"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  FlaskConical,
  Layers,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MetricCard({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof CheckCircle2;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5">
      <Icon className="h-5 w-5" style={{ color }} />
      <div className="mt-2 font-serif text-3xl font-bold text-charcoal">{value}</div>
      <div className="mt-1 text-xs text-charcoal/55">{label}</div>
    </div>
  );
}

/* ---- How it Works sidebar sections ---- */

const TEST_CATEGORIES = [
  { name: "Compliance Pre Check", count: 20, desc: "Verifies MAP violations, missing disclaimers, and off-brand copy are caught" },
  { name: "Approval Brief Generator", count: 14, desc: "Verifies 5-field structure, grounded ROI, and risk alignment" },
  { name: "Revision Router", count: 9, desc: "Verifies classification accuracy, owner assignment, and urgency" },
  { name: "RAG Comparison", count: 24, desc: "Naive vs HyQ on 8 test queries, retrieval quality metrics" },
];

const METRICS_USED = [
  { name: "GEval", desc: "Custom criteria with LLM judge" },
  { name: "AnswerRelevancyMetric", desc: "Did the output address the question" },
  { name: "FaithfulnessMetric", desc: "Is the output grounded in source documents" },
  { name: "ContextualRelevancyMetric", desc: "Did RAG retrieve the right chunks" },
];

const SAMPLE_TEST = `# Verifies compliance skill catches MAP violations
def test_catches_map_violation():
    campaign = {
        "discount_pct": 30,
        "skus": ["EL-002"],  # Estee Lauder, MAP floor 15%
        "tagline": "30% off everything"
    }
    findings = {
        "pricing_cross_check": {
            "status": "fail",
            "reason": "EL-002 MAP floor is 15%, discount is 30%"
        }
    }
    action = helpers.evaluate_recommended_action(findings)
    assert action == "revise"  # any fail = revise`;

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-4">
      <h3 className="mb-2 font-serif text-sm font-semibold text-charcoal">{title}</h3>
      {children}
    </div>
  );
}

function HowItWorksSidebar() {
  const [sampleOpen, setSampleOpen] = useState(false);

  return (
    <aside className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-teal-600">
        How it works
      </h2>

      {/* DeepEval */}
      <SidebarCard title="DeepEval">
        <p className="text-[12px] leading-relaxed text-charcoal/65">
          An open-source Python framework for testing LLM outputs. Works like pytest
          but supports LLM-as-judge grading for subjective outputs.
        </p>
        <a
          href="https://docs.deepeval.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-teal-600 hover:underline"
        >
          docs.deepeval.com <ExternalLink className="h-3 w-3" />
        </a>
      </SidebarCard>

      {/* Judge Model */}
      <SidebarCard title="Claude as Judge">
        <p className="text-[12px] leading-relaxed text-charcoal/65">
          We use Claude to grade Claude's outputs. The judge receives the input,
          the actual output, and a written rubric. Returns pass/fail with reasoning.
          LLM-as-judge correlates well with human grading on free-form outputs.
        </p>
      </SidebarCard>

      {/* Test Categories */}
      <SidebarCard title="Test Categories">
        <ul className="space-y-2">
          {TEST_CATEGORIES.map((cat) => (
            <li key={cat.name} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 min-w-[20px] items-center justify-center rounded bg-sage/15 text-xs font-bold text-sage">
                {cat.count}
              </span>
              <div>
                <div className="text-[12px] font-medium text-charcoal/80">{cat.name}</div>
                <div className="text-[11px] text-charcoal/50">{cat.desc}</div>
              </div>
            </li>
          ))}
        </ul>
      </SidebarCard>

      {/* Sample Test */}
      <SidebarCard title="Sample Test">
        <button
          type="button"
          onClick={() => setSampleOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 text-[11px] font-medium text-teal-600 hover:text-teal-700"
        >
          {sampleOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {sampleOpen ? "Hide example" : "Show example"}
        </button>
        {sampleOpen && (
          <pre className="mt-2 overflow-x-auto rounded-md bg-charcoal/5 p-3 text-xs leading-relaxed text-charcoal/75">
            <code>{SAMPLE_TEST}</code>
          </pre>
        )}
      </SidebarCard>

      {/* Metrics Used */}
      <SidebarCard title="Metrics Used">
        <ul className="space-y-1.5">
          {METRICS_USED.map((m) => (
            <li key={m.name}>
              <span className="font-mono text-[11px] font-medium text-charcoal/75">{m.name}</span>
              <span className="ml-1.5 text-[11px] text-charcoal/50">{m.desc}</span>
            </li>
          ))}
        </ul>
      </SidebarCard>

      {/* How to Run */}
      <SidebarCard title="Run Locally">
        <pre className="rounded-md bg-charcoal/5 px-3 py-2 text-[11px] text-charcoal/70">
          <code>uv run pytest evals/ -v</code>
        </pre>
        <p className="mt-1.5 text-[11px] text-charcoal/45">
          Takes 4 to 5 minutes. Results displayed on this page.
        </p>
      </SidebarCard>
    </aside>
  );
}

/* ---- Page ---- */

export default function EvalsPage() {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/evals/latest.md")
      .then((r) => {
        if (!r.ok) throw new Error("Report not found");
        return r.text();
      })
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-charcoal/50 hover:text-charcoal"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to App
      </Link>

      <header className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-teal-600">
          EVALUATION RESULTS
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-charcoal">
          DeepEval Test Suite
        </h1>
        <p className="mt-2 text-sm text-charcoal/60">
          67 tests across 3 LLM skills and naive vs HyQ RAG comparison.
          Claude via TritonAI available as the judge LLM.
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Left column: existing content */}
        <div className="min-w-0 flex-1">
          {/* Metric cards */}
          <div className="mb-8 grid grid-cols-3 gap-4">
            <MetricCard
              icon={CheckCircle2}
              value="67"
              label="Tests passing"
              color="#87A96B"
            />
            <MetricCard
              icon={Layers}
              value="3"
              label="Skills evaluated"
              color="#0B7B8A"
            />
            <MetricCard
              icon={Database}
              value="8/8"
              label="HyQ retrievals correct"
              color="#D4A537"
            />
          </div>

          {/* Report content */}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-charcoal/50">
              <FlaskConical className="h-4 w-4 animate-pulse" />
              Loading report...
            </div>
          )}

          {!loading && !report && (
            <div className="rounded-lg border border-charcoal/10 bg-white p-6 text-sm text-charcoal/60">
              <p>No eval report found at /evals/latest.md</p>
              <p className="mt-2">
                Generate one locally:{" "}
                <code className="rounded bg-cream px-2 py-0.5 text-xs">
                  uv run pytest evals/ -v
                </code>
              </p>
            </div>
          )}

          {report && (
            <div className="prose prose-sm max-w-none rounded-lg border border-charcoal/10 bg-white p-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {report}
              </ReactMarkdown>
            </div>
          )}

          <footer className="mt-8 text-center text-xs text-charcoal/40">
            Run locally: uv sync --group dev && uv run pytest evals/ -v
          </footer>
        </div>

        {/* Right column: How it Works */}
        <div className="w-full flex-shrink-0 lg:w-72 xl:w-80">
          <HowItWorksSidebar />
        </div>
      </div>
    </main>
  );
}
