"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";

// ── Transition presets ──

export const springSmooth = { type: "spring" as const, damping: 25, stiffness: 200 };
export const springSnappy = { type: "spring" as const, damping: 30, stiffness: 300 };
export const easeFade = { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const };

// ── Fade + slide variants ──

export const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: springSmooth,
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: easeFade,
};

export const slideRight = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: springSmooth,
};

export const slideInFromRight = {
  initial: { x: "100%" },
  animate: { x: 0 },
  exit: { x: "100%" },
  transition: { type: "spring" as const, damping: 28, stiffness: 260 },
};

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};

export const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: springSmooth },
};

// ── Animated counter hook ──

export function useAnimatedNumber(target: number, duration: number = 1200) {
  const spring = useSpring(0, { damping: 40, stiffness: 100 });
  const display = useTransform(spring, (v) => Math.round(v));
  const [value, setValue] = useState(0);

  useEffect(() => {
    spring.set(target);
  }, [spring, target]);

  useEffect(() => {
    const unsub = display.on("change", (v) => setValue(v));
    return unsub;
  }, [display]);

  return value;
}

// ── StaggerReveal: reveals children one by one ──

export function StaggerReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="initial"
      animate="animate"
      variants={{
        initial: {},
        animate: { transition: { staggerChildren: 0.1, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0, transition: springSmooth },
      }}
    >
      {children}
    </motion.div>
  );
}

// ── Re exports for convenience ──

export { motion, AnimatePresence };
