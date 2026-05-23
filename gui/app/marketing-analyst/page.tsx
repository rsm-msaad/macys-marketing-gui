import { PersonaShell } from "@/components/PersonaShell";

export default function MarketingAnalystPage() {
  return (
    <PersonaShell
      personaId="marketing-analyst"
      headline="Marketing Analyst · Anna"
      subhead="You pull the numbers, attribute revenue, and draft the readout. The skill produces attribution + a 14 day forecast; you add business context."
      leftNav={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Campaigns" },
        { label: "Reports" },
        { label: "Forecasts" },
      ]}
      skills={["segment", "sku-recommend", "dam", "layout-copy", "localize", "analyze"]}
    />
  );
}
