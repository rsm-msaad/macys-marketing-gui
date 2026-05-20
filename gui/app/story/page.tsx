"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Eye, EyeOff, Pencil, X } from "lucide-react";

type SlideData = {
  id: number;
  type: "image" | "divider";
  image?: string;
  label?: string;
  title?: string;
  subtitle?: string;
  notes: string;
};

export default function StoryPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<unknown>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [barVisible, setBarVisible] = useState(true);
  const [ready, setReady] = useState(false);

  // Restore bar visibility from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("storyBarVisible");
    if (saved === "false") setBarVisible(false);
  }, []);

  useEffect(() => {
    localStorage.setItem("storyBarVisible", String(barVisible));
  }, [barVisible]);

  // Load slides data
  useEffect(() => {
    fetch("/storyboard/slides.json")
      .then((r) => r.json())
      .then((data: SlideData[]) => setSlides(data));
  }, []);

  // Init Reveal.js after slides render
  useEffect(() => {
    if (slides.length === 0 || ready) return;

    let cancelled = false;
    (async () => {
      const Reveal = (await import("reveal.js")).default;
      await import("reveal.js/dist/reveal.css");

      if (cancelled || !containerRef.current) return;

      const deck = new Reveal(containerRef.current, {
        transition: "fade" as const,
        transitionSpeed: "default" as const,
        controls: true,
        progress: true,
        keyboard: true,
        touch: true,
        hash: false,
        center: false,
        width: "100%",
        height: "100%",
        margin: 0,
        minScale: 1,
        maxScale: 1,
      });

      await deck.initialize();
      deckRef.current = deck;
      setReady(true);

      deck.on("slidechanged", (event: Record<string, unknown>) => {
        setCurrentIndex((event as { indexh: number }).indexh);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [slides, ready]);

  // Toggle notes with N key, bar with P key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "n" || e.key === "N") {
        setNotesOpen((v) => !v);
      }
      if (e.key === "p" || e.key === "P") {
        setBarVisible((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const currentSlide = slides[currentIndex];
  const currentNotes = currentSlide?.notes || "";
  const total = slides.length;

  // Build sections array from divider slides
  const sections = (() => {
    if (slides.length === 0) return [];
    const result: Array<{
      label: string;
      subtitle: string;
      startIdx: number;
      endIdx: number;
      isCurrent: boolean;
      isCompleted: boolean;
      fillPct: number;
      slideInSection: number;
      totalInSection: number;
    }> = [];

    // Opening section (before first divider)
    const firstDividerIdx = slides.findIndex((s) => s.type === "divider");
    if (firstDividerIdx > 0) {
      result.push({
        label: "Opening",
        subtitle: "",
        startIdx: 0,
        endIdx: firstDividerIdx - 1,
        isCurrent: false,
        isCompleted: false,
        fillPct: 0,
        slideInSection: 0,
        totalInSection: firstDividerIdx,
      });
    }

    // Sections from dividers
    const dividers = slides
      .map((s, i) => ({ ...s, idx: i }))
      .filter((s) => s.type === "divider");
    for (let i = 0; i < dividers.length; i++) {
      const d = dividers[i];
      const endIdx = i + 1 < dividers.length ? dividers[i + 1].idx - 1 : slides.length - 1;
      const lbl = d.label || d.title || `Section ${i + 1}`;
      result.push({
        label: lbl,
        subtitle: d.title || "",
        startIdx: d.idx,
        endIdx,
        isCurrent: false,
        isCompleted: false,
        fillPct: 0,
        slideInSection: 0,
        totalInSection: endIdx - d.idx + 1,
      });
    }

    // Set current, completed, and progress flags
    for (const sec of result) {
      sec.isCurrent = currentIndex >= sec.startIdx && currentIndex <= sec.endIdx;
      sec.isCompleted = currentIndex > sec.endIdx;
      const span = sec.endIdx - sec.startIdx + 1;
      if (sec.isCompleted) {
        sec.fillPct = 100;
      } else if (sec.isCurrent) {
        sec.fillPct = Math.round(((currentIndex - sec.startIdx + 1) / span) * 100);
      } else {
        sec.fillPct = 0;
      }
      sec.slideInSection = sec.isCurrent ? currentIndex - sec.startIdx + 1 : 0;
      sec.totalInSection = span;
    }
    return result;
  })();

  const progressPct = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#F8F4EC]">
      {/* Reveal.js deck */}
      <div ref={containerRef} className="reveal" style={{ width: "100%", height: "100%" }}>
        <div className="slides">
          {slides.map((slide) => {
            if (slide.type === "divider") {
              return (
                <section
                  key={slide.id}
                  data-background-color="#0B7B8A"
                >
                  <div className="flex h-full flex-col items-center justify-center px-12">
                    <p
                      style={{
                        color: "#D4A843",
                        fontSize: "1.2rem",
                        fontWeight: 600,
                        letterSpacing: "0.25em",
                        textTransform: "uppercase",
                        marginBottom: "1rem",
                      }}
                    >
                      {slide.label}
                    </p>
                    <h2
                      style={{
                        color: "#F8F4EC",
                        fontSize: "3.5rem",
                        fontWeight: 700,
                        lineHeight: 1.1,
                        textAlign: "center",
                        fontFamily: "var(--font-fraunces, Georgia, serif)",
                      }}
                    >
                      {slide.title}
                    </h2>
                    {slide.subtitle && (
                      <p
                        style={{
                          color: "#F8F4EC",
                          fontSize: "1.1rem",
                          marginTop: "1.5rem",
                          opacity: 0.8,
                          textAlign: "center",
                        }}
                      >
                        {slide.subtitle}
                      </p>
                    )}
                  </div>
                </section>
              );
            }
            return (
              <section
                key={slide.id}
                data-background-image={slide.image}
                data-background-size="contain"
                data-background-color="#F8F4EC"
              />
            );
          })}
        </div>
      </div>

      {/* Compact section pills bar */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 border-t border-charcoal/[0.08] bg-[#F8F4EC]/95 backdrop-blur-sm transition-transform duration-300 ${barVisible ? "translate-y-0" : "translate-y-full"}`}>
        <div className="flex items-center gap-1.5 px-3 py-1.5 md:justify-center">
          {sections.map((sec, i) => (
            <button
              key={i}
              type="button"
              className={`relative overflow-hidden rounded-full text-[10px] font-medium transition-all ${
                sec.isCurrent
                  ? "px-3 py-1 shadow-sm"
                  : "hidden px-2.5 py-0.5 md:block"
              }`}
              style={{ backgroundColor: sec.fillPct > 0 ? undefined : "rgba(44,44,44,0.05)" }}
              onClick={() => {
                const deck = deckRef.current as { slide?: (h: number) => void } | null;
                deck?.slide?.(sec.startIdx);
              }}
            >
              {/* Teal fill layer */}
              <div
                className="absolute inset-0 bg-teal-600 transition-all duration-300"
                style={{ width: `${sec.fillPct}%` }}
              />
              {/* Grey background for unfilled portion */}
              <div className="absolute inset-0 bg-charcoal/5" style={{ clipPath: `inset(0 0 0 ${sec.fillPct}%)` }} />
              {/* Label */}
              <span className={`relative z-10 ${sec.fillPct > 50 ? "text-white" : "text-charcoal/60"}`}>
                {sec.label}
                {sec.isCurrent && (
                  <span className="ml-1.5 text-[9px] opacity-80">
                    {sec.slideInSection}/{sec.totalInSection}
                  </span>
                )}
              </span>
            </button>
          ))}
          <span className="ml-auto flex-shrink-0 text-[10px] text-charcoal/40">
            {currentIndex + 1}/{total}
          </span>
        </div>
      </div>

      {/* Back to app */}
      <Link
        href="/"
        className="fixed left-4 top-4 z-30 flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-black/30 hover:text-white"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to App
      </Link>

      {/* Edit link */}
      <Link
        href="/story-edit"
        className="fixed right-4 top-4 z-30 flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1.5 text-xs font-medium text-white/60 backdrop-blur-sm transition-colors hover:bg-black/30 hover:text-white"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </Link>

      {/* Show Notes button (sits above pill bar, moves up when notes open) */}
      <button
        type="button"
        onClick={() => setNotesOpen((v) => !v)}
        className={`fixed right-16 z-50 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-all ${
          notesOpen
            ? barVisible ? "bottom-[140px]" : "bottom-[100px]"
            : barVisible ? "bottom-[42px]" : "bottom-4"
        } ${
          notesOpen
            ? "bg-teal-600 text-white"
            : "bg-black/15 text-white/80 hover:bg-black/30 hover:text-white"
        }`}
      >
        <BookOpen className="h-3 w-3" />
        {notesOpen ? "Hide Notes" : "Notes (N)"}
      </button>

      {/* Bar visibility toggle */}
      <button
        type="button"
        onClick={() => setBarVisible((v) => !v)}
        title={barVisible ? "Hide progress bar (P)" : "Show progress bar (P)"}
        className={`fixed right-4 z-50 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium backdrop-blur-sm transition-all ${
          barVisible ? "bottom-[42px]" : "bottom-4"
        } bg-black/15 text-white/80 hover:bg-black/30 hover:text-white`}
      >
        {barVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      </button>

      {/* Notes drawer (stacks above the pill bar) */}
      {notesOpen && currentNotes && (
        <div className={`fixed inset-x-0 z-[45] animate-[slideUp_0.2s_ease] ${barVisible ? "bottom-[36px]" : "bottom-0"}`}>
          <div className="mx-auto max-w-3xl rounded-t-lg bg-white/95 px-6 py-4 shadow-xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm leading-relaxed text-charcoal/80">
                {currentNotes}
              </p>
              <button
                type="button"
                onClick={() => setNotesOpen(false)}
                className="flex-shrink-0 rounded p-1 text-charcoal/40 hover:text-charcoal"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .reveal .slides {
          text-align: center;
        }
        .reveal .controls {
          color: rgba(255,255,255,0.5);
        }
        .reveal .progress {
          display: none !important;
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
