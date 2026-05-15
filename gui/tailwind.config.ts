import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: "#F8F4EC", dark: "#F0EBE0" },
        surface: "#FCFAF6",
        teal: {
          DEFAULT: "#0B7B8A",
          50: "#E6F1F3",
          100: "#C2DCE0",
          600: "#0B7B8A",
          700: "#08646F",
        },
        charcoal: "#1A1A1A",
        stone: "#78716C",
        gold: { DEFAULT: "#D4A843", light: "#D4A8431A" },
        sage: { DEFAULT: "#8DA67E", light: "#8DA67E1A" },
        amber: { DEFAULT: "#D49B43", light: "#D49B431A" },
        rose: { DEFAULT: "#C97373", light: "#C973731A" },
        // Legacy aliases
        mustard: "#D4A843",
        soft_red: "#C97373",
      },
      fontFamily: {
        display: [
          "'Plus Jakarta Sans'",
          "'Inter Tight'",
          "system-ui",
          "sans-serif",
        ],
        serif: [
          "'Plus Jakarta Sans'",
          "Georgia",
          "serif",
        ],
        body: [
          "'Inter Tight'",
          "'Inter'",
          "system-ui",
          "sans-serif",
        ],
        sans: [
          "'Inter Tight'",
          "'Inter'",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "'JetBrains Mono'",
          "'SF Mono'",
          "'Fira Code'",
          "monospace",
        ],
      },
      boxShadow: {
        subtle:
          "0 1px 3px rgba(26,26,26,0.03), 0 1px 2px rgba(26,26,26,0.02)",
        card: "0 2px 8px rgba(26,26,26,0.04), 0 1px 3px rgba(26,26,26,0.02)",
        elevated:
          "0 4px 16px rgba(26,26,26,0.06), 0 2px 6px rgba(26,26,26,0.03)",
        overlay:
          "0 8px 32px rgba(26,26,26,0.10), 0 4px 12px rgba(26,26,26,0.05)",
        drawer:
          "-4px 0 24px rgba(26,26,26,0.08), -2px 0 8px rgba(26,26,26,0.04)",
      },
      borderRadius: {
        card: "12px",
        panel: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
