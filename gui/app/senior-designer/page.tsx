import { PersonaShell } from "@/components/PersonaShell";

export default function SeniorDesignerPage() {
  return (
    <PersonaShell
      personaId="senior-designer"
      headline="Senior Designer · Priya"
      subhead="You search the DAM, pick the hero photos, and own the layout. The skill filters out degraded assets so you do not scroll through 800 results."
      leftNav={[
        { label: "Dashboard", active: true },
        { label: "DAM Search" },
        { label: "Layouts" },
        { label: "Brand Review" },
      ]}
      skills={["dam"]}
    />
  );
}
