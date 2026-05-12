"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Sparkles } from "lucide-react";

import { API_BASE } from "@/lib/api";
import { ActionFooter, ContextStack, type StepContentProps } from "./shared";

const HERO_PICKS = [
  { label: "Spring Beauty editorial photo (4K, free rights)", query: "spring beauty editorial" },
  { label: "Lipstick close up flatlay (HD, free rights)", query: "lipstick flatlay cosmetics" },
  { label: "Mothers Day gift set lifestyle shot (4K, free rights)", query: "gift set beauty" },
  { label: "Skincare hero on cream backdrop (4K, free rights)", query: "skincare product cream" },
  { label: "Beauty counter in store still (HD, restricted to in store use)", query: "beauty counter store" },
  { label: "Mascara application close up (HD, free rights)", query: "mascara beauty close up" },
];

type ThumbData = {
  image_url: string;
  photographer: string;
  photographer_url: string;
};

function useDamThumbnails() {
  const [thumbs, setThumbs] = useState<Record<string, ThumbData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results: Record<string, ThumbData> = {};
      for (const pick of HERO_PICKS) {
        if (cancelled) return;
        try {
          const res = await fetch(
            `${API_BASE}/api/images/hero?query=${encodeURIComponent(pick.query)}`,
          );
          if (res.ok) {
            const data = await res.json();
            results[pick.query] = {
              image_url: data.image_url,
              photographer: data.photographer,
              photographer_url: data.photographer_url,
            };
          }
        } catch {
          /* skip failed thumbnails */
        }
      }
      if (!cancelled) {
        setThumbs(results);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { thumbs, loading };
}

export function CreativeProductionContent({
  context,
  canAct,
  busy,
  onApprove,
  onLaunchSkill,
}: StepContentProps) {
  const { thumbs, loading: thumbsLoading } = useDamThumbnails();

  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
            Skill: DAM Asset Finder
          </span>
        </div>
        <p className="text-sm text-charcoal/70">
          Filter the 5,000 asset DAM down to clean, on brief candidates,
          ranked by tag relevance with photo backed assets bucketed first so
          the thumbnail grid renders real images.
        </p>

        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {HERO_PICKS.map((pick) => {
            const thumb = thumbs[pick.query];
            return (
              <div
                key={pick.query}
                className="overflow-hidden rounded-md border border-charcoal/10 bg-cream/30"
              >
                {thumbsLoading ? (
                  <div className="aspect-video animate-pulse bg-charcoal/10" />
                ) : thumb ? (
                  <div className="relative aspect-video bg-cream">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb.image_url}
                      alt={pick.label}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute bottom-0.5 right-0.5 rounded bg-charcoal/50 px-1 py-px text-[8px] text-white/80">
                      <a
                        href={`${thumb.photographer_url}?utm_source=macys_ops&utm_medium=referral`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {thumb.photographer}
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-cream/50">
                    <ImageIcon className="h-6 w-6 text-charcoal/25" />
                  </div>
                )}
                <div className="flex items-start gap-2 px-3 py-2 text-[12px] text-charcoal/80">
                  <ImageIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-teal-600" />
                  {pick.label}
                </div>
              </div>
            );
          })}
        </div>

        {canAct && (
          <button
            type="button"
            onClick={() => onLaunchSkill("dam")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-teal-600 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
          >
            Open the skill to browse all ranked assets
          </button>
        )}
      </div>

      <ActionFooter
        canAct={canAct}
        busy={busy}
        cta="Approve hero assets"
        ctaKind="approve"
        stepNumber={4}
        onClick={() =>
          onApprove("Approve Assets", {
            approved_asset_count: HERO_PICKS.length,
          })
        }
      />
    </div>
  );
}
