import { PersonaShell } from "@/components/PersonaShell";

export default function CeoPage() {
  return (
    <PersonaShell
      personaId="ceo"
      headline="CEO · Prof. Vincent"
      subhead="Full visibility across every workflow step. Can approve, edit, or override any action at any stage."
      leftNav={[
        { label: "Dashboard", active: true },
        { label: "All Campaigns" },
        { label: "All Steps" },
        { label: "Overrides" },
      ]}
      skills={["segment", "sku-recommend", "dam", "layout-copy", "localize", "analyze"]}
    />
  );
}
