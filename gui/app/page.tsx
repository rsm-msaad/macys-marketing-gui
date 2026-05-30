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

/* ─── Helpers ─── */

/** Map 0→1 linear progress to easeOut curve */
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/* ─── Page ─── */

export default function LandingPage() {
  const { personas } = usePersonas();

  /* scroll-scrub state */
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);  // 0 → 1
  const rafRef = useRef<number>(0);
  const durationRef = useRef(0);

  /* carousel state */
  const [entered, setEntered] = useState(false);
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(0);
  const lockRef = useRef(false);

  const team = TEAM_ORDER.map((id) => personas.find((p) => p.id === id)).filter(Boolean) as typeof personas;
  const ceos = CEO_IDS.map((id) => personas.find((p) => p.id === id)).filter(Boolean) as typeof personas;
  const n = team.length || 1;

  /* ── Scroll-scrub: map scroll position → video currentTime ── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Wait for video metadata so we know the duration
    const onMeta = () => { durationRef.current = video.duration; };
    video.addEventListener("loadedmetadata", onMeta);
    if (video.duration) durationRef.current = video.duration;

    const onScroll = () => {
      if (rafRef.current) return; // throttle to rAF
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const el = containerRef.current;
        if (!el || !durationRef.current) return;

        // scrollable range = container height - viewport height
        const scrollable = el.scrollHeight - window.innerHeight;
        if (scrollable <= 0) return;

        const raw = Math.min(Math.max(el.scrollTop / scrollable, 0), 1);
        setProgress(raw);

        // Apply easeOut to the video time
        const eased = easeOut(raw);
        video.currentTime = eased * durationRef.current;
      });
    };

    const el = containerRef.current;
    el?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el?.removeEventListener("scroll", onScroll);
      video.removeEventListener("loadedmetadata", onMeta);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /* Trigger "entered" when scroll reaches the reveal zone */
  useEffect(() => {
    if (progress >= 0.9 && !entered) setEntered(true);
  }, [progress, entered]);

  /* ── Carousel navigation ── */
  const go = useCallback((d: "next" | "prev") => {
    if (lockRef.current || !team.length) return;
    lockRef.current = true;
    setDir(d === "next" ? 1 : -1);
    setIdx((p) => d === "next" ? (p + 1) % n : (p + n - 1) % n);
    setTimeout(() => { lockRef.current = false; }, 550);
  }, [n, team.length]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go("prev");
      if (e.key === "ArrowRight") go("next");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go]);

  const cur = team[idx];
  const prev = team[(idx + n - 1) % n];
  const next = team[(idx + 1) % n];

  const centerV = {
    enter: { opacity: 0, scale: 0.92, filter: "blur(6px)" },
    center: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 1.05, filter: "blur(6px)" },
  };

  /* Derived values from progress */
  // Video fades from 1 → 0.25 in the 0.85 → 1.0 range
  const videoOpacity = progress < 0.85 ? 1 : 1 - 0.75 * ((progress - 0.85) / 0.15);
  // Content appears in the 0.88 → 1.0 range
  const contentOpacity = progress < 0.88 ? 0 : Math.min((progress - 0.88) / 0.12, 1);
  // Content slides up from 40px → 0
  const contentY = progress < 0.88 ? 40 : 40 * (1 - Math.min((progress - 0.88) / 0.12, 1));

  return (
    <div
      ref={containerRef}
      className="h-screen overflow-y-auto"
      style={{ scrollBehavior: "smooth" }}
    >
      {/* Tall scroll container — 4x viewport gives comfortable scrub range */}
      <div style={{ height: "400vh", position: "relative" }}>

        {/* ── Sticky video layer (pinned to viewport) ── */}
        <div className="sticky top-0 h-screen w-full overflow-hidden">

          {/* The single video — scroll-scrubbed */}
          <video
            ref={videoRef}
            muted playsInline preload="auto"
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              opacity: videoOpacity,
              transition: "opacity 0.15s ease-out",
            }}
          >
            <source src="/veo3.mp4" type="video/mp4" />
          </video>

          {/* Grain overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ opacity: 0.25, backgroundImage: GRAIN, backgroundSize: "200px 200px" }}
          />

          {/* Scroll hint — only visible at the top */}
          <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-opacity duration-700"
            style={{ opacity: progress < 0.05 ? 1 : 0, pointerEvents: "none" }}
          >
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-white/70">
              Scroll to enter
            </span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="h-8 w-5 rounded-full border-2 border-white/40 flex items-start justify-center pt-1.5"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-white/70" />
            </motion.div>
          </div>

          {/* ── Content overlay — fades in at the end of the scroll ── */}
          <div
            className="absolute inset-0 flex flex-col px-4 sm:px-8"
            style={{
              opacity: contentOpacity,
              transform: `translateY(${contentY}px)`,
              transition: "opacity 0.15s ease-out, transform 0.15s ease-out",
              pointerEvents: contentOpacity > 0.5 ? "auto" : "none",
            }}
          >
            {/* ━━━ TOP: Title + Stats ━━━ */}
            <div className="flex flex-col items-center pt-[2.5vh] sm:pt-[3vh]">
              <h1
                className="font-serif text-charcoal text-center"
                style={{
                  fontSize: "clamp(36px, 7vw, 80px)",
                  lineHeight: 1,
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                }}
              >
                MACY&apos;S
              </h1>

              <p className="mt-1.5 sm:mt-2 text-xs tracking-[0.35em] uppercase text-charcoal/70 font-semibold">
                AI-Powered Marketing Operations
              </p>

              <div className="mt-3 sm:mt-4 flex flex-wrap justify-center gap-4 sm:gap-7">
                {STATS.map((s) => (
                  <div key={s.label} className="text-center min-w-[48px]">
                    <div className="font-serif text-lg sm:text-2xl font-bold text-charcoal">
                      {entered ? <CountUp end={s.end} duration={s.dur} suffix={s.sfx ?? ""} /> : "0"}
                    </div>
                    <div className="text-[11px] sm:text-xs uppercase tracking-[0.15em] text-charcoal/50 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ━━━ MIDDLE: CEOs + Carousel ━━━ */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-0">

              {/* CEO Duo */}
              {entered && ceos.length > 0 && (
                <div className="flex items-center gap-5 sm:gap-8 mb-3 sm:mb-5">
                  {ceos.map((c) => (
                    <Link key={c.id} href={`/${c.id}`} className="group flex flex-col items-center">
                      <div
                        className="h-12 w-12 sm:h-16 sm:w-16 rounded-full overflow-hidden ring-2 ring-teal-400/40 transition-all duration-300 group-hover:ring-teal-400/80"
                        style={{ boxShadow: "0 0 30px rgba(11,123,138,0.15)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.avatar} alt={c.name} className="h-full w-full object-cover" />
                      </div>
                      <span className="mt-1.5 text-xs font-semibold text-charcoal/90">{c.name}</span>
                      <span className="flex items-center gap-0.5 text-[11px] uppercase tracking-wider text-teal-600/60 font-semibold">
                        <Shield className="h-2 w-2" /> Co-CEO
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Team Carousel */}
              {entered && team.length > 0 && (
                <div className="w-full max-w-4xl">
                  <div className="relative flex items-center justify-center" style={{ height: "clamp(260px, 44vh, 420px)" }}>

                    {/* Left persona */}
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
                          className="h-14 w-14 sm:h-20 sm:w-20 rounded-full overflow-hidden ring-2 ring-charcoal/10 transition-all duration-300 hover:ring-charcoal/20"
                          style={{ filter: "blur(0.5px)", opacity: 0.6 }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={prev?.avatar} alt={prev?.name} className="h-full w-full object-cover" />
                        </div>
                        <span className="mt-1.5 text-xs text-charcoal/65 font-semibold">{prev?.name}</span>
                      </motion.button>
                    </AnimatePresence>

                    {/* Center persona */}
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
                            <div
                              className="h-28 w-28 sm:h-40 sm:w-40 rounded-full overflow-hidden ring-[3px] ring-charcoal/15 ring-offset-[3px] ring-offset-transparent transition-all duration-500 group-hover:ring-charcoal/25 group-hover:ring-offset-[6px]"
                              style={{ boxShadow: "0 0 50px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.1)" }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={cur.avatar} alt={cur.name} className="h-full w-full object-cover" />
                            </div>
                            <h2 className="mt-2 sm:mt-3 font-serif text-2xl sm:text-4xl font-semibold text-charcoal tracking-wide">
                              {cur.name}
                            </h2>
                            <p className="mt-0.5 text-xs uppercase tracking-[0.2em] text-charcoal/80 font-semibold">
                              {cur.title}
                            </p>
                            <p className="mt-1.5 max-w-[280px] sm:max-w-xs text-center text-xs leading-relaxed text-charcoal/55">
                              {cur.tagline}
                            </p>
                            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-charcoal/20 bg-white/40 backdrop-blur-sm px-4 py-1.5 text-[11px] font-semibold text-charcoal/80 transition-all duration-300 group-hover:border-charcoal/35 group-hover:bg-white/60 group-hover:text-charcoal">
                              Enter as {cur.name}
                              <ArrowRight className="h-3 w-3" />
                            </span>
                          </Link>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Right persona */}
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
                          className="h-14 w-14 sm:h-20 sm:w-20 rounded-full overflow-hidden ring-2 ring-charcoal/10 transition-all duration-300 hover:ring-charcoal/20"
                          style={{ filter: "blur(0.5px)", opacity: 0.6 }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={next?.avatar} alt={next?.name} className="h-full w-full object-cover" />
                        </div>
                        <span className="mt-1.5 text-xs text-charcoal/65 font-semibold">{next?.name}</span>
                      </motion.button>
                    </AnimatePresence>

                    {/* Arrow buttons */}
                    <button
                      type="button"
                      onClick={() => go("prev")}
                      className="absolute left-0 z-30 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 border-charcoal/20 bg-white/40 backdrop-blur-sm text-charcoal/70 hover:border-charcoal/35 hover:bg-white/60 hover:text-charcoal transition-all duration-200 cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => go("next")}
                      className="absolute right-0 z-30 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 border-charcoal/20 bg-white/40 backdrop-blur-sm text-charcoal/70 hover:border-charcoal/35 hover:bg-white/60 hover:text-charcoal transition-all duration-200 cursor-pointer"
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
                            backgroundColor: i === idx ? "rgba(45,45,45,0.75)" : "rgba(45,45,45,0.25)",
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ━━━ BOTTOM: Nav + Credit ━━━ */}
            <div
              className="pb-3 sm:pb-4 flex flex-col items-center gap-1.5"
              style={{ opacity: entered ? 1 : 0, transition: "opacity 0.8s ease" }}
            >
              <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
                {NAV.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="rounded-full border border-charcoal/15 bg-white/30 backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-semibold text-charcoal/70 transition-all duration-200 hover:border-charcoal/30 hover:bg-white/50 hover:text-charcoal"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
              <p className="text-[11px] text-charcoal/40 font-medium">
                Built with Claude · TritonAI · Next.js · FastAPI
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
