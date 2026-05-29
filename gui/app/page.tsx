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

/* ─── Shimmer keyframes (injected once) ─── */
const SHIMMER_CSS = `
@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes meshFloat {
  0%, 100% { transform: translate(0%, 0%) scale(1); }
  25% { transform: translate(3%, -2%) scale(1.05); }
  50% { transform: translate(-2%, 3%) scale(0.97); }
  75% { transform: translate(1%, -1%) scale(1.03); }
}
`;

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

  /* crossfade morph — both personas overlap during transition */
  const centerV = {
    enter: { opacity: 0, scale: 0.92, filter: "blur(6px)" },
    center: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 1.05, filter: "blur(6px)" },
  };

  return (
    <div className="relative w-full min-h-screen overflow-y-auto bg-[#0a0a0a]">

      {/* ── Inject shimmer keyframes ── */}
      <style dangerouslySetInnerHTML={{ __html: SHIMMER_CSS }} />

      {/* ── Animated radial gradient mesh background ── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 30% 40%, rgba(11,123,138,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 70% 60%, rgba(212,165,55,0.06) 0%, transparent 55%)",
          animation: "meshFloat 20s ease-in-out infinite",
        }}
      />

      {/* ── Video ── */}
      <video
        autoPlay loop muted playsInline
        className="fixed inset-0 z-0 h-full w-full object-cover"
        style={{ opacity: entered ? 0.4 : 0.15, transition: "opacity 2.5s ease" }}
      >
        <source src="/hero-bg.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 z-[1] bg-gradient-to-b from-black/60 via-black/30 to-black/70" />

      {/* ── Grain ── */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{ opacity: 0.3, backgroundImage: GRAIN, backgroundSize: "200px 200px" }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center px-4 sm:px-8 py-8 sm:py-12 gap-8 sm:gap-10">

        {/* ━━━ TOP: Title + Stats ━━━ */}
        <div className="flex flex-col items-center">

          {/* Title — cinematic MACY'S */}
          <motion.h1
            initial={{ opacity: 0, y: 20, letterSpacing: "0.5em" }}
            animate={{ opacity: 1, y: 0, letterSpacing: "0.05em" }}
            transition={{ duration: 2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif text-center font-bold text-white"
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              lineHeight: 1,
              textShadow: "0 2px 40px rgba(255,255,255,0.15)",
            }}
          >
            MACY&apos;S
          </motion.h1>

          {/* Expanding divider line */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 1.2, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 sm:mt-4 h-[1px] w-32 sm:w-48 origin-center"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(11,123,138,0.6) 30%, rgba(212,165,55,0.5) 70%, transparent 100%)",
            }}
          />

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.8 }}
            className="mt-2 sm:mt-3 text-[10px] sm:text-xs tracking-[0.4em] uppercase text-white/60 font-semibold"
          >
            AI-Powered Marketing Operations
          </motion.p>

          {/* Stats — frosted glass bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: entered ? 1 : 0, y: entered ? 0 : 16 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-3 sm:mt-4 rounded-xl border border-white/10 px-2 sm:px-3 py-2 sm:py-2.5"
            style={{
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 4px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex flex-wrap justify-center">
              {STATS.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: entered ? 1 : 0, y: entered ? 0 : 10 }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.15 }}
                  className="text-center min-w-[44px] px-2 sm:px-3 py-0.5"
                  style={{
                    borderTop: "none",
                    borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}
                >
                  <div className="font-serif text-lg sm:text-xl font-bold text-white/90">
                    {entered ? <CountUp end={s.end} duration={s.dur} suffix={s.sfx ?? ""} /> : "0"}
                  </div>
                  <div className="text-[11px] sm:text-xs uppercase tracking-[0.18em] text-white/40 mt-0.5 font-medium">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ━━━ MIDDLE: CEOs + Carousel ━━━ */}
        <div className="flex flex-col items-center">

          {/* CEO Duo */}
          <AnimatePresence>
            {entered && ceos.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="flex items-center gap-5 sm:gap-8 mb-4 sm:mb-6"
              >
                {ceos.map((c) => (
                  <Link key={c.id} href={`/${c.id}`} className="group flex flex-col items-center">
                    <div
                      className="h-14 w-14 sm:h-18 sm:w-18 rounded-full overflow-hidden ring-2 ring-teal-400/30 transition-all duration-300 group-hover:ring-teal-400/70"
                      style={{ boxShadow: "0 0 30px rgba(11,123,138,0.2)", width: "clamp(56px, 8vw, 72px)", height: "clamp(56px, 8vw, 72px)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.avatar} alt={c.name} className="h-full w-full object-cover" />
                    </div>
                    <span className="mt-1.5 text-xs font-semibold text-white/85">{c.name}</span>
                    <span className="flex items-center gap-0.5 text-xs uppercase tracking-wider text-teal-400/60 font-semibold">
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
                <div className="relative flex items-center justify-center" style={{ height: "260px" }}>

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
                        className="h-14 w-14 sm:h-20 sm:w-20 rounded-full overflow-hidden ring-2 ring-white/10 transition-all duration-300 hover:ring-white/25"
                        style={{ filter: "blur(0.5px)", opacity: 0.5 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={prev?.avatar} alt={prev?.name} className="h-full w-full object-cover" />
                      </div>
                      <span className="mt-1.5 text-xs text-white/45 font-semibold">{prev?.name}</span>
                    </motion.button>
                  </AnimatePresence>

                  {/* ── Center persona ── */}
                  <AnimatePresence mode="popLayout">
                    {cur && (
                      <motion.div
                        key={cur.id}
                        variants={centerV}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="absolute inset-0 flex flex-col items-center justify-center z-20"
                      >
                        <Link href={`/${cur.id}`} className="flex flex-col items-center group">
                          {/* Radial glow behind active avatar */}
                          <div className="relative">
                            <div
                              className="absolute inset-0 rounded-full"
                              style={{
                                background: "radial-gradient(circle, rgba(11,123,138,0.25) 0%, rgba(212,165,55,0.1) 50%, transparent 70%)",
                                transform: "scale(1.8)",
                                filter: "blur(20px)",
                              }}
                            />
                            <div
                              className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden ring-[2px] ring-white/20 ring-offset-[3px] ring-offset-transparent transition-all duration-500 group-hover:ring-white/40 group-hover:ring-offset-[6px]"
                              style={{ boxShadow: "0 0 60px rgba(11,123,138,0.15), 0 8px 40px rgba(0,0,0,0.3)" }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={cur.avatar} alt={cur.name} className="h-full w-full object-cover" />
                            </div>
                          </div>
                          <h2 className="mt-2 font-serif text-xl sm:text-2xl font-semibold text-white tracking-wide">
                            {cur.name}
                          </h2>
                          <p className="mt-0.5 text-xs uppercase tracking-[0.2em] text-white/70 font-semibold">
                            {cur.title}
                          </p>
                          <p className="mt-1.5 max-w-[280px] sm:max-w-xs text-center text-xs leading-relaxed text-white/45">
                            {cur.tagline}
                          </p>
                          {/* Premium gradient-border CTA button */}
                          <span
                            className="mt-2 sm:mt-3 relative inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-[11px] sm:text-xs font-semibold text-white transition-all duration-300 group-hover:scale-[1.03] cursor-pointer"
                            style={{
                              background: "linear-gradient(#0a0a0a, #0a0a0a) padding-box, linear-gradient(135deg, #0B7B8A 0%, #D4A537 100%) border-box",
                              border: "2px solid transparent",
                              boxShadow: "0 0 20px rgba(11,123,138,0.15)",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.backgroundImage = "linear-gradient(135deg, rgba(11,123,138,0.15), rgba(212,165,55,0.1))";
                              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(11,123,138,0.3)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.backgroundImage = "none";
                              (e.currentTarget as HTMLElement).style.background = "linear-gradient(#0a0a0a, #0a0a0a) padding-box, linear-gradient(135deg, #0B7B8A 0%, #D4A537 100%) border-box";
                              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(11,123,138,0.15)";
                            }}
                          >
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
                        className="h-14 w-14 sm:h-20 sm:w-20 rounded-full overflow-hidden ring-2 ring-white/10 transition-all duration-300 hover:ring-white/25"
                        style={{ filter: "blur(0.5px)", opacity: 0.5 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={next?.avatar} alt={next?.name} className="h-full w-full object-cover" />
                      </div>
                      <span className="mt-1.5 text-xs text-white/45 font-semibold">{next?.name}</span>
                    </motion.button>
                  </AnimatePresence>

                  {/* ── Arrow buttons (outer edges) ── */}
                  <button
                    type="button"
                    onClick={() => go("prev")}
                    className="absolute left-0 z-30 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 backdrop-blur-sm text-white/60 hover:border-white/30 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => go("next")}
                    className="absolute right-0 z-30 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 backdrop-blur-sm text-white/60 hover:border-white/30 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
                  >
                    <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>

                {/* Dots */}
                <div className="mt-3 flex justify-center gap-2">
                  {team.map((member, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to ${member?.name ?? `persona ${i + 1}`}`}
                      onClick={() => { if (!lockRef.current) { setDir(i > idx ? 1 : -1); setIdx(i); } }}
                      className="cursor-pointer"
                    >
                      <div
                        className="rounded-full transition-all duration-400"
                        style={{
                          width: i === idx ? "20px" : "6px",
                          height: "6px",
                          backgroundColor: i === idx ? "rgba(11,123,138,0.8)" : "rgba(255,255,255,0.2)",
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
          className="flex flex-col items-center gap-3"
        >
          {/* Floating glass nav bar */}
          <div
            className="flex flex-wrap justify-center gap-1 sm:gap-1.5 rounded-full px-3 py-2 border border-white/10"
            style={{
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 4px 30px rgba(0,0,0,0.2), 0 0 40px rgba(11,123,138,0.05), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-semibold text-white/60 transition-all duration-200 hover:bg-white/10 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <p className="text-[10px] sm:text-xs text-white/25 font-medium tracking-wide">
            Built with Claude &middot; TritonAI &middot; Next.js &middot; FastAPI
          </p>
        </motion.div>
      </div>
    </div>
  );
}
