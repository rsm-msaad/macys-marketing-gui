"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { usePersonas } from "@/components/PersonaContext";
import { fadeUp, springSmooth } from "@/lib/motion";

export default function LandingPage() {
  const { personas, loading, error } = usePersonas();

  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-8 py-20">
      <motion.header
        className="mb-16 text-center"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springSmooth, delay: 0.1 }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-stone">
          MACY&apos;S MARKETING OPERATIONS
        </p>
        <h1 className="mt-5 font-display text-6xl font-extrabold tracking-tight text-charcoal md:text-7xl">
          Campaign Studio
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-stone">
          Select your role to begin. Each persona owns specific steps
          in the 10 step campaign workflow.
        </p>
      </motion.header>

      {loading && (
        <p className="text-center text-sm text-stone">Loading personas...</p>
      )}
      {error && (
        <div className="mx-auto max-w-md rounded-card border border-rose/30 bg-rose/5 p-5 text-sm text-rose">
          Could not reach the API. Make sure the backend is running.
          <pre className="mt-2 whitespace-pre-wrap text-xs text-stone">{error}</pre>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {personas.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSmooth, delay: 0.2 + i * 0.1 }}
          >
            <Link
              href={`/${p.id}`}
              className="card-hover group relative flex flex-col rounded-panel bg-surface p-8 shadow-card"
            >
              <div className="flex items-center gap-5">
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full ring-2 ring-offset-4 ring-offset-surface"
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
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone">
                    {p.title}
                  </div>
                  <div className="mt-1 font-display text-2xl font-bold text-charcoal">
                    {p.name}
                  </div>
                </div>
              </div>

              <p className="mt-5 text-sm leading-relaxed text-stone">
                {p.tagline}
              </p>

              <div className="mt-6 inline-flex items-center text-sm font-semibold text-teal-600 transition-colors group-hover:text-teal-700">
                Continue as {p.name}
                <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <motion.footer
        className="mt-16 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <p className="text-[11px] font-medium tracking-wider text-stone/50">
          3 skills &middot; 6 automations &middot; 12 RAG documents &middot; Live AI chat
        </p>
      </motion.footer>
    </main>
  );
}
