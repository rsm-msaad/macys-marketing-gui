"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { motion } from "framer-motion";

interface Carousel3DProps {
  /** Render function for each item - receives the item and whether it's the front card */
  children: (item: any, index: number, isFront: boolean) => ReactNode;
  items: any[];
  /** Auto-rotate speed in degrees per second (0 to disable) */
  autoRotateSpeed?: number;
  /** Radius of the carousel cylinder in px */
  radius?: number;
  /** Height of the carousel container in px */
  height?: number;
}

export function Carousel3D({
  children,
  items,
  autoRotateSpeed = 12,
  radius = 340,
  height = 420,
}: Carousel3DProps) {
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dragStartX = useRef(0);
  const dragStartRotation = useRef(0);
  const velocity = useRef(0);
  const lastX = useRef(0);
  const animRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const n = items.length;
  const angleStep = 360 / n;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (isDragging || reducedMotion || autoRotateSpeed === 0) return;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = (now - prev) / 1000;
      prev = now;
      // Apply inertia velocity
      if (Math.abs(velocity.current) > 0.05) {
        velocity.current *= 0.96;
        setRotation((r) => r + velocity.current);
      } else {
        velocity.current = 0;
        setRotation((r) => r + autoRotateSpeed * dt);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isDragging, autoRotateSpeed, reducedMotion]);

  // Drag handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartX.current = e.clientX;
    lastX.current = e.clientX;
    dragStartRotation.current = rotation;
    velocity.current = 0;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [rotation]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX.current;
    const frameDx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    velocity.current = frameDx * 0.3;
    setRotation(dragStartRotation.current + dx * 0.3);
  }, [isDragging]);

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Find which card is closest to front (rotation 0)
  const normalizedRot = ((rotation % 360) + 360) % 360;
  const frontIdx = Math.round(normalizedRot / angleStep) % n;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ height, perspective: "1000px" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          transformStyle: "preserve-3d",
          transform: `translate(-50%, -50%) rotateY(${-rotation}deg)`,
          transition: isDragging ? "none" : "transform 0.1s linear",
          width: 0,
          height: 0,
        }}
      >
        {items.map((item, i) => {
          const angle = i * angleStep;
          const isFront = i === (n - frontIdx) % n;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="absolute"
              style={{
                width: "240px",
                left: "-120px",
                top: "-160px",
                transformStyle: "preserve-3d",
                transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
                backfaceVisibility: "hidden",
              }}
            >
              {children(item, i, isFront)}
            </motion.div>
          );
        })}
      </div>

      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-cream to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-cream to-transparent z-10" />
    </div>
  );
}
