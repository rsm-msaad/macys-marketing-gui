import { PersonaShell } from "@/components/PersonaShell";

export default function SeniorDesignerPage() {
  return (
    <PersonaShell
      personaId="senior-designer"
      headline="Senior Designer · Abdullah"
      subhead="You search the DAM, pick the hero photos, and own the layout. The skill filters out degraded assets so you do not scroll through 800 results."
      leftNav={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Campaigns", href: "/campaigns" },
        { label: "Segments", href: "/segments" },
        { label: "Analytics", href: "/analytics" },
      ]}
      skills={["segment", "sku-recommend", "dam", "layout-copy", "localize", "analyze"]}
    />
  );
}
