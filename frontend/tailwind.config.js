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
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%": { transform: "translateY(-12px) rotate(1deg)" },
        },
        "float-reverse": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%": { transform: "translateY(12px) rotate(-1deg)" },
        },
        "blob-pulse": {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)", opacity: "0.35" },
          "33%": { transform: "translate(30px, -45px) scale(1.18)", opacity: "0.55" },
          "66%": { transform: "translate(-25px, 25px) scale(0.92)", opacity: "0.4" },
        },
        "blob-pulse-slow": {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)", opacity: "0.3" },
          "33%": { transform: "translate(-35px, 35px) scale(1.2)", opacity: "0.5" },
          "66%": { transform: "translate(30px, -30px) scale(0.9)", opacity: "0.35" },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4", filter: "blur(40px)" },
          "50%": { opacity: "0.75", filter: "blur(55px)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-reverse": "float-reverse 7s ease-in-out infinite",
        "blob-pulse": "blob-pulse 10s ease-in-out infinite",
        "blob-pulse-slow": "blob-pulse-slow 14s ease-in-out infinite",
        "gradient-shift": "gradient-shift 6s ease infinite",
        "glow-pulse": "glow-pulse 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
