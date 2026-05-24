"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { usePersona, usePersonas } from "@/components/PersonaContext";

export function TopBar({ activePersonaId }: { activePersonaId: string }) {
  const { personas } = usePersonas();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = usePersona(activePersonaId);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-charcoal/10 bg-white px-6 shadow-sm">
      <Link href="/" className="font-serif text-2xl font-bold tracking-wide text-charcoal">
        MACY&apos;S
      </Link>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 rounded-md border border-charcoal/15 bg-white px-3 py-1.5 text-sm font-medium text-charcoal hover:bg-cream"
        >
          {active ? (
            <>
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full ring-2"
                style={{ ["--tw-ring-color" as string]: active.color }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={active.avatar}
                  alt={active.name}
                  className="h-7 w-7 rounded-full object-cover"
                />
              </span>
              <span className="text-left leading-tight">
                <span className="block text-xs text-charcoal/60">{active.title}</span>
                <span className="block text-charcoal">{active.name}</span>
              </span>
            </>
          ) : (
            <span>Select persona</span>
          )}
          <ChevronDown className="h-4 w-4 text-charcoal/60" />
        </button>

        {open && (
          <div
            className="absolute right-0 mt-2 w-72 overflow-hidden rounded-md border border-charcoal/10 bg-white shadow-lg"
            onMouseLeave={() => setOpen(false)}
          >
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(`/${p.id}`);
                }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-cream ${
                  p.id === activePersonaId ? "bg-cream" : ""
                }`}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full ring-2"
                  style={{ ["--tw-ring-color" as string]: p.color }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.avatar}
                    alt={p.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-medium text-charcoal">{p.name}</div>
                  <div className="text-xs text-charcoal/60">{p.title}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/story"
          className="rounded-full border border-teal-600/20 px-3 py-1 text-[11px] font-medium text-teal-600 hover:bg-teal-50"
        >
          Story
        </Link>
        <Link
          href="/rag-compare"
          className="rounded-full border border-teal-600/20 px-3 py-1 text-[11px] font-medium text-teal-600 hover:bg-teal-50"
        >
          RAG Demo
        </Link>
        <Link
          href="/evals"
          className="rounded-full border border-teal-600/20 px-3 py-1 text-[11px] font-medium text-teal-600 hover:bg-teal-50"
        >
          Evals
        </Link>
        <Link
          href="/evidence"
          className="rounded-full border border-teal-600/20 px-3 py-1 text-[11px] font-medium text-teal-600 hover:bg-teal-50"
        >
          Evidence
        </Link>
        <Link
          href="/impact"
          className="rounded-full border border-teal-600/20 px-3 py-1 text-[11px] font-medium text-teal-600 hover:bg-teal-50"
        >
          Impact
        </Link>
        <Link
          href="/docs"
          className="rounded-full border border-teal-600/20 px-3 py-1 text-[11px] font-medium text-teal-600 hover:bg-teal-50"
        >
          Docs
        </Link>
      </div>
    </header>
  );
}
