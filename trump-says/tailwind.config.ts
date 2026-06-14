import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        "primary-light": "var(--color-primary-light)",
        accent: {
          gold: "var(--color-accent-gold)",
          "gold-dark": "var(--color-accent-gold-dark)",
        },
        signal: {
          buy: "var(--color-buy)",
          sell: "var(--color-sell)",
          watch: "var(--color-watch)",
          avoid: "var(--color-avoid)",
        },
        bg: "var(--color-bg)",
        "bg-secondary": "var(--color-bg-secondary)",
        "bg-tertiary": "var(--color-bg-tertiary)",
        border: "var(--color-border)",
        text: "var(--color-text)",
        "text-muted": "var(--color-text-muted)",
      },
      fontFamily: {
        serif: "var(--font-serif)",
        mono: "var(--font-mono)",
        sans: "var(--font-sans)",
      },
      spacing: {
        xs: "var(--spacing-xs)",
        sm: "var(--spacing-sm)",
        md: "var(--spacing-md)",
        lg: "var(--spacing-lg)",
        xl: "var(--spacing-xl)",
        "2xl": "var(--spacing-2xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      transitionDuration: {
        fast: "var(--transition-fast)",
        base: "var(--transition-base)",
        slow: "var(--transition-slow)",
      },
      animation: {
        slideDown: "slideDown 0.6s ease-out",
        slideUp: "slideUp 0.6s ease-out",
        fadeIn: "fadeIn 0.6s ease-out",
        priceTick: "priceTick 0.6s ease-out",
      },
      keyframes: {
        slideDown: {
          from: { opacity: "0", transform: "translateY(-20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        priceTick: {
          "0%": { fontWeight: "700" },
          "50%": { fontWeight: "700" },
          "100%": { fontWeight: "600" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
