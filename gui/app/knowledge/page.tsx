"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Search,
  X,
} from "lucide-react";

import { API_BASE } from "@/lib/api";
import { PageTransition } from "@/components/motion";

type KnowledgeDoc = {
  doc_id: string;
  title: string;
  owner: string;
  updated: string;
  category: string;
  description: string;
  used_by: string[];
  filename: string;
  word_count: number;
};

type DocDetail = KnowledgeDoc & { content: string };

const CATEGORY_STYLE: Record<string, { bg: string; text: string }> = {
  Policy: { bg: "bg-blue-100", text: "text-blue-700" },
  Guidelines: { bg: "bg-teal-100", text: "text-teal-700" },
  Reference: { bg: "bg-gray-100", text: "text-gray-600" },
  Retro: { bg: "bg-amber-100", text: "text-amber-700" },
  Ticket: { bg: "bg-violet-100", text: "text-violet-700" },
};

const CATEGORIES = ["All", "Policy", "Guidelines", "Reference", "Retro", "Ticket"];

function DocCard({ doc, onOpen }: { doc: KnowledgeDoc; onOpen: () => void }) {
  const style = CATEGORY_STYLE[doc.category] ?? CATEGORY_STYLE.Reference;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card-hover block w-full rounded-lg border border-charcoal/10 bg-white p-5 text-left transition-all hover:border-teal-300"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold uppercase ${style.bg} ${style.text}`}>
            {doc.category}
          </span>
          <h3 className="mt-2 text-[13px] font-semibold text-charcoal leading-tight">{doc.title}</h3>
          <div className="mt-0.5 font-mono text-xs text-charcoal/40">{doc.doc_id}</div>
        </div>
        <FileText className="h-4 w-4 flex-shrink-0 text-charcoal/25" />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-charcoal/60">{doc.description}</p>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {doc.used_by.map((skill) => (
            <span key={skill} className="rounded bg-teal-50 px-1.5 py-0.5 text-xs font-medium text-teal-600">
              {skill}
            </span>
          ))}
        </div>
        <span className="text-xs text-charcoal/35">{doc.word_count} words</span>
      </div>
      {doc.updated && (
        <div className="mt-2 text-xs text-charcoal/35">Updated {doc.updated}</div>
      )}
    </button>
  );
}

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedDoc, setSelectedDoc] = useState<DocDetail | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/knowledge`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { setDocs(data.docs); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function openDoc(docId: string) {
    setLoadingDoc(true);
    fetch(`${API_BASE}/knowledge/${encodeURIComponent(docId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { setSelectedDoc(data); setLoadingDoc(false); })
      .catch(() => setLoadingDoc(false));
  }

  const filtered = docs.filter((d) => {
    if (category !== "All" && d.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.title.toLowerCase().includes(q) || d.doc_id.toLowerCase().includes(q) || d.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <PageTransition className="min-h-screen bg-cream/30">
      <div className="border-b border-charcoal/10 bg-white px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-600 hover:text-teal-700 mb-2">
            <ArrowLeft className="h-3 w-3" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-teal-600" />
            <h1 className="font-serif text-2xl font-bold text-charcoal">Knowledge Base</h1>
          </div>
          <p className="mt-1 text-[13px] text-charcoal/60">
            The documents the AI uses to ground its decisions. Browse the same source material the team and AI share.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">
        {/* Search + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-charcoal/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, doc ID, or description..."
              className="w-full rounded-md border border-charcoal/15 bg-white py-2 pl-9 pr-3 text-[12px] text-charcoal placeholder:text-charcoal/30 focus:border-teal-500 focus:outline-none sm:w-80"
            />
          </div>
          <div className="flex gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  category === cat
                    ? "bg-teal-600 text-white"
                    : "border border-charcoal/15 bg-white text-charcoal/55 hover:bg-cream"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Doc grid */}
        {loading ? (
          <div className="py-12 text-center text-[12px] text-charcoal/40">Loading knowledge base...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-[12px] text-charcoal/40">
            No documents match &ldquo;{search}&rdquo;{category !== "All" ? ` in ${category}` : ""}.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((doc) => (
              <DocCard key={doc.doc_id} doc={doc} onOpen={() => openDoc(doc.doc_id)} />
            ))}
          </div>
        )}

        <div className="text-xs text-charcoal/35">
          {filtered.length} of {docs.length} documents shown.
          {docs.length} documents indexed in the HyQ FAISS vector store for semantic retrieval by AI skills.
        </div>
      </div>

      {/* Document viewer modal */}
      {(selectedDoc || loadingDoc) && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedDoc(null)} />
          <div className="fixed inset-x-4 inset-y-8 z-50 mx-auto max-w-3xl overflow-hidden rounded-lg border border-charcoal/10 bg-white shadow-xl animate-modal-in flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-charcoal/10 px-5 py-3">
              {selectedDoc ? (
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${(CATEGORY_STYLE[selectedDoc.category] ?? CATEGORY_STYLE.Reference).bg} ${(CATEGORY_STYLE[selectedDoc.category] ?? CATEGORY_STYLE.Reference).text}`}>
                      {selectedDoc.category}
                    </span>
                    <span className="font-mono text-xs text-charcoal/40">{selectedDoc.doc_id}</span>
                  </div>
                  <h2 className="mt-1 font-serif text-lg font-bold text-charcoal">{selectedDoc.title}</h2>
                </div>
              ) : (
                <span className="text-sm text-charcoal/50">Loading...</span>
              )}
              <button type="button" onClick={() => setSelectedDoc(null)} className="rounded p-1.5 text-charcoal/50 hover:bg-cream">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingDoc && !selectedDoc ? (
                <div className="py-12 text-center text-charcoal/40">Loading document...</div>
              ) : selectedDoc ? (
                <div className="prose prose-sm max-w-none text-charcoal/80 prose-headings:font-serif prose-headings:text-charcoal prose-a:text-teal-600 prose-strong:text-charcoal prose-code:text-teal-700 prose-code:bg-teal-50 prose-code:px-1 prose-code:rounded">
                  <div className="mb-4 flex items-center gap-3 text-xs text-charcoal/45">
                    {selectedDoc.owner && <span>Owner: {selectedDoc.owner}</span>}
                    {selectedDoc.updated && <span>Updated: {selectedDoc.updated}</span>}
                    <span>Used by: {selectedDoc.used_by.join(", ")}</span>
                  </div>
                  <div className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed">
                    {selectedDoc.content}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </PageTransition>
  );
}
