"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

import { API_BASE } from "@/lib/api";

type Segment = {
  name: string;
  customer_count: number;
  pct_of_total: number;
  top_category: string | null;
  top_category_lift: number;
  avg_recency_days: number;
  avg_frequency: number;
  avg_monetary: number;
  definition: string;
  loyalty_mix: Record<string, number>;
  used_by_campaigns: string[];
};

type SegmentsData = {
  segments: Segment[];
  total_customers: number;
  methodology: string;
};

const SEGMENT_COLORS = [
  { border: "border-teal-300/50", bg: "bg-teal-50/30", accent: "text-teal-700" },
  { border: "border-amber-300/50", bg: "bg-amber-50/30", accent: "text-amber-700" },
  { border: "border-violet-300/50", bg: "bg-violet-50/30", accent: "text-violet-700" },
];

export default function SegmentsPage() {
  const [data, setData] = useState<SegmentsData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/segments/overview`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream/30">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream/30">
      <div className="border-b border-charcoal/10 bg-white px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-600 hover:text-teal-700 mb-2">
            <ArrowLeft className="h-3 w-3" /> Back
          </Link>
          <h1 className="font-serif text-2xl font-bold text-charcoal">Customer Segments</h1>
          <p className="mt-1 text-[13px] text-charcoal/60">
            {data.total_customers.toLocaleString()} customers segmented via k-means RFM clustering into 3 behavior-based groups.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        {/* Segment cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {data.segments.map((seg, i) => {
            const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
            const tiers = Object.entries(seg.loyalty_mix).sort(([, a], [, b]) => b - a);
            return (
              <div key={seg.name} className={`rounded-lg border ${color.border} ${color.bg} p-5`}>
                <div className="flex items-start justify-between">
                  <div>
                    <Users className={`h-5 w-5 ${color.accent}`} />
                    <h3 className={`mt-2 font-serif text-lg font-bold ${color.accent}`}>{seg.name}</h3>
                  </div>
                  <div className="text-right">
                    <div className="font-serif text-xl font-bold text-charcoal">{seg.customer_count.toLocaleString()}</div>
                    <div className="text-[10px] text-charcoal/50">{seg.pct_of_total}% of total</div>
                  </div>
                </div>

                <p className="mt-2 text-[11px] leading-relaxed text-charcoal/65">{seg.definition}</p>

                {/* RFM metrics */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded border border-charcoal/10 bg-white px-2 py-1.5">
                    <div className="text-[11px] font-semibold text-charcoal">{seg.avg_recency_days}d</div>
                    <div className="text-[9px] text-charcoal/50">Recency</div>
                  </div>
                  <div className="rounded border border-charcoal/10 bg-white px-2 py-1.5">
                    <div className="text-[11px] font-semibold text-charcoal">{seg.avg_frequency.toFixed(1)}x</div>
                    <div className="text-[9px] text-charcoal/50">Frequency</div>
                  </div>
                  <div className="rounded border border-charcoal/10 bg-white px-2 py-1.5">
                    <div className="text-[11px] font-semibold text-charcoal">${seg.avg_monetary.toFixed(0)}</div>
                    <div className="text-[9px] text-charcoal/50">Monetary</div>
                  </div>
                </div>

                {/* Top category */}
                {seg.top_category && (
                  <div className="mt-2 text-[10px] text-charcoal/55">
                    Top category: <strong>{seg.top_category}</strong> (+{(seg.top_category_lift * 100).toFixed(0)}% lift vs avg)
                  </div>
                )}

                {/* Loyalty mix */}
                {tiers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tiers.slice(0, 4).map(([tier, pct]) => (
                      <span key={tier} className="rounded bg-white/70 px-1.5 py-0.5 text-[9px] text-charcoal/50">
                        {tier} {pct}%
                      </span>
                    ))}
                  </div>
                )}

                {/* Used by */}
                {seg.used_by_campaigns.length > 0 && (
                  <div className="mt-3 border-t border-charcoal/5 pt-2 text-[10px] text-charcoal/50">
                    Used by: {seg.used_by_campaigns.join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Methodology */}
        <div className="rounded-lg border border-charcoal/10 bg-white p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-charcoal/50">Methodology</h3>
          <p className="mt-2 text-[12px] leading-relaxed text-charcoal/65">{data.methodology}</p>
          <p className="mt-2 text-[11px] text-charcoal/45">
            Segments are deterministic: same customer data produces the same 3 clusters every time.
            The recommendation engine matches segments to campaigns based on category lift and brief keywords.
          </p>
        </div>
      </div>
    </div>
  );
}
