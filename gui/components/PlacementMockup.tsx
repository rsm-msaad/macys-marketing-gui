"use client";

import { useState } from "react";
import { X, Maximize2 } from "lucide-react";

import { API_BASE } from "@/lib/api";

/**
 * Renders an ad-style visual mockup: real DAM photo background with
 * AI-generated copy overlaid in bold marketing style.
 */

type PlacementType = "web_banner" | "email" | "mobile" | "in_store_signage";

const PLACEMENT_CONFIG: Record<PlacementType, {
  label: string;
  dimensions: string;
  aspectClass: string;  // Tailwind aspect ratio
  taglineSize: string;
  bodySize: string;
}> = {
  web_banner: {
    label: "Web Banner",
    dimensions: "1200x628",
    aspectClass: "aspect-[1200/628]",
    taglineSize: "text-2xl md:text-3xl",
    bodySize: "text-sm",
  },
  email: {
    label: "Email",
    dimensions: "600x800",
    aspectClass: "aspect-[600/800]",
    taglineSize: "text-xl md:text-2xl",
    bodySize: "text-xs",
  },
  mobile: {
    label: "Mobile",
    dimensions: "414x896",
    aspectClass: "aspect-[414/896]",
    taglineSize: "text-lg md:text-xl",
    bodySize: "text-xs",
  },
  in_store_signage: {
    label: "In-Store Signage",
    dimensions: "1080x1920",
    aspectClass: "aspect-[1080/1920]",
    taglineSize: "text-xl md:text-2xl",
    bodySize: "text-xs",
  },
};

export function PlacementMockup({
  placement,
  copy,
  assetFilename,
  assetId,
}: {
  placement: PlacementType;
  copy: { tagline: string; body: string; cta: string; visual_direction: string };
  assetFilename: string | null;
  assetId: number | null;
}) {
  const [enlarged, setEnlarged] = useState(false);
  const config = PLACEMENT_CONFIG[placement] ?? PLACEMENT_CONFIG.web_banner;
  const imgUrl = assetFilename ? `${API_BASE}/images/dam/${assetFilename}` : null;

  const mockupContent = (
    <div className={`relative ${config.aspectClass} w-full overflow-hidden rounded-lg bg-charcoal/10`}>
      {/* Background photo */}
      {imgUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgUrl}
          alt="Campaign visual"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      )}
      {/* Dark gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/15" />

      {/* Copy overlay */}
      <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-6">
        {/* Tagline */}
        <h3 className={`${config.taglineSize} font-serif font-bold leading-tight text-white`} style={{ textShadow: "0 2px 8px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)" }}>
          {copy.tagline}
        </h3>
        {/* Body */}
        <p className={`mt-1.5 ${config.bodySize} leading-relaxed text-white/95 font-medium`} style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
          {copy.body}
        </p>
        {/* CTA button */}
        <div className="mt-3">
          <span className="inline-block rounded-md bg-white px-4 py-1.5 text-xs font-semibold text-teal-700 shadow-lg">
            {copy.cta}
          </span>
        </div>
      </div>

      {/* Placement label badge */}
      <div className="absolute left-3 top-3 rounded bg-black/50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-white/80 backdrop-blur-sm">
        {config.label} · {config.dimensions}
      </div>

      {/* Enlarge button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setEnlarged(true); }}
        className="absolute right-3 top-3 rounded bg-black/40 p-1.5 text-white/70 backdrop-blur-sm hover:bg-black/60 hover:text-white"
        title="Enlarge"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div>
      {mockupContent}

      {/* Asset caption */}
      <div className="mt-1.5 flex items-center justify-between text-xs text-charcoal/40">
        {assetId != null ? (
          <span>Asset: DAM-{String(assetId).padStart(5, "0")}</span>
        ) : (
          <span>No DAM photo available</span>
        )}
      </div>

      {/* Visual direction from AI */}
      {copy.visual_direction && (
        <p className="mt-1 text-xs italic text-charcoal/45">
          Designer brief: {copy.visual_direction}
        </p>
      )}

      {/* Enlarged modal */}
      {enlarged && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setEnlarged(false)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center">
            <div className="relative max-h-full max-w-3xl overflow-auto">
              <button
                type="button"
                onClick={() => setEnlarged(false)}
                className="absolute -right-2 -top-2 z-10 rounded-full bg-white p-1.5 shadow-lg"
              >
                <X className="h-4 w-4 text-charcoal" />
              </button>
              {mockupContent}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Given approved asset IDs from Step 4, fetch the filenames and pick
 * one per placement. Returns a map of placement → {asset_id, filename}.
 *
 * Called client-side — fetches from the DAM search endpoint to get
 * asset details for the approved IDs.
 */
export function selectPlacementAssets(
  approvedAssets: Array<{ asset_id: number; filename: string; has_photo?: boolean }>,
): Record<PlacementType, { asset_id: number; filename: string } | null> {
  // Filter to only photo-backed assets
  const withPhotos = approvedAssets.filter((a) => a.has_photo !== false);
  const pool = withPhotos.length > 0 ? withPhotos : approvedAssets;

  // Simple round-robin assignment — one asset per placement
  const placements: PlacementType[] = ["web_banner", "email", "mobile", "in_store_signage"];
  const result: Record<string, { asset_id: number; filename: string } | null> = {};

  for (let i = 0; i < placements.length; i++) {
    if (pool.length > 0) {
      const asset = pool[i % pool.length];
      result[placements[i]] = { asset_id: asset.asset_id, filename: asset.filename };
    } else {
      result[placements[i]] = null;
    }
  }

  return result as Record<PlacementType, { asset_id: number; filename: string } | null>;
}
