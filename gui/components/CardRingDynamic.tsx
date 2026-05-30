"use client";

import dynamic from "next/dynamic";

export const CardRingDynamic = dynamic(
  () => import("./CardRing").then((mod) => mod.CardRing),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[480px] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <span className="text-xs text-charcoal/50 font-medium">Loading 3D gallery...</span>
        </div>
      </div>
    ),
  }
);
