"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { fetchPersonas, type Persona } from "@/lib/api";
import { warmupAI } from "@/lib/ai_client";

type PersonaContextValue = {
  personas: Persona[];
  loading: boolean;
  error: string | null;
};

const Ctx = createContext<PersonaContextValue>({
  personas: [],
  loading: true,
  error: null,
});

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    warmupAI();
    let cancelled = false;
    fetchPersonas()
      .then((data) => {
        if (!cancelled) setPersonas(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ personas, loading, error }), [personas, loading, error]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePersonas() {
  return useContext(Ctx);
}

export function usePersona(personaId: string): Persona | undefined {
  const { personas } = usePersonas();
  return personas.find((p) => p.id === personaId);
}
