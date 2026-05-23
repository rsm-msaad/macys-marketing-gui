import { PersonaShell } from "@/components/PersonaShell";

export default function ThalesPage() {
  return (
    <PersonaShell
      personaId="thales"
      headline="Co-CEO · Prof. Thales"
      subhead="Full visibility across every workflow step. Can approve, edit, or override any action at any stage."
      leftNav={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "All Campaigns", href: "/campaigns" },
        { label: "All Steps", href: "/analytics" },
        { label: "Overrides", href: "/dashboard#escalations" },
      ]}
      skills={["segment", "sku-recommend", "dam", "layout-copy", "localize", "analyze"]}
    />
  );
}
