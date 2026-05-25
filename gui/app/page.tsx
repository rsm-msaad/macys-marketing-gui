"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Shield } from "lucide-react";

import { usePersonas } from "@/components/PersonaContext";
import { CountUp } from "@/components/motion";

/* ─── Data ─── */

const TEAM_ORDER = ["campaign-manager", "senior-designer", "marketing-analyst", "production-artist"];
const CEO_IDS = ["ceo", "thales"];

const STATS = [
  { end: 5, label: "Skills", dur: 2 },
  { end: 6, label: "Automations", dur: 2.2 },
  { end: 2, label: "MCP Tools", dur: 1.8 },
  { end: 12, label: "RAG Docs", dur: 2.4 },
  { end: 2000, label: "SKUs", dur: 2.8, sfx: "" },
  { end: 50, label: "Customers", dur: 2, sfx: "K" },
];

const NAV = [
  { label: "Story", href: "/story" },
  { label: "RAG Demo", href: "/rag-compare" },
  { label: "Evals", href: "/evals" },
  { label: "Evidence", href: "/evidence" },
  { label: "Impact", href: "/impact" },
  { label: "Docs", href: "/docs" },
];

const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`;

/* ─── Page ─── */

export default function LandingPage() {
  const { personas, loading } = usePersonas();
  const [entered, setEntered] = useState(false);
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(0);
  const lockRef = useRef(false);

  const team = TEAM_ORDER.map((id) => personas.find((p) => p.id === id)).filter(Boolean) as typeof personas;
  const ceos = CEO_IDS.map((id) => personas.find((p) => p.id === id)).filter(Boolean) as typeof personas;
  const n = team.length || 1;

  useEffect(() => { const t = setTimeout(() => setEntered(true), 2800); return () => clearTimeout(t); }, []);

  const go = useCallback((d: "next" | "prev") => {
    if (lockRef.current || !team.length) return;
    lockRef.current = true;
    setDir(d === "next" ? 1 : -1);
    setIdx((p) => d === "next" ? (p + 1) % n : (p + n - 1) % n);
    setTimeout(() => { lockRef.current = false; }, 550);
  }, [n, team.length]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "ArrowLeft") go("prev"); if (e.key === "ArrowRight") go("next"); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go]);

  const cur = team[idx];
  const prev = team[(idx + n - 1) % n];
  const next = team[(idx + 1) % n];

  /* slide variants */
  const centerV = {
    enter: (d: number) => ({ x: d > 0 ? 120 : -120, opacity: 0, scale: 0.8 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? -120 : 120, opacity: 0, scale: 0.8 }),
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#08080e]">

      {/* ── Video ── */}
      <video
        autoPlay loop muted playsInline
        className="absolute inset-0 z-0 h-full w-full object-cover"
        style={{ opacity: entered ? 0.22 : 0.14, transition: "opacity 2s ease" }}
      >
        <source src="/hero-bg.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/50 via-black/20 to-black/70" />

      {/* ── Grain ── */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{ opacity: 0.35, backgroundImage: GRAIN, backgroundSize: "200px 200px" }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 flex h-full flex-col px-4 sm:px-8">

        {/* ━━━ TOP: Title + Stats ━━━ */}
        <div className="flex flex-col items-center pt-[2.5vh] sm:pt-[3vh]">

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 16, letterSpacing: "0.4em" }}
            animate={{ opacity: 1, y: 0, letterSpacing: "0.18em" }}
            transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif text-white text-center"
            style={{ fontSize: "clamp(36px, 7vw, 80px)", lineHeight: 1, fontWeight: 600 }}
          >
            MACY&apos;S
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ duration: 1, delay: 0.9 }}
            className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs tracking-[0.35em] uppercase text-white font-medium"
          >
            AI-Powered Marketing Operations
          </motion.p>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.6 }}
            className="mt-3 sm:mt-4 flex flex-wrap justify-center gap-4 sm:gap-7"
          >
            {STATS.map((s) => (
              <div key={s.label} className="text-center min-w-[48px]">
                <div className="font-serif text-lg sm:text-2xl font-bold text-white/90">
                  {entered ? <CountUp end={s.end} duration={s.dur} suffix={s.sfx ?? ""} /> : "0"}
                </div>
                <div className="text-[8px] sm:text-[10px] uppercase tracking-[0.15em] text-white/35 mt-0.5">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ━━━ MIDDLE: CEOs + Carousel ━━━ */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0">

          {/* CEO Duo */}
          <AnimatePresence>
            {entered && ceos.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="flex items-center gap-5 sm:gap-8 mb-3 sm:mb-5"
              >
                {ceos.map((c) => (
                  <Link key={c.id} href={`/${c.id}`} className="group flex flex-col items-center">
                    <div
                      className="h-12 w-12 sm:h-16 sm:w-16 rounded-full overflow-hidden ring-2 ring-purple-400/40 transition-all duration-300 group-hover:ring-purple-400/80"
                      style={{ boxShadow: "0 0 30px rgba(139,92,246,0.15)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.avatar} alt={c.name} className="h-full w-full object-cover" />
                    </div>
                    <span className="mt-1.5 text-[10px] sm:text-xs font-semibold text-white/80">{c.name}</span>
                    <span className="flex items-center gap-0.5 text-[8px] uppercase tracking-wider text-purple-300/50">
                      <Shield className="h-2 w-2" /> Co-CEO
                    </span>
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Team Carousel */}
          <AnimatePresence>
            {entered && team.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="w-full max-w-4xl"
              >
                {/* Carousel track */}
                <div className="relative flex items-center justify-center" style={{ height: "clamp(260px, 44vh, 420px)" }}>

                  {/* ── Left persona ── */}
                  <AnimatePresence mode="popLayout">
                    <motion.button
                      key={`l-${prev?.id}`}
                      initial={{ opacity: 0, x: -40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -40 }}
                      transition={{ duration: 0.45 }}
                      onClick={() => go("prev")}
                      className="absolute left-4 sm:left-16 z-10 flex flex-col items-center cursor-pointer"
                    >
                      <div
                        className="h-14 w-14 sm:h-20 sm:w-20 rounded-full overflow-hidden ring-2 ring-white/10 transition-all duration-300 hover:ring-white/30"
                        style={{ filter: "blur(0.5px)", opacity: 0.6 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={prev?.avatar} alt={prev?.name} className="h-full w-full object-cover" />
                      </div>
                      <span className="mt-1.5 text-[9px] sm:text-[10px] text-white/30 font-medium">{prev?.name}</span>
                    </motion.button>
                  </AnimatePresence>

                  {/* ── Center persona ── */}
                  <AnimatePresence mode="wait" custom={dir}>
                    {cur && (
                      <motion.div
                        key={cur.id}
                        custom={dir}
                        variants={centerV}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="flex flex-col items-center z-20"
                      >
                        <Link href={`/${cur.id}`} className="flex flex-col items-center group">
                          <div
                            className="h-28 w-28 sm:h-40 sm:w-40 rounded-full overflow-hidden ring-[3px] ring-white/20 ring-offset-[3px] ring-offset-transparent transition-all duration-500 group-hover:ring-white/40 group-hover:ring-offset-[6px]"
                            style={{ boxShadow: "0 0 50px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.4)" }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={cur.avatar} alt={cur.name} className="h-full w-full object-cover" />
                          </div>
                          <h2 className="mt-2 sm:mt-3 font-serif text-2xl sm:text-4xl font-semibold text-white tracking-wide">
                            {cur.name}
                          </h2>
                          <p className="mt-0.5 text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/40 font-medium">
                            {cur.title}
                          </p>
                          <p className="mt-1.5 max-w-[280px] sm:max-w-xs text-center text-[10px] sm:text-xs leading-relaxed text-white/30">
                            {cur.tagline}
                          </p>
                          <span className="mt-2 sm:mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-5 py-2 text-[11px] sm:text-xs font-medium text-white/60 transition-all duration-300 group-hover:border-white/40 group-hover:bg-white/5 group-hover:text-white/90">
                            Enter as {cur.name}
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Right persona ── */}
                  <AnimatePresence mode="popLayout">
                    <motion.button
                      key={`r-${next?.id}`}
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 40 }}
                      transition={{ duration: 0.45 }}
                      onClick={() => go("next")}
                      className="absolute right-4 sm:right-16 z-10 flex flex-col items-center cursor-pointer"
                    >
                      <div
                        className="h-14 w-14 sm:h-20 sm:w-20 rounded-full overflow-hidden ring-2 ring-white/10 transition-all duration-300 hover:ring-white/30"
                        style={{ filter: "blur(0.5px)", opacity: 0.6 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={next?.avatar} alt={next?.name} className="h-full w-full object-cover" />
                      </div>
                      <span className="mt-1.5 text-[9px] sm:text-[10px] text-white/30 font-medium">{next?.name}</span>
                    </motion.button>
                  </AnimatePresence>

                  {/* ── Arrow buttons (outer edges) ── */}
                  <button
                    type="button"
                    onClick={() => go("prev")}
                    className="absolute left-0 z-30 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/10 text-white/40 hover:border-white/30 hover:bg-white/5 hover:text-white/80 transition-all duration-200 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => go("next")}
                    className="absolute right-0 z-30 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/10 text-white/40 hover:border-white/30 hover:bg-white/5 hover:text-white/80 transition-all duration-200 cursor-pointer"
                  >
                    <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>

                {/* Dots */}
                <div className="mt-3 flex justify-center gap-2">
                  {team.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { if (!lockRef.current) { setDir(i > idx ? 1 : -1); setIdx(i); } }}
                      className="cursor-pointer"
                    >
                      <div
                        className="rounded-full transition-all duration-400"
                        style={{
                          width: i === idx ? "20px" : "6px",
                          height: "6px",
                          backgroundColor: i === idx ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)",
                        }}
                      />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ━━━ BOTTOM: Nav + Credit ━━━ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: entered ? 1 : 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="pb-3 sm:pb-4 flex flex-col items-center gap-1.5"
        >
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full border border-white/8 px-3 py-1 text-[9px] sm:text-[10px] font-medium text-white/30 transition-all duration-200 hover:border-white/20 hover:text-white/60"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <p className="text-[9px] text-white/15">
            Built with Claude · TritonAI · Next.js · FastAPI
          </p>
        </motion.div>
      </div>
    </div>
  );
}
