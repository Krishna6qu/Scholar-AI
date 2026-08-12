/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: {
          950: "#050507",
          900: "#0B0B10",
          800: "#121218",
          700: "#1B1B24",
          600: "#26262F",
          400: "#54545F",
          300: "#7A7A87",
          200: "#9A9AA6",
          100: "#D4D4DC",
        },
        neon: {
          violet: "#A855F7",
          cyan: "#22D3EE",
          pink: "#F472B6",
          lime: "#A3E635",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      backgroundImage: {
        "neon-glow":
          "radial-gradient(circle at 20% 20%, rgba(168,85,247,0.25), transparent 40%), radial-gradient(circle at 80% 0%, rgba(34,211,238,0.2), transparent 40%), radial-gradient(circle at 50% 100%, rgba(244,114,182,0.15), transparent 40%)",
      },
      boxShadow: {
        "neon-violet": "0 0 24px 0 rgba(168,85,247,0.35)",
        "neon-cyan": "0 0 24px 0 rgba(34,211,238,0.3)",
      },
    },
  },
  plugins: [],
};
