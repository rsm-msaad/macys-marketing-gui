// Persona specific suggested prompts and skill action wiring.
// The actual scripted reply logic lives on the FastAPI backend; this file
// just enumerates the suggested chips that show above the chat input and
// describes which `action` keys map to which skill modal.

export type SuggestedPrompt = string;

export const SUGGESTED_PROMPTS: Record<string, SuggestedPrompt[]> = {
  "campaign-manager": [
    "Build me an audience for the Mother's Day Beauty Event",
    "What campaigns are live right now?",
    "What should I focus on today?",
  ],
  "senior-designer": [
    "Find me hero photos for the Mother's Day Beauty Event",
    "What's blocked in my queue?",
    "Show me clean DAM assets for spring",
  ],
  "production-artist": [
    "Generate regional variants for the Mother's Day Beauty Event",
    "Which variant batches are ready to ship?",
    "Spin up localized copy for the master ad",
  ],
  "marketing-analyst": [
    "Analyze the Fall Style Edit campaign",
    "What's the top channel by ROAS?",
    "What does the next 14 day forecast look like?",
  ],
};

export const ACTION_TO_SKILL: Record<string, "segment" | "dam" | "localize" | "analyze"> = {
  run_segment: "segment",
  run_dam: "dam",
  run_localize: "localize",
  run_analyze: "analyze",
};
