"use client";

import Link from "next/link";

import { usePersonas } from "@/components/PersonaContext";

export default function LandingPage() {
  const { personas, loading, error } = usePersonas();

  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-8 py-20">
      {/* Editorial header */}
      <header className="mb-16 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone">
          MACY&apos;S MARKETING OPERATIONS
        </p>
        <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight text-charcoal md:text-6xl">
          Campaign Studio
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-stone">
          Select your role to begin. Each persona owns specific steps
          in the 10 step campaign workflow.
        </p>
      </header>

      {loading && (
        <p className="text-center text-sm text-stone">Loading personas...</p>
      )}
      {error && (
        <div className="mx-auto max-w-md rounded-card border border-rose/30 bg-rose/5 p-5 text-sm text-rose">
          Could not reach the API. Make sure the backend is running.
          <pre className="mt-2 whitespace-pre-wrap text-xs text-stone">{error}</pre>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {personas.map((p, i) => (
          <Link
            key={p.id}
            href={`/${p.id}`}
            className="card-hover group relative flex flex-col rounded-panel border border-charcoal/[0.06] bg-white p-8 shadow-card animate-fade-up"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Accent line */}
            <div
              className="absolute left-0 top-0 h-full w-1 rounded-l-panel"
              style={{ backgroundColor: p.color }}
            />

            <div className="flex items-center gap-5">
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full ring-2 ring-offset-4 ring-offset-white"
                style={{ ["--tw-ring-color" as string]: p.color }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.avatar}
                  alt={p.name}
                  className="h-16 w-16 rounded-full object-cover"
                />
              </span>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone">
                  {p.title}
                </div>
                <div className="mt-1 font-display text-2xl font-semibold text-charcoal">
                  {p.name}
                </div>
              </div>
            </div>

            <p className="mt-6 text-sm leading-relaxed text-charcoal/65">
              {p.tagline}
            </p>

            <div className="mt-8 inline-flex items-center text-sm font-medium text-teal-600 transition-colors group-hover:text-teal-700">
              Continue as {p.name}
              <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      <footer className="mt-16 text-center">
        <p className="text-[11px] tracking-wider text-stone/60">
          3 skills &middot; 6 automations &middot; 12 RAG documents &middot; Live AI chat powered by TritonAI
        </p>
      </footer>
    </main>
  );
}
