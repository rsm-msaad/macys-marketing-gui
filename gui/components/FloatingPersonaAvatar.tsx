"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Home } from "lucide-react";

import { usePersona, usePersonas } from "@/components/PersonaContext";

const PERSONA_ROUTES: Record<string, string> = {
  "campaign-manager": "/campaign-manager",
  "senior-designer": "/senior-designer",
  "production-artist": "/production-artist",
  "marketing-analyst": "/marketing-analyst",
  ceo: "/ceo",
};

export function FloatingPersonaAvatar({ personaId }: { personaId: string }) {
  const { personas } = usePersonas();
  const active = usePersona(personaId);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!active) return null;

  const others = personas.filter((p) => p.id !== personaId);

  return (
    <div ref={ref} className="fixed right-5 top-5 z-40">
      {/* Avatar button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group relative h-11 w-11 overflow-hidden rounded-full border-2 border-white shadow-lg transition-transform hover:scale-105"
        style={{ boxShadow: `0 2px 12px ${active.color}40` }}
        title={`${active.name} (${active.title})`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active.avatar}
          alt={active.name}
          className="h-full w-full object-cover"
        />
        {/* Online dot */}
        <span
          className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white"
          style={{ backgroundColor: active.color }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-charcoal/10 bg-white shadow-xl">
          {/* Current persona header */}
          <div className="border-b border-charcoal/10 px-4 py-3">
            <div className="text-xs font-semibold text-charcoal">{active.name}</div>
            <div className="text-[11px] text-charcoal/50">{active.title}</div>
          </div>

          {/* Switch to other personas */}
          <div className="py-1">
            {others.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(PERSONA_ROUTES[p.id] ?? "/");
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-cream"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ring-1 ring-offset-1"
                  style={{ ["--tw-ring-color" as string]: p.color }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.avatar}
                    alt={p.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                </span>
                <div>
                  <div className="text-[12px] font-medium text-charcoal">{p.name}</div>
                  <div className="text-[10px] text-charcoal/50">{p.title}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Back to home */}
          <div className="border-t border-charcoal/10 py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/");
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[12px] text-charcoal/60 transition-colors hover:bg-cream hover:text-charcoal"
            >
              <Home className="h-4 w-4" />
              Back to home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
