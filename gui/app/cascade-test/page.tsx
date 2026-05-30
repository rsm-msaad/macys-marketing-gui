"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClouCascade, type ClouItem } from "@/components/ClouCascade";

const TEST_ITEMS: ClouItem[] = [
  {
    id: "1",
    image: "/storyboard/scenes/01_what_is_skill.jpg",
    title: "AI Skills Architecture",
    tag: "Architecture",
    metadata: { Sector: "Marketing", Status: "Active", Scope: "Enterprise", Year: "2026" },
  },
  {
    id: "2",
    image: "/storyboard/scenes/09_master_ad.jpg",
    title: "Master Ad Layout",
    tag: "Creative",
    metadata: { Sector: "Design", Status: "Complete", Scope: "Campaign", Year: "2026" },
  },
  {
    id: "3",
    image: "/storyboard/scenes/12_handoff_to_production.jpg",
    title: "Handoff to Production",
    tag: "Operations",
    metadata: { Sector: "Production", Status: "Active", Scope: "Team", Year: "2026" },
  },
  {
    id: "4",
    image: "/storyboard/scenes/16_live.jpg",
    title: "Campaign Goes Live",
    tag: "Distribution",
    metadata: { Sector: "Marketing", Status: "Live", Scope: "30M Members", Year: "2026" },
  },
  {
    id: "5",
    image: "/storyboard/scenes/17_data_analysis.jpg",
    title: "Performance Analysis",
    tag: "Analytics",
    metadata: { Sector: "Data", Status: "Monitoring", Scope: "KPIs", Year: "2026" },
  },
  {
    id: "6",
    image: "/storyboard/scenes/19_cycle_complete.jpg",
    title: "Cycle Complete",
    tag: "Reporting",
    metadata: { Sector: "Operations", Status: "Complete", Scope: "Full Cycle", Year: "2026" },
  },
  {
    id: "7",
    image: "/storyboard/scenes/31_rady_what_if.jpg",
    title: "What-If Scenario",
    tag: "Strategy",
    metadata: { Sector: "Planning", Status: "Simulation", Scope: "Forecast", Year: "2026" },
  },
  {
    id: "8",
    image: "/storyboard/scenes/38_m3_cascade.jpg",
    title: "M3 Cascade Pipeline",
    tag: "Engineering",
    metadata: { Sector: "AI Engine", Status: "Active", Scope: "4 Skills", Year: "2026" },
  },
];

export default function CascadeTestPage() {
  return (
    <div className="min-h-screen bg-[#f5f3ee]">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-charcoal/10">
        <Link href="/" className="flex items-center gap-1.5 text-xs text-charcoal/60 hover:text-charcoal transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <div className="h-4 w-px bg-charcoal/15" />
        <h1 className="font-serif text-lg font-semibold text-charcoal">CLOU Cascade - Test</h1>
      </header>

      <div className="px-6 sm:px-12 py-10">
        <ClouCascade items={TEST_ITEMS} />
      </div>
    </div>
  );
}
