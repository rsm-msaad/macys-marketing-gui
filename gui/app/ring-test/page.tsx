"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CardRingDynamic } from "@/components/CardRingDynamic";
import type { CardItem } from "@/components/CardRing";

/* Use storyboard scene images as test data */
const TEST_ITEMS: CardItem[] = [
  { id: "1", image: "/storyboard/scenes/01_what_is_skill.jpg", title: "What is a Skill?" },
  { id: "2", image: "/storyboard/scenes/09_master_ad.jpg", title: "Master Ad Layout" },
  { id: "3", image: "/storyboard/scenes/12_handoff_to_production.jpg", title: "Handoff to Production" },
  { id: "4", image: "/storyboard/scenes/16_live.jpg", title: "Campaign Goes Live" },
  { id: "5", image: "/storyboard/scenes/17_data_analysis.jpg", title: "Data Analysis" },
  { id: "6", image: "/storyboard/scenes/19_cycle_complete.jpg", title: "Cycle Complete" },
  { id: "7", image: "/storyboard/scenes/31_rady_what_if.jpg", title: "What If Scenario" },
  { id: "8", image: "/storyboard/scenes/38_m3_cascade.jpg", title: "M3 Cascade" },
  { id: "9", image: "/storyboard/scenes/42_after_team_calm.jpg", title: "Team Retrospective" },
  { id: "10", image: "/avatars/merna.png", title: "Merna - Campaign Manager" },
];

export default function RingTestPage() {
  const [lastSelected, setLastSelected] = useState<CardItem | null>(null);

  return (
    <div className="min-h-screen bg-[#f5f3ee]">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-charcoal/10">
        <Link href="/" className="flex items-center gap-1.5 text-xs text-charcoal/60 hover:text-charcoal transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <div className="h-4 w-px bg-charcoal/15" />
        <h1 className="font-serif text-lg font-semibold text-charcoal">3D Card Ring - Test</h1>
      </header>

      {/* Ring */}
      <div className="px-6 py-8">
        <p className="text-center text-xs text-charcoal/50 mb-4">
          Drag to spin · Click a card to select · Click away to deselect
        </p>
        <CardRingDynamic
          items={TEST_ITEMS}
          onSelect={(item) => setLastSelected(item)}
        />
      </div>

      {/* Debug info */}
      {lastSelected && (
        <div className="mx-auto max-w-md rounded-xl border border-charcoal/10 bg-white p-4 text-center">
          <p className="text-xs text-charcoal/50">Last selected:</p>
          <p className="font-serif text-lg font-semibold text-charcoal">{lastSelected.title}</p>
        </div>
      )}
    </div>
  );
}
