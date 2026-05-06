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
        // Macy's marketing operations palette.
        teal: {
          DEFAULT: "#0B7B8A",
          50: "#E6F1F3",
          100: "#C2DCE0",
          600: "#0B7B8A",
          700: "#08646F",
        },
        cream: "#F8F4EC",
        charcoal: "#2D2D2D",
        mustard: "#D4A537",
        sage: "#87A96B",
        soft_red: "#C84B4B",
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "ui-serif", "serif"],
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
