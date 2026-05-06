"use client";

import Link from "next/link";

import { usePersonas } from "@/components/PersonaContext";

export default function LandingPage() {
  const { personas, loading, error } = usePersonas();

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

      {loading && <p className="text-center text-sm text-charcoal/60">Loading personas…</p>}
      {error && (
        <div className="mx-auto max-w-md rounded-md border border-soft_red/30 bg-soft_red/5 p-4 text-sm text-soft_red">
          Could not reach the API at <code>http://localhost:8000</code>. Make sure the backend is running.
          <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {personas.map((p) => (
          <Link
            key={p.id}
            href={`/${p.id}`}
            className="group flex flex-col rounded-lg border border-charcoal/10 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full text-2xl font-semibold text-white"
                style={{ backgroundColor: p.color }}
              >
                {p.initial}
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

      <footer className="mt-12 text-center text-xs text-charcoal/50">
        4 skills, 1 unified database, scripted Claude chat. Local demo · May 7.
      </footer>
    </main>
  );
}
