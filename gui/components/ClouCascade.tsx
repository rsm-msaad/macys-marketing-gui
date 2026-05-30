"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";

/* ─── Types ─── */

export interface ClouItem {
  id: string;
  image: string;
  title: string;
  tag?: string;
  metadata?: Record<string, string>;
}

interface ClouCascadeProps {
  items: ClouItem[];
  onSelect?: (item: ClouItem) => void;
}

/* ─── Cascade Card ─── */

function CascadeCard({
  item,
  stackIndex,
  isActive,
  onClick,
}: {
  item: ClouItem;
  stackIndex: number; // 0 = front, 1 = behind, etc.
  isActive: boolean;
  onClick: () => void;
}) {
  const depth = stackIndex;
  const xOff = depth * 60;
  const yOff = depth * -35;
  const zOff = depth * -80;
  const rotY = depth * -8;
  const opacity = Math.max(1 - depth * 0.2, 0.25);
  const scale = Math.max(1 - depth * 0.06, 0.7);

  return (
    <motion.div
      layout
      onClick={onClick}
      initial={false}
      animate={{
        x: xOff,
        y: yOff,
        z: zOff,
        rotateY: rotY,
        scale,
        opacity,
      }}
      whileHover={
        stackIndex > 0
          ? { y: yOff - 12, scale: scale + 0.03, opacity: Math.min(opacity + 0.15, 1) }
          : {}
      }
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="absolute origin-bottom-left cursor-pointer"
      style={{
        zIndex: 100 - stackIndex,
        perspective: "1200px",
        transformStyle: "preserve-3d",
      }}
    >
      <div
        className="overflow-hidden rounded-lg shadow-xl"
        style={{
          width: "280px",
          height: "360px",
          boxShadow:
            stackIndex === 0
              ? "0 20px 60px rgba(0,0,0,0.15), 0 8px 20px rgba(0,0,0,0.1)"
              : "0 10px 30px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.06)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt={item.title}
          className="h-full w-full object-cover"
        />
        {/* Title overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pb-4 pt-12">
          {item.tag && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60">
              {item.tag}
            </span>
          )}
          <div className="text-sm font-semibold text-white leading-tight mt-0.5">
            {item.title}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main Component ─── */

export function ClouCascade({ items, onSelect }: ClouCascadeProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const active = items[activeIdx];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const selectItem = useCallback(
    (idx: number) => {
      setActiveIdx(idx);
      onSelect?.(items[idx]);
    },
    [items, onSelect]
  );

  // Scroll/wheel to cycle through cascade
  const wheelTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (wheelTimeout.current) return; // throttle
      wheelTimeout.current = setTimeout(() => {
        wheelTimeout.current = null;
      }, 300);

      if (e.deltaY > 20) {
        setActiveIdx((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.deltaY < -20) {
        setActiveIdx((prev) => Math.max(prev - 1, 0));
      }
    },
    [items.length]
  );

  // Reorder: active item first, then the rest in order after it
  const ordered = items.map((_, i) => (activeIdx + i) % items.length);

  /* ── Reduced motion fallback: simple clickable list ── */
  if (reducedMotion) {
    return (
      <div className="flex gap-6">
        {/* Left: detail */}
        <div className="flex-1 min-w-0">
          <DetailPanel item={active} />
        </div>
        {/* Right: simple list */}
        <div className="w-72 space-y-2">
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => selectItem(i)}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                i === activeIdx
                  ? "border-teal-600/30 bg-teal-50/40"
                  : "border-charcoal/10 bg-white hover:bg-cream/50"
              }`}
            >
              <div className="text-xs font-semibold text-charcoal">{item.title}</div>
              {item.tag && (
                <div className="text-[11px] text-charcoal/50 mt-0.5">{item.tag}</div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
      {/* ── Left: Detail panel ── */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <DetailPanel item={active} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Right: 3D cascade ── */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="relative w-full lg:w-[420px] flex-shrink-0"
        style={{ height: "440px", perspective: "1200px" }}
      >
        <div
          className="absolute bottom-8 left-4"
          style={{ transformStyle: "preserve-3d" }}
        >
          {ordered.map((itemIdx, stackPos) => {
            if (stackPos > 5) return null; // only show top 6 in the stack
            return (
              <CascadeCard
                key={items[itemIdx].id}
                item={items[itemIdx]}
                stackIndex={stackPos}
                isActive={stackPos === 0}
                onClick={() => selectItem(itemIdx)}
              />
            );
          })}
        </div>

        {/* Navigation hint */}
        <div className="absolute bottom-0 right-0 text-xs text-charcoal/40 font-medium">
          {activeIdx + 1} / {items.length} — scroll or click to browse
        </div>
      </div>
    </div>
  );
}

/* ─── Detail Panel ─── */

function DetailPanel({ item }: { item: ClouItem }) {
  return (
    <div>
      {item.tag && (
        <span className="inline-block rounded-full bg-teal-600/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-teal-600 mb-3">
          {item.tag}
        </span>
      )}

      <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-charcoal leading-tight">
        {item.title}
      </h2>

      {/* Hero image */}
      <div className="mt-4 overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt={item.title}
          className="w-full h-auto max-h-[320px] object-cover"
        />
      </div>

      <a
        href="#"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-charcoal/70 hover:text-charcoal transition-colors group"
      >
        View details
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </a>

      {/* Metadata row */}
      {item.metadata && Object.keys(item.metadata).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-charcoal/10 pt-4">
          {Object.entries(item.metadata).map(([key, val]) => (
            <div key={key}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-charcoal/40">
                {key}
              </div>
              <div className="text-sm font-medium text-charcoal">{val}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
