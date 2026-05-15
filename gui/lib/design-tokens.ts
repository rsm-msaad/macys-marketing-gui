/**
 * Design tokens for the Macys Marketing Operations editorial UI.
 *
 * Aesthetic: Vogue meets Stripe. Warm, refined, intentional.
 * Display: Bodoni Moda (high contrast serif, magazine feel)
 * Body: Inter Tight (modern, refined sans)
 * AI content: italic serif or gold accent to distinguish from human content
 */

export const colors = {
  cream: "#F8F4EC",
  creamDark: "#F0EBE0",
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
  charcoal: "#2C2C2C",
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
  display: "'Bodoni Moda', 'Playfair Display', Georgia, serif",
  body: "'Inter Tight', 'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
} as const;

export const shadows = {
  subtle: "0 1px 3px rgba(44, 44, 44, 0.04), 0 1px 2px rgba(44, 44, 44, 0.02)",
  card: "0 2px 8px rgba(44, 44, 44, 0.05), 0 1px 3px rgba(44, 44, 44, 0.03)",
  elevated: "0 4px 16px rgba(44, 44, 44, 0.08), 0 2px 6px rgba(44, 44, 44, 0.04)",
  overlay: "0 8px 32px rgba(44, 44, 44, 0.12), 0 4px 12px rgba(44, 44, 44, 0.06)",
} as const;

export const radii = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  pill: "9999px",
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
} as const;

/** Badge color presets for skill vs automation and status indicators */
export const badges = {
  skill: { bg: "#0B7B8A1A", text: "#0B7B8A", dot: "#0B7B8A" },
  automation: { bg: "#78716C1A", text: "#57534E", dot: "#78716C" },
  pass: { bg: "#8DA67E1A", text: "#6B8A5E" },
  warn: { bg: "#D49B431A", text: "#B8842E" },
  fail: { bg: "#C973731A", text: "#B55A5A" },
  ai: { bg: "#D4A8431A", text: "#B8922E", border: "#D4A84340" },
} as const;
