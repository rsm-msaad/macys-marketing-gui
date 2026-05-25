"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Shield, ChevronDown } from "lucide-react";

import { usePersonas } from "@/components/PersonaContext";

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

const CEO_BG = "#2D1B69";

const STATS = [
  { value: "5", label: "LLM Skills" },
  { value: "6", label: "Automations" },
  { value: "2", label: "MCP Tools" },
  { value: "12", label: "RAG Docs" },
  { value: "2K", label: "SKUs" },
  { value: "50K", label: "Customers" },
];

export default function LandingPage() {
  const { personas, loading } = usePersonas();
  const [heroComplete, setHeroComplete] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showCeos, setShowCeos] = useState(false);
  const isAnimatingRef = useRef(false);

  const team = TEAM_ORDER
    .map((id) => personas.find((p) => p.id === id))
    .filter(Boolean) as typeof personas;

  const ceos = CEO_IDS
    .map((id) => personas.find((p) => p.id === id))
    .filter(Boolean) as typeof personas;

  // Hero entrance timing
  useEffect(() => {
    const timer = setTimeout(() => setHeroComplete(true), 3200);
    return () => clearTimeout(timer);
  }, []);

  const navigate = useCallback((dir: "next" | "prev") => {
    if (isAnimatingRef.current || team.length === 0) return;
    isAnimatingRef.current = true;
    setShowCeos(false);
    setActiveIndex((prev) =>
      dir === "next" ? (prev + 1) % team.length : (prev + team.length - 1) % team.length
    );
    setTimeout(() => { isAnimatingRef.current = false; }, 700);
  }, [team.length]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigate("prev");
      if (e.key === "ArrowRight") navigate("next");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  // Auto-rotate every 5 seconds (team only, not when CEOs are shown)
  useEffect(() => {
    if (!heroComplete || team.length === 0 || showCeos) return;
    const id = setInterval(() => navigate("next"), 5000);
    return () => clearInterval(id);
  }, [heroComplete, navigate, team.length, showCeos]);

  const active = team[activeIndex];
  const colors = active ? PERSONA_COLORS[active.id] ?? { bg: "#1a1a2e", accent: "#0B7B8A" } : { bg: "#1a1a2e", accent: "#0B7B8A" };

  const leftIdx = team.length > 0 ? (activeIndex + team.length - 1) % team.length : 0;
  const rightIdx = team.length > 0 ? (activeIndex + 1) % team.length : 0;
  const leftPersona = team[leftIdx];
  const rightPersona = team[rightIdx];

  const currentBg = showCeos ? CEO_BG : colors.bg;

  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      {/* Animated background color */}
      <motion.div
        className="absolute inset-0"
        animate={{ backgroundColor: heroComplete ? currentBg : "#0a0a12" }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      />

      {/* Video background */}
      <div className="absolute inset-0 z-[1]">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
          style={{
            opacity: heroComplete ? 0.08 : 0.15,
            transition: "opacity 1.5s ease",
          }}
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      </div>

      {/* Grain texture */}
      <div
        className="absolute inset-0 pointer-events-none z-[2]"
        style={{
          opacity: 0.3,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='0.06'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      {/* Content */}
      <div className="relative z-[10] flex min-h-screen flex-col">

        {/* ===== PHASE 1: Cinematic Hero Entrance ===== */}
        <div className="flex flex-1 flex-col items-center justify-center px-6">

          {/* MACY'S title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-center"
          >
            <h1
              className="font-serif tracking-wider text-white"
              style={{ fontSize: "clamp(48px, 10vw, 120px)", lineHeight: 0.9, fontWeight: 600 }}
            >
              MACY&apos;S
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="mt-4 text-center text-sm sm:text-lg tracking-[0.25em] uppercase text-white/70"
            style={{ fontWeight: 500 }}
          >
            AI-Powered Marketing Operations
          </motion.p>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.8 }}
            className="mt-8 flex flex-wrap justify-center gap-4 sm:gap-6"
          >
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-serif text-2xl sm:text-3xl font-bold text-white">{s.value}</div>
                <div className="text-[10px] sm:text-xs uppercase tracking-wider text-white/50">{s.label}</div>
              </div>
            ))}
          </motion.div>

          {/* ===== PHASE 2: Carousel Section ===== */}
          <AnimatePresence>
            {heroComplete && team.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="mt-10 sm:mt-14 w-full max-w-5xl"
              >

                {/* === CEO DUO (shown when showCeos is true) === */}
                <AnimatePresence mode="wait">
                  {showCeos ? (
                    <motion.div
                      key="ceos"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="flex flex-col items-center"
                    >
                      {/* Executive badge */}
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-1.5"
                      >
                        <Shield className="h-4 w-4 text-purple-300" />
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200">
                          Executive Leadership
                        </span>
                      </motion.div>

                      {/* Two CEO avatars side by side */}
                      <div className="flex items-center justify-center gap-8 sm:gap-16">
                        {ceos.map((ceo, i) => (
                          <Link key={ceo.id} href={`/${ceo.id}`} className="group flex flex-col items-center">
                            <motion.div
                              initial={{ opacity: 0, y: 20, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ delay: 0.3 + i * 0.15, duration: 0.6 }}
                              className="flex flex-col items-center"
                            >
                              <div
                                className="h-32 w-32 sm:h-44 sm:w-44 rounded-full overflow-hidden ring-4 ring-offset-4 transition-all duration-500 group-hover:ring-offset-8"
                                style={{
                                  ["--tw-ring-color" as string]: "#8B5CF6",
                                  ["--tw-ring-offset-color" as string]: "transparent",
                                  boxShadow: "0 0 80px rgba(139,92,246,0.3), 0 0 160px rgba(139,92,246,0.15)",
                                }}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={ceo.avatar} alt={ceo.name} className="h-full w-full object-cover" />
                              </div>
                              <h3 className="mt-4 font-serif text-2xl sm:text-3xl font-semibold text-white">
                                {ceo.name}
                              </h3>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-purple-200/60">
                                {ceo.title}
                              </p>
                              <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-white/15 px-4 py-1.5 text-xs text-white/60 transition-all duration-300 group-hover:border-white/40 group-hover:bg-white/10 group-hover:text-white">
                                Enter as {ceo.name} →
                              </span>
                            </motion.div>
                          </Link>
                        ))}
                      </div>

                      {/* Tagline below both */}
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                        className="mt-6 max-w-md text-center text-xs sm:text-sm leading-relaxed text-white/40"
                      >
                        Full visibility across every workflow step. Can approve, edit, or override any action at any stage.
                      </motion.p>
                    </motion.div>
                  ) : (

                    /* === TEAM CAROUSEL (4 personas rotating) === */
                    <motion.div
                      key="team"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                      <div className="relative flex items-end justify-center" style={{ minHeight: "320px" }}>

                        {/* Left persona */}
                        {leftPersona && (
                          <motion.button
                            key={`left-${leftPersona.id}`}
                            onClick={() => navigate("prev")}
                            className="absolute left-2 sm:left-12 bottom-8 flex flex-col items-center cursor-pointer z-[5]"
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 0.5, x: 0 }}
                            transition={{ duration: 0.6 }}
                            whileHover={{ opacity: 0.75, scale: 1.05 }}
                          >
                            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full overflow-hidden ring-2 ring-white/20 ring-offset-2 ring-offset-transparent" style={{ filter: "blur(1px)" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={leftPersona.avatar} alt={leftPersona.name} className="h-full w-full object-cover" />
                            </div>
                            <span className="mt-2 text-[10px] text-white/40 font-medium">{leftPersona.name}</span>
                          </motion.button>
                        )}

                        {/* Center persona */}
                        {active && (
                          <Link href={`/${active.id}`} className="flex flex-col items-center z-[20] group">
                            <motion.div
                              key={active.id}
                              initial={{ scale: 0.85, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                              className="flex flex-col items-center"
                            >
                              <div
                                className="h-28 w-28 sm:h-40 sm:w-40 rounded-full overflow-hidden ring-4 ring-offset-4 transition-all duration-500 group-hover:ring-offset-8"
                                style={{
                                  ["--tw-ring-color" as string]: colors.accent,
                                  ["--tw-ring-offset-color" as string]: "transparent",
                                  boxShadow: `0 0 60px ${colors.accent}40, 0 0 120px ${colors.accent}20`,
                                }}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={active.avatar} alt={active.name} className="h-full w-full object-cover" />
                              </div>

                              <motion.h2
                                key={`name-${active.id}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15, duration: 0.5 }}
                                className="mt-4 font-serif text-3xl sm:text-5xl font-semibold text-white text-center"
                              >
                                {active.name}
                              </motion.h2>

                              <motion.p
                                key={`title-${active.id}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3, duration: 0.5 }}
                                className="mt-1 text-xs sm:text-sm uppercase tracking-[0.2em] text-white/60"
                              >
                                {active.title}
                              </motion.p>

                              <motion.p
                                key={`tag-${active.id}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.45, duration: 0.5 }}
                                className="mt-3 max-w-sm text-center text-xs sm:text-sm leading-relaxed text-white/50"
                              >
                                {active.tagline}
                              </motion.p>

                              <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium text-white/80 transition-all duration-300 group-hover:border-white/50 group-hover:bg-white/10 group-hover:text-white"
                              >
                                Enter as {active.name} →
                              </motion.span>
                            </motion.div>
                          </Link>
                        )}

                        {/* Right persona */}
                        {rightPersona && (
                          <motion.button
                            key={`right-${rightPersona.id}`}
                            onClick={() => navigate("next")}
                            className="absolute right-2 sm:right-12 bottom-8 flex flex-col items-center cursor-pointer z-[5]"
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 0.5, x: 0 }}
                            transition={{ duration: 0.6 }}
                            whileHover={{ opacity: 0.75, scale: 1.05 }}
                          >
                            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full overflow-hidden ring-2 ring-white/20 ring-offset-2 ring-offset-transparent" style={{ filter: "blur(1px)" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={rightPersona.avatar} alt={rightPersona.name} className="h-full w-full object-cover" />
                            </div>
                            <span className="mt-2 text-[10px] text-white/40 font-medium">{rightPersona.name}</span>
                          </motion.button>
                        )}
                      </div>

                      {/* Navigation arrows + dots */}
                      <div className="mt-6 flex items-center justify-center gap-4">
                        <button
                          type="button"
                          onClick={() => navigate("prev")}
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white/60 transition-all duration-200 hover:scale-110 hover:border-white/40 hover:bg-white/10 hover:text-white cursor-pointer"
                        >
                          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
                        </button>

                        <div className="flex items-center gap-2">
                          {team.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => { if (!isAnimatingRef.current) { setShowCeos(false); setActiveIndex(i); } }}
                              className="cursor-pointer"
                            >
                              <div
                                className="rounded-full transition-all duration-500"
                                style={{
                                  width: !showCeos && i === activeIndex ? "24px" : "8px",
                                  height: "8px",
                                  backgroundColor: !showCeos && i === activeIndex ? "white" : "rgba(255,255,255,0.25)",
                                }}
                              />
                            </button>
                          ))}

                          {/* CEO dot (separate, purple) */}
                          <div className="mx-1 h-4 w-px bg-white/15" />
                          <button
                            type="button"
                            onClick={() => { if (!isAnimatingRef.current) setShowCeos(true); }}
                            className="cursor-pointer"
                          >
                            <div
                              className="rounded-full transition-all duration-500 flex items-center justify-center"
                              style={{
                                width: showCeos ? "28px" : "12px",
                                height: showCeos ? "12px" : "12px",
                                backgroundColor: showCeos ? "#8B5CF6" : "rgba(139,92,246,0.4)",
                                border: showCeos ? "none" : "1px solid rgba(139,92,246,0.5)",
                              }}
                            >
                              {showCeos && <Shield className="h-2.5 w-2.5 text-white" />}
                            </div>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => navigate("next")}
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white/60 transition-all duration-200 hover:scale-110 hover:border-white/40 hover:bg-white/10 hover:text-white cursor-pointer"
                        >
                          <ArrowRight className="h-5 w-5" strokeWidth={2} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            )}
          </AnimatePresence>

          {/* Scroll indicator */}
          {!heroComplete && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5 }}
              className="mt-12"
            >
              <ChevronDown className="h-5 w-5 text-white/30 animate-bounce" />
            </motion.div>
          )}
        </div>

        {/* ===== Footer ===== */}
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
