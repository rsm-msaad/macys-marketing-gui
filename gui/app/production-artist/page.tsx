import { PersonaShell } from "@/components/PersonaShell";

export default function ProductionArtistPage() {
  return (
    <PersonaShell
      personaId="production-artist"
      headline="Production Artist · Shankar"
      subhead="You spin up 40 regional variants per master ad. The skill handles regional pricing, regional inventory, and regionally voiced copy in one shot."
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
