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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-charcoal/[0.06] bg-white/80 px-8 backdrop-blur-md">
      <Link
        href="/"
        className="font-display text-xl font-bold tracking-[0.08em] text-charcoal"
      >
        MACY&apos;S
      </Link>

      <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone">
          Campaign Studio
        </span>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 rounded-card border border-charcoal/[0.08] bg-white px-4 py-2 text-sm font-medium text-charcoal shadow-subtle transition-shadow hover:shadow-card"
        >
          {active ? (
            <>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-offset-2"
                style={{ ["--tw-ring-color" as string]: active.color }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={active.avatar}
                  alt={active.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              </span>
              <span className="text-left leading-tight">
                <span className="block text-[10px] uppercase tracking-wider text-stone">
                  {active.title}
                </span>
                <span className="block font-medium text-charcoal">{active.name}</span>
              </span>
            </>
          ) : (
            <span>Select persona</span>
          )}
          <ChevronDown className="h-4 w-4 text-stone" />
        </button>

        {open && (
          <div
            className="absolute right-0 mt-2 w-72 overflow-hidden rounded-card border border-charcoal/[0.06] bg-white shadow-elevated"
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
                className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-cream ${
                  p.id === activePersonaId ? "bg-cream" : ""
                }`}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-offset-2"
                  style={{ ["--tw-ring-color" as string]: p.color }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.avatar}
                    alt={p.name}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-medium text-charcoal">{p.name}</div>
                  <div className="text-[11px] text-stone">{p.title}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
