"use client";

import { useEffect, useState } from "react";

import { fetchHeroImage, type HeroImage } from "@/lib/api";

export function HeroBanner({
  category,
  audience,
}: {
  category: string;
  audience: string;
}) {
  const [hero, setHero] = useState<HeroImage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchHeroImage(category, audience)
      .then((data) => {
        if (!cancelled) setHero(data);
      })
      .catch(() => {
        /* graceful fallback: just hide the banner */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category, audience]);

  if (loading) {
    return (
      <div className="mb-4 h-48 animate-pulse rounded-lg bg-charcoal/10" />
    );
  }

  if (!hero) return null;

  return (
    <div className="relative mb-4 overflow-hidden rounded-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hero.image_url}
        alt={hero.alt}
        className="h-48 w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />
      <div className="absolute bottom-2 right-2 rounded bg-charcoal/50 px-2 py-0.5 text-xs text-white/80">
        Photo by{" "}
        <a
          href={`${hero.photographer_url}?utm_source=macys_ops&utm_medium=referral`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {hero.photographer}
        </a>{" "}
        on{" "}
        <a
          href="https://unsplash.com?utm_source=macys_ops&utm_medium=referral"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Unsplash
        </a>
      </div>
    </div>
  );
}
