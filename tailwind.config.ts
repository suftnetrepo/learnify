import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'] as ["class", string],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette — deep navy + electric indigo + warm amber
        brand: {
          50:  "#f0f0ff",
          100: "#e3e3ff",
          200: "#c8c8ff",
          300: "#a5a5fc",
          400: "#8080f8",
          500: "#6366f1", // primary
          600: "#4f46e5",
          700: "#3d35cc",
          800: "#2e27a4",
          900: "#1e1a7a",
          950: "#120f52",
        },
        accent: {
          50:  "#fffbeb",
          100: "#fef3c7",
          400: "#fbbf24",
          500: "#f59e0b", // amber accent
          600: "#d97706",
        },
        surface: {
          0:   "#ffffff",
          50:  "#f8f8fc",
          100: "#f1f1f8",
          200: "#e4e4ef",
          800: "#1e1e2e",
          900: "#13131f",
          950: "#0a0a14",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "var(--font-inter)", "sans-serif"],
        mono: ["var(--font-fira-code)", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        "glow-brand": "0 0 24px rgba(99,102,241,0.35)",
        "glow-accent": "0 0 24px rgba(245,158,11,0.35)",
        "card": "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)",
        "card-hover": "0 4px 8px rgba(0,0,0,0.08), 0 16px 40px rgba(0,0,0,0.10)",
      },
      animation: {
        "fade-up": "fade-up 0.5s ease forwards",
        "fade-in": "fade-in 0.3s ease forwards",
        "shimmer": "shimmer 1.8s linear infinite",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      backgroundImage: {
        "gradient-brand":
          "linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #3d35cc 100%)",
        "gradient-hero":
          "linear-gradient(160deg, #0a0a14 0%, #13131f 60%, #1e1a7a 100%)",
        "shimmer-gradient":
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
