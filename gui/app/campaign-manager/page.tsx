import { PersonaShell } from "@/components/PersonaShell";

export default function CampaignManagerPage() {
  return (
    <PersonaShell
      personaId="campaign-manager"
      headline="Campaign Manager · Merna"
      subhead="You own the brief, build the audience, pick the SKUs, and shepherd the campaign through Brand and Legal review."
      leftNav={[
        { label: "Dashboard", active: true },
        { label: "Campaigns" },
        { label: "Segments" },
        { label: "Analytics" },
      ]}
      skills={["segment", "sku-recommend", "dam", "layout-copy", "localize", "analyze"]}
    />
  );
}
