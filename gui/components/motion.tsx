"use client";

/**
 * Reusable motion primitives for subtle animations across the app.
 *
 * Design principle: barely noticeable but feels polished. NOT flashy.
 * Use CSS transitions for simple hovers, Framer Motion for orchestrated effects.
 */

import { motion, type Variants } from "framer-motion";
import { type ReactNode } from "react";

/* ---- Page-level fade ---- */

const pageFade: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={pageFade}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ---- Scroll-triggered fade in ---- */

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export function FadeInView({ children, className, delay = 0 }: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={{
        hidden: fadeInUp.hidden,
        visible: {
          ...fadeInUp.visible,
          transition: { duration: 0.4, ease: "easeOut", delay },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ---- Staggered children container ---- */

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export function StaggerContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerChild} className={className}>
      {children}
    </motion.div>
  );
}

/* ---- Animated bar (grows from 0) ---- */

export function AnimatedBar({ pct, color, height = "h-4", delay = 0 }: {
  pct: number;
  color: string;
  height?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${pct}%` }}
      transition={{ duration: 0.8, ease: "easeOut", delay }}
      className={`${height} rounded`}
      style={{ backgroundColor: color }}
    />
  );
}

/* ---- Count-up number ---- */

import { useState, useEffect, useRef } from "react";

export function CountUp({ end, duration = 1.5, prefix = "", suffix = "", decimals = 0 }: {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * end);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration]);

  const formatted = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();
  return <span ref={ref}>{prefix}{formatted}{suffix}</span>;
}

/* ---- Pulsing loading dots ---- */

export function PulsingDots({ text = "Loading" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {text}
      <span className="inline-flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1 w-1 rounded-full bg-current"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </span>
    </span>
  );
}
