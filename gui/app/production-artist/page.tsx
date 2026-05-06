import { PersonaShell } from "@/components/PersonaShell";

export default function ProductionArtistPage() {
  return (
    <PersonaShell
      personaId="production-artist"
      headline="Production Artist · Diego"
      subhead="You spin up 40 regional variants per master ad. The skill handles regional pricing, regional inventory, and regionally voiced copy in one shot."
      leftNav={[
        { label: "Dashboard", active: true },
        { label: "Variants" },
        { label: "Master Ads" },
        { label: "Traffic Handoff" },
      ]}
      skills={["localize"]}
    />
  );
}
