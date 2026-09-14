import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        rudra: "var(--rudra-orange)",
        obsidian: "var(--obsidian)",
        ash: "var(--sacred-ash)",
        success: "var(--success)",
        danger: "var(--danger)",
        surface: "var(--surface)",
        border: "var(--border)",
        muted: "var(--muted)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
