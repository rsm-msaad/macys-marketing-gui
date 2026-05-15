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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-charcoal/[0.06] bg-white/90 px-8 backdrop-blur-md">
      <Link
        href="/"
        className="font-display text-lg font-extrabold tracking-[0.1em] text-charcoal"
      >
        MACY&apos;S
      </Link>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 rounded-card border border-charcoal/[0.06] bg-white px-3 py-1.5 text-sm font-medium text-charcoal shadow-subtle transition-shadow hover:shadow-card"
        >
          {active ? (
            <>
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-offset-2"
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
                <span className="block text-[10px] uppercase tracking-wider text-stone">
                  {active.title}
                </span>
                <span className="block font-semibold text-charcoal">{active.name}</span>
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
                className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-cream ${
                  p.id === activePersonaId ? "bg-cream" : ""
                }`}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-offset-2"
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
                  <div className="text-sm font-semibold text-charcoal">{p.name}</div>
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
