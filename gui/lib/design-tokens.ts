/**
 * Design tokens for the Macys Marketing Operations UI.
 *
 * Aesthetic: Bold Brand. Stripe meets Mercury meets Pitch.
 * Confident typography, generous whitespace, asymmetric layout.
 *
 * Display: Plus Jakarta Sans (bold, modern, characterful)
 * Body: Inter Tight (clean, comfortable reading)
 * AI content: gold left border accent, not italic serif
 */

export const colors = {
  cream: "#F8F4EC",
  surface: "#FCFAF6",
  teal: {
    DEFAULT: "#0B7B8A",
    light: "#E6F1F3",
    muted: "#0B7B8A1A",
    hover: "#08646F",
  },
  gold: {
    DEFAULT: "#D4A843",
    light: "#D4A8431A",
    muted: "#D4A84330",
  },
  charcoal: "#1A1A1A",
  stone: "#78716C",
  sage: {
    DEFAULT: "#8DA67E",
    light: "#8DA67E1A",
  },
  amber: {
    DEFAULT: "#D49B43",
    light: "#D49B431A",
  },
  rose: {
    DEFAULT: "#C97373",
    light: "#C973731A",
  },
  white: "#FFFFFF",
} as const;

export const fonts = {
  display: "'Plus Jakarta Sans', 'Inter Tight', system-ui, sans-serif",
  body: "'Inter Tight', 'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
} as const;

export const badges = {
  skill: { bg: "#0B7B8A1A", text: "#0B7B8A", dot: "#0B7B8A" },
  automation: { bg: "#78716C1A", text: "#57534E", dot: "#78716C" },
  pass: { bg: "#8DA67E1A", text: "#6B8A5E" },
  warn: { bg: "#D49B431A", text: "#B8842E" },
  fail: { bg: "#C973731A", text: "#B55A5A" },
  ai: { bg: "#D4A8431A", text: "#B8922E", border: "#D4A84340" },
} as const;
