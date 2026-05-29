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
        teal: {
          DEFAULT: "#0B7B8A",
          50: "#E6F1F3",
          100: "#C2DCE0",
          200: "#99CDD4",
          300: "#66B5BF",
          400: "#33A0AC",
          500: "#0B7B8A",
          600: "#0B7B8A",
          700: "#08646F",
          800: "#054D55",
          900: "#03363B",
        },
        cream: "#F8F4EC",
        charcoal: "#2D2D2D",
        mustard: "#D4A537",
        sage: "#87A96B",
        soft_red: "#C84B4B",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "ui-serif", "serif"],
        serif: ["var(--font-fraunces)", "Georgia", "Cambria", "ui-serif", "serif"],
        sans: [
          "var(--font-inter)",
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
