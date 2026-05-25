"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Shield, ChevronDown } from "lucide-react";

import { usePersonas } from "@/components/PersonaContext";
import { CountUp } from "@/components/motion";

const TEAM_ORDER = [
  "campaign-manager",
  "senior-designer",
  "marketing-analyst",
  "production-artist",
];

const CEO_IDS = ["ceo", "thales"];

const PERSONA_COLORS: Record<string, { bg: string; accent: string }> = {
  "campaign-manager": { bg: "#0B7B8A", accent: "#0EA5A0" },
  "senior-designer": { bg: "#B8860B", accent: "#D4A537" },
  "marketing-analyst": { bg: "#9B2C2C", accent: "#C84B4B" },
  "production-artist": { bg: "#5B8C5A", accent: "#87A96B" },
};

const STATS = [
  { value: 5, label: "LLM Skills" },
  { value: 6, label: "Automations" },
  { value: 2, label: "MCP Tools" },
  { value: 12, label: "RAG Docs" },
  { value: 2000, suffix: "", label: "SKUs" },
  { value: 50, suffix: "K", label: "Customers" },
];

export default function LandingPage() {
  const { personas, loading } = usePersonas();
  const [heroComplete, setHeroComplete] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0); // -1 left, 1 right
  const isAnimatingRef = useRef(false);

  const team = TEAM_ORDER
    .map((id) => personas.find((p) => p.id === id))
    .filter(Boolean) as typeof personas;

  const ceos = CEO_IDS
    .map((id) => personas.find((p) => p.id === id))
    .filter(Boolean) as typeof personas;

  useEffect(() => {
    const timer = setTimeout(() => setHeroComplete(true), 3200);
    return () => clearTimeout(timer);
  }, []);

  const navigate = useCallback((dir: "next" | "prev") => {
    if (isAnimatingRef.current || team.length === 0) return;
    isAnimatingRef.current = true;
    setDirection(dir === "next" ? 1 : -1);
    setActiveIndex((prev) =>
      dir === "next" ? (prev + 1) % team.length : (prev + team.length - 1) % team.length
    );
    setTimeout(() => { isAnimatingRef.current = false; }, 600);
  }, [team.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigate("prev");
      if (e.key === "ArrowRight") navigate("next");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  const active = team[activeIndex];
  const colors = active ? PERSONA_COLORS[active.id] ?? { bg: "#1a1a2e", accent: "#0B7B8A" } : { bg: "#1a1a2e", accent: "#0B7B8A" };

  // Slide variants for center persona
  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0, scale: 0.9 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0, scale: 0.9 }),
  };

  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      {/* Dark base — video shows through */}
      <div className="absolute inset-0 bg-[#0a0a12]" />

      {/* Video background */}
      <div className="absolute inset-0 z-[1]">
        <video autoPlay loop muted playsInline className="h-full w-full object-cover" style={{ opacity: heroComplete ? 0.25 : 0.18, transition: "opacity 1.5s ease" }}>
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/50" />
      </div>

      {/* Grain */}
      <div className="absolute inset-0 pointer-events-none z-[2]" style={{ opacity: 0.3, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='0.06'/%3E%3C/svg%3E")`, backgroundSize: "200px 200px" }} />

      <div className="relative z-[10] flex min-h-screen flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-6">

          {/* MACY'S title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="font-serif tracking-wider text-white text-center"
            style={{ fontSize: "clamp(48px, 10vw, 120px)", lineHeight: 0.9, fontWeight: 600 }}
          >
            MACY&apos;S
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="mt-4 text-center text-sm sm:text-lg tracking-[0.25em] uppercase text-white/70 font-medium"
          >
            AI-Powered Marketing Operations
          </motion.p>

          {/* Animated stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.8 }}
            className="mt-8 flex flex-wrap justify-center gap-5 sm:gap-8"
          >
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-serif text-2xl sm:text-3xl font-bold text-white">
                  <CountUp end={s.value} duration={2} suffix={s.suffix ?? ""} />
                </div>
                <div className="text-[10px] sm:text-xs uppercase tracking-wider text-white/50">{s.label}</div>
              </div>
            ))}
          </motion.div>

          {/* ===== PERSONA SECTION ===== */}
          <AnimatePresence>
            {heroComplete && team.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2 }}
                className="mt-10 sm:mt-14 w-full max-w-5xl"
              >

                {/* ── CEO DUO (always visible above carousel) ── */}
                {ceos.length > 0 && (
                  <div className="mb-10 flex flex-col items-center">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-1.5">
                      <Shield className="h-3.5 w-3.5 text-purple-300" />
                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-purple-200">Executive Leadership</span>
                    </div>
                    <div className="flex items-center justify-center gap-6 sm:gap-12">
                      {ceos.map((ceo) => (
                        <Link key={ceo.id} href={`/${ceo.id}`} className="group flex flex-col items-center">
                          <div
                            className="h-20 w-20 sm:h-28 sm:w-28 rounded-full overflow-hidden ring-[3px] ring-purple-400/60 ring-offset-[3px] ring-offset-transparent transition-all duration-500 group-hover:ring-purple-400 group-hover:ring-offset-[6px]"
                            style={{ boxShadow: "0 0 50px rgba(139,92,246,0.25), 0 0 100px rgba(139,92,246,0.1)" }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ceo.avatar} alt={ceo.name} className="h-full w-full object-cover" />
                          </div>
                          <h3 className="mt-2 font-serif text-base sm:text-xl font-semibold text-white">{ceo.name}</h3>
                          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] text-purple-200/50">{ceo.title}</p>
                          <span className="mt-1.5 text-[10px] text-white/30 transition-colors duration-200 group-hover:text-white/60">
                            Enter →
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Divider ── */}
                <div className="mb-8 flex items-center gap-4 px-8 sm:px-20">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-white/25">Operations Team</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                {/* ── TEAM CAROUSEL ── */}
                <div className="relative flex items-center justify-center" style={{ minHeight: "340px" }}>

                  {/* Left arrow */}
                  <button
                    type="button"
                    onClick={() => navigate("prev")}
                    className="absolute left-0 sm:left-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-white/60 transition-all duration-200 hover:scale-110 hover:border-white/40 hover:bg-white/10 hover:text-white cursor-pointer"
                  >
                    <ArrowLeft className="h-5 w-5" strokeWidth={2} />
                  </button>

                  {/* Center persona with slide animation */}
                  <div className="relative w-full flex justify-center overflow-hidden" style={{ minHeight: "340px" }}>
                    <AnimatePresence mode="wait" custom={direction}>
                      {active && (
                        <motion.div
                          key={active.id}
                          custom={direction}
                          variants={slideVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                          className="absolute inset-0 flex flex-col items-center"
                        >
                          <Link href={`/${active.id}`} className="flex flex-col items-center group">
                            <div
                              className="h-32 w-32 sm:h-44 sm:w-44 rounded-full overflow-hidden ring-4 ring-white/30 ring-offset-4 ring-offset-transparent transition-all duration-500 group-hover:ring-white/50 group-hover:ring-offset-8"
                              style={{
                                boxShadow: "0 0 60px rgba(255,255,255,0.1), 0 0 120px rgba(255,255,255,0.05)",
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={active.avatar} alt={active.name} className="h-full w-full object-cover" />
                            </div>

                            <h2 className="mt-4 font-serif text-3xl sm:text-5xl font-semibold text-white text-center">
                              {active.name}
                            </h2>
                            <p className="mt-1.5 text-xs sm:text-sm uppercase tracking-[0.2em] text-white/60">
                              {active.title}
                            </p>
                            <p className="mt-3 max-w-sm text-center text-xs sm:text-sm leading-relaxed text-white/45">
                              {active.tagline}
                            </p>
                            <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium text-white/80 transition-all duration-300 group-hover:border-white/50 group-hover:bg-white/10 group-hover:text-white">
                              Enter as {active.name} →
                            </span>
                          </Link>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Right arrow */}
                  <button
                    type="button"
                    onClick={() => navigate("next")}
                    className="absolute right-0 sm:right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-white/60 transition-all duration-200 hover:scale-110 hover:border-white/40 hover:bg-white/10 hover:text-white cursor-pointer"
                  >
                    <ArrowRight className="h-5 w-5" strokeWidth={2} />
                  </button>
                </div>

                {/* Dot indicators */}
                <div className="mt-4 flex items-center justify-center gap-2.5">
                  {team.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (!isAnimatingRef.current) {
                          setDirection(i > activeIndex ? 1 : -1);
                          setActiveIndex(i);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <div
                        className="rounded-full transition-all duration-500"
                        style={{
                          width: i === activeIndex ? "28px" : "8px",
                          height: "8px",
                          backgroundColor: i === activeIndex ? "white" : "rgba(255,255,255,0.25)",
                        }}
                      />
                    </button>
                  ))}
                </div>

              </motion.div>
            )}
          </AnimatePresence>

          {/* Scroll indicator */}
          {!heroComplete && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }} className="mt-12">
              <ChevronDown className="h-5 w-5 text-white/30 animate-bounce" />
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: heroComplete ? 1 : 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="relative z-[10] pb-6 pt-4"
        >
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 px-6">
            {[
              { label: "Story", href: "/story" },
              { label: "RAG Demo", href: "/rag-compare" },
              { label: "Evals", href: "/evals" },
              { label: "Evidence", href: "/evidence" },
              { label: "Impact", href: "/impact" },
              { label: "Docs", href: "/docs" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-white/10 px-3 py-1 text-[10px] sm:text-xs font-medium text-white/40 transition-all duration-200 hover:border-white/30 hover:bg-white/5 hover:text-white/70"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <p className="mt-3 text-center text-[10px] text-white/20">
            Built with Claude · TritonAI · Next.js · FastAPI · Merna Saad, Abdullah AlJarallah, Shankar D.
          </p>
        </motion.footer>
      </div>
    </div>
  );
}
