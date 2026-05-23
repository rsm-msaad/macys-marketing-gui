"use client";

import Link from "next/link";
import { Shield } from "lucide-react";

import { usePersonas } from "@/components/PersonaContext";

const OPERATIONAL_ORDER = [
  "campaign-manager",
  "senior-designer",
  "marketing-analyst",
  "production-artist",
];

const CEO_IDS = ["ceo", "thales"];

export default function LandingPage() {
  const { personas, loading, error } = usePersonas();

  const ceos = CEO_IDS
    .map((id) => personas.find((p) => p.id === id))
    .filter(Boolean) as typeof personas;
  const operational = OPERATIONAL_ORDER
    .map((id) => personas.find((p) => p.id === id))
    .filter(Boolean) as typeof personas;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-16">
      <header className="mb-12 text-center">
        <p className="font-serif text-xs font-semibold uppercase tracking-widest text-teal-600">
          MACY&apos;S MARKETING OPERATIONS
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-charcoal">
          Welcome to Marketing Operations
        </h1>
        <p className="mt-2 text-base text-charcoal/65">Select your role to begin.</p>
      </header>

      {loading && <p className="text-center text-sm text-charcoal/60">Loading personas...</p>}
      {error && (
        <div className="mx-auto max-w-md rounded-md border border-soft_red/30 bg-soft_red/5 p-4 text-sm text-soft_red">
          Could not reach the API at <code>http://localhost:8000</code>. Make sure the backend is running.
          <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
        </div>
      )}

      {/* Co-CEOs: side-by-side, equal sizing */}
      {ceos.length > 0 && (
        <>
          <div className="mb-3 flex items-center gap-4">
            <div className="h-px flex-1 bg-purple-200/50" />
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-purple-500">
              <Shield className="h-3 w-3" />
              Executive Leadership
            </span>
            <div className="h-px flex-1 bg-purple-200/50" />
          </div>
          <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {ceos.map((ceo) => (
              <Link
                key={ceo.id}
                href={`/${ceo.id}`}
                className="card-hover group flex flex-col rounded-xl border-2 border-purple-300/50 bg-white p-6 shadow-md transition-all hover:border-purple-400/70"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full ring-[3px] ring-purple-400 ring-offset-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ceo.avatar} alt={ceo.name} className="h-16 w-16 rounded-full object-cover" />
                  </span>
                  <div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-700">
                      <Shield className="h-2.5 w-2.5" /> Co-CEO
                    </span>
                    <div className="mt-1 font-serif text-2xl font-semibold text-charcoal">{ceo.name}</div>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-charcoal/70">{ceo.tagline}</p>
                <div className="mt-4 inline-flex items-center text-sm font-medium text-purple-600 group-hover:text-purple-700">
                  Continue as {ceo.name} →
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Divider */}
      {operational.length > 0 && (
        <div className="mb-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-charcoal/10" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/40">
            Operational Roles
          </span>
          <div className="h-px flex-1 bg-charcoal/10" />
        </div>
      )}

      {/* 2x2 grid of operational personas */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {operational.map((p) => (
          <Link
            key={p.id}
            href={`/${p.id}`}
            className="group flex flex-col rounded-lg border border-charcoal/10 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full ring-2 ring-offset-2"
                style={{ ["--tw-ring-color" as string]: p.color }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.avatar}
                  alt={p.name}
                  className="h-14 w-14 rounded-full object-cover"
                />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-charcoal/55">
                  {p.title}
                </div>
                <div className="font-serif text-2xl font-semibold text-charcoal">{p.name}</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-charcoal/70">{p.tagline}</p>
            <div className="mt-6 inline-flex items-center text-sm font-medium text-teal-600 group-hover:text-teal-700">
              Continue as {p.name} →
            </div>
          </Link>
        ))}
      </div>

      <footer className="mt-12 space-y-2 text-center text-xs text-charcoal/50">
        <p>4 skills, 7 automations, 12 RAG documents, live AI chat powered by TritonAI.</p>
        <p>
          <Link href="/story" className="text-teal-600 hover:text-teal-700">
            Watch the Story (75 slides)
          </Link>
          <span className="mx-2 text-charcoal/30">|</span>
          <Link href="/rag-compare" className="text-teal-600 hover:text-teal-700">
            RAG Comparison Demo
          </Link>
        </p>
      </footer>
    </main>
  );
}
