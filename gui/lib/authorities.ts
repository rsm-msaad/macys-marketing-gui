// Authority matrix for the demo workflow.
//
// The display "owner" string for steps 1, 6, and 8 names the real-world role
// (Marketing Leadership, VP+Legal, Media Coordinator). For demo flow we
// designate Merna (campaign-manager) as the proxy, so she is the persona
// who can actually click the action button.

export type PersonaId =
  | "campaign-manager"
  | "senior-designer"
  | "production-artist"
  | "marketing-analyst"
  | "ceo"
  | "thales";

type Authority = {
  ownerPersonaId: PersonaId;
  ownerDisplay: string; // for "Waiting on X" messaging
  ownerTitle: string;
};

export const STEP_AUTHORITIES: Record<number, Authority> = {
  1: {
    ownerPersonaId: "campaign-manager",
    ownerDisplay: "Merna",
    ownerTitle: "Campaign Manager (proxy for Marketing Leadership)",
  },
  2: {
    ownerPersonaId: "campaign-manager",
    ownerDisplay: "Merna",
    ownerTitle: "Campaign Manager",
  },
  3: {
    ownerPersonaId: "campaign-manager",
    ownerDisplay: "Merna",
    ownerTitle: "Campaign Manager",
  },
  4: {
    ownerPersonaId: "senior-designer",
    ownerDisplay: "Abdullah",
    ownerTitle: "Senior Designer",
  },
  5: {
    ownerPersonaId: "senior-designer",
    ownerDisplay: "Abdullah",
    ownerTitle: "Senior Designer",
  },
  6: {
    ownerPersonaId: "campaign-manager",
    ownerDisplay: "Merna",
    ownerTitle: "Campaign Manager (proxy for VP + Legal)",
  },
  7: {
    ownerPersonaId: "production-artist",
    ownerDisplay: "Shankar",
    ownerTitle: "Production Artist",
  },
  8: {
    ownerPersonaId: "campaign-manager",
    ownerDisplay: "Merna",
    ownerTitle: "Campaign Manager (proxy for Media Coordinator)",
  },
  9: {
    ownerPersonaId: "marketing-analyst",
    ownerDisplay: "Anna",
    ownerTitle: "Marketing Analyst",
  },
  10: {
    ownerPersonaId: "marketing-analyst",
    ownerDisplay: "Anna",
    ownerTitle: "Marketing Analyst",
  },
};

export function isStepOwnedBy(stepNumber: number, personaId: string): boolean {
  // Either co-CEO can act on every step.
  if (personaId === "ceo" || personaId === "thales") return true;
  const a = STEP_AUTHORITIES[stepNumber];
  return a !== undefined && a.ownerPersonaId === personaId;
}

export function getStepOwner(stepNumber: number): PersonaId | null {
  return STEP_AUTHORITIES[stepNumber]?.ownerPersonaId ?? null;
}

export function getStepOwnerName(stepNumber: number): string {
  return STEP_AUTHORITIES[stepNumber]?.ownerDisplay ?? "the assigned owner";
}

export function getStepOwnerTitle(stepNumber: number): string {
  return STEP_AUTHORITIES[stepNumber]?.ownerTitle ?? "Unknown";
}
