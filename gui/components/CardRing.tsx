"use client";

import { useRef, useState, useCallback, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/* ─── Types ─── */

export interface CardItem {
  id: string;
  image: string;
  title: string;
}

interface CardRingProps {
  items: CardItem[];
  radius?: number;
  cardWidth?: number;
  cardHeight?: number;
  onSelect?: (item: CardItem) => void;
}

/* ─── Single Card mesh ─── */

function Card({
  item,
  index,
  total,
  radius,
  cardWidth,
  cardHeight,
  selectedId,
  onSelect,
  onHover,
  hoveredId,
}: {
  item: CardItem;
  index: number;
  total: number;
  radius: number;
  cardWidth: number;
  cardHeight: number;
  selectedId: string | null;
  onSelect: (item: CardItem) => void;
  onHover: (id: string | null) => void;
  hoveredId: string | null;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useLoader(THREE.TextureLoader, item.image);

  // Card position on the ring
  const angle = (index / total) * Math.PI * 2;
  const targetX = Math.sin(angle) * radius;
  const targetZ = Math.cos(angle) * radius;

  // Selected card goes to front-center
  const isSelected = selectedId === item.id;
  const isHovered = hoveredId === item.id;
  const otherSelected = selectedId !== null && !isSelected;
  const otherHovered = hoveredId !== null && !isHovered;

  // Smooth animation targets
  const posRef = useRef(new THREE.Vector3(targetX, 0, targetZ));
  const scaleRef = useRef(new THREE.Vector3(1, 1, 1));
  const targetRotY = angle + Math.PI; // face outward

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const speed = 4 * delta;

    let goalX = targetX;
    let goalY = 0;
    let goalZ = targetZ;
    let goalScale = 1;

    if (isSelected) {
      goalX = 0;
      goalY = 0;
      goalZ = radius + 1.5;
      goalScale = 1.6;
    } else if (isHovered) {
      // Lift forward slightly
      goalX = targetX * 1.08;
      goalZ = targetZ * 1.08;
      goalY = 0.15;
      goalScale = 1.1;
    }

    if (otherSelected || otherHovered) {
      goalScale = isSelected ? goalScale : 0.92;
    }

    posRef.current.lerp(new THREE.Vector3(goalX, goalY, goalZ), speed);
    scaleRef.current.lerp(new THREE.Vector3(goalScale, goalScale, goalScale), speed);

    meshRef.current.position.copy(posRef.current);
    meshRef.current.scale.copy(scaleRef.current);

    // Face outward (or camera if selected)
    if (isSelected) {
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, Math.PI, speed);
    } else {
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotY, speed);
    }
  });

  // Dim non-hovered/non-selected cards
  const opacity = (otherSelected && !isSelected) ? 0.35 : (otherHovered && !isHovered) ? 0.6 : 1;

  return (
    <mesh
      ref={meshRef}
      position={[targetX, 0, targetZ]}
      rotation={[0, targetRotY, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(item); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(item.id); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { onHover(null); document.body.style.cursor = "auto"; }}
    >
      <planeGeometry args={[cardWidth, cardHeight, 1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ─── Ring group that auto-rotates ─── */

function Ring({
  items,
  radius,
  cardWidth,
  cardHeight,
  onSelect,
}: {
  items: CardItem[];
  radius: number;
  cardWidth: number;
  cardHeight: number;
  onSelect?: (item: CardItem) => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Drag state for manual spin
  const isDragging = useRef(false);
  const prevPointerX = useRef(0);
  const velocity = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Pointer handlers for drag-to-spin (use `any` to avoid React vs R3F event type conflict)
  const onPointerDown = useCallback((e: any) => {
    isDragging.current = true;
    prevPointerX.current = e.clientX ?? e.point?.x ?? 0;
    velocity.current = 0;
  }, []);

  const onPointerMove = useCallback((e: any) => {
    if (!isDragging.current) return;
    const clientX = e.clientX ?? e.point?.x ?? 0;
    const dx = clientX - prevPointerX.current;
    prevPointerX.current = clientX;
    velocity.current = dx * 0.003;
    if (groupRef.current) {
      groupRef.current.rotation.y += velocity.current;
    }
  }, []);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Auto-rotate when nothing selected and not dragging
    if (!selectedId && !isDragging.current && !reducedMotion) {
      groupRef.current.rotation.y += 0.15 * delta;
    }

    // Inertia when not dragging
    if (!isDragging.current && !reducedMotion) {
      velocity.current *= 0.95; // damping
      if (Math.abs(velocity.current) > 0.0001) {
        groupRef.current.rotation.y += velocity.current;
      }
    }
  });

  const handleSelect = useCallback((item: CardItem) => {
    if (selectedId === item.id) {
      setSelectedId(null); // deselect
    } else {
      setSelectedId(item.id);
      onSelect?.(item);
    }
  }, [selectedId, onSelect]);

  return (
    <group
      ref={groupRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {items.map((item, i) => (
        <Card
          key={item.id}
          item={item}
          index={i}
          total={items.length}
          radius={radius}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          selectedId={selectedId}
          onSelect={handleSelect}
          onHover={setHoveredId}
          hoveredId={hoveredId}
        />
      ))}
    </group>
  );
}

/* ─── Loading fallback ─── */

function LoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
        <span className="text-xs text-charcoal/50 font-medium">Loading 3D gallery...</span>
      </div>
    </div>
  );
}

/* ─── Main exported component ─── */

export function CardRing({
  items,
  radius = 3.5,
  cardWidth = 1.6,
  cardHeight = 2.1,
  onSelect,
}: CardRingProps) {
  const [selected, setSelected] = useState<CardItem | null>(null);

  const handleSelect = useCallback((item: CardItem) => {
    setSelected((prev) => (prev?.id === item.id ? null : item));
    onSelect?.(item);
  }, [onSelect]);

  const handleClose = useCallback(() => {
    setSelected(null);
  }, []);

  return (
    <div className="relative w-full" style={{ height: "480px" }}>
      {/* 3D Canvas */}
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{ position: [0, 0.5, 6], fov: 50 }}
          style={{ background: "transparent" }}
          gl={{ antialias: true, alpha: true }}
          onPointerMissed={() => setSelected(null)}
        >
          <ambientLight intensity={1.5} />
          <Ring
            items={items}
            radius={radius}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            onSelect={handleSelect}
          />
        </Canvas>
      </Suspense>

      {/* Detail panel - slides in when a card is selected */}
      {selected && (
        <div
          className="absolute bottom-0 inset-x-0 z-20 mx-auto max-w-md rounded-t-xl border border-charcoal/10 bg-white/90 backdrop-blur-md p-4 shadow-xl"
          style={{ animation: "slideUp 0.35s ease-out" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-lg font-semibold text-charcoal">{selected.title}</h3>
              <p className="mt-0.5 text-xs text-charcoal/50">ID: {selected.id}</p>
            </div>
            <button
              onClick={handleClose}
              className="rounded-full border border-charcoal/15 bg-cream px-3 py-1 text-xs font-medium text-charcoal/70 hover:bg-charcoal/5 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
