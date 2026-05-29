"use client";

import { useState } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://macys-api-n6f3.onrender.com";

const EXAMPLE_QUERIES = [
  "What should I include in the campaign brief?",
  "How long should I hold a first markdown for?",
  "Who can approve a campaign with a new tagline?",
  "What disclaimer do I need for percent off claims?",
  "What are common reasons campaigns fail compliance?",
];

type NaiveResult = {
  doc_id: string;
  section: string;
  chunk_text: string;
  score: number;
};

type HyQResult = NaiveResult & {
  matched_via: "chunk" | "question";
  matched_question: string | null;
};

type CompareResponse = {
  query: string;
  naive_results: NaiveResult[];
  hyq_results: HyQResult[];
  naive_error: string | null;
  hyq_error: string | null;
};

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 60
      ? "bg-sage/15 text-sage"
      : pct >= 40
        ? "bg-mustard/15 text-mustard"
        : "bg-charcoal/10 text-charcoal/60";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {pct}%
    </span>
  );
}

function ResultCard({
  result,
  matchedVia,
  matchedQuestion,
}: {
  result: NaiveResult;
  matchedVia?: string;
  matchedQuestion?: string | null;
}) {
  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-600">
          {result.doc_id}
        </span>
        <ScoreBadge score={result.score} />
      </div>
      {result.section && (
        <div className="mt-1.5 text-[11px] text-charcoal/50">{result.section}</div>
      )}
      <div className="mt-2 prose prose-sm prose-charcoal/75 max-w-none text-sm leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {result.chunk_text}
        </ReactMarkdown>
      </div>
      {matchedVia === "question" && matchedQuestion && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md bg-mustard/10 px-3 py-2">
          <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0 text-mustard" />
          <span className="text-xs italic text-charcoal/65">
            Matched via question: &ldquo;{matchedQuestion}&rdquo;
          </span>
        </div>
      )}
    </div>
  );
}

export default function RagComparePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runCompare(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/rag/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${res.status}: ${text}`);
      }
      const data: CompareResponse = await res.json();
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <header className="mb-8 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-teal-600">
          RAG COMPARISON
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-charcoal">
          Naive RAG vs HyQ RAG
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-charcoal/60">
          Naive RAG embeds raw document chunks and matches them against your
          query. HyQ generates hypothetical questions per chunk, so the index
          contains both prose and intent phrased queries. This often improves
          recall when you ask a natural question.
        </p>
      </header>

      {/* Search */}
      <div className="mx-auto mb-6 max-w-2xl">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            runCompare(query);
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal/40" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about Macys marketing policies..."
              className="w-full rounded-md border border-charcoal/15 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-md bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Compare"}
          </button>
        </form>
      </div>

      {/* Example chips */}
      <div className="mx-auto mb-8 flex max-w-3xl flex-wrap justify-center gap-2">
        {EXAMPLE_QUERIES.map((eq) => (
          <button
            key={eq}
            type="button"
            onClick={() => runCompare(eq)}
            disabled={loading}
            className="rounded-full border border-charcoal/15 bg-cream px-3 py-1.5 text-[11px] text-charcoal/70 hover:border-teal-600 hover:text-teal-600 disabled:opacity-50"
          >
            {eq}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-auto mb-6 max-w-2xl rounded-md border border-soft_red/30 bg-soft_red/5 p-4 text-sm text-soft_red">
          {error}
        </div>
      )}

      {/* Results side by side */}
      {result && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Naive */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-charcoal">
              Naive RAG
              <span className="ml-2 text-xs font-normal text-charcoal/50">
                ({result.naive_results.length} results)
              </span>
            </h2>
            {result.naive_error && (
              <p className="mb-2 text-xs text-soft_red">{result.naive_error}</p>
            )}
            <div className="space-y-3">
              {result.naive_results.map((r, i) => (
                <ResultCard key={`naive-${i}`} result={r} />
              ))}
              {result.naive_results.length === 0 && !result.naive_error && (
                <p className="text-xs text-charcoal/45 italic">No results above threshold</p>
              )}
            </div>
          </div>

          {/* HyQ */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-charcoal">
              HyQ RAG
              <span className="ml-2 text-xs font-normal text-charcoal/50">
                ({result.hyq_results.length} results)
              </span>
            </h2>
            {result.hyq_error && (
              <p className="mb-2 text-xs text-mustard">{result.hyq_error}</p>
            )}
            <div className="space-y-3">
              {result.hyq_results.map((r, i) => (
                <ResultCard
                  key={`hyq-${i}`}
                  result={r}
                  matchedVia={r.matched_via}
                  matchedQuestion={r.matched_question}
                />
              ))}
              {result.hyq_results.length === 0 && !result.hyq_error && (
                <p className="text-xs text-charcoal/45 italic">No results above threshold</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
