/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: {
          950: "#07070B",
          900: "#101018",
          800: "#181826",
          700: "#252538",
          600: "#35354E",
          500: "#484866",
          400: "#8E8EA8",
          300: "#B4B4C8",
          200: "#D8D8E6",
          100: "#F2F2F8",
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
          "radial-gradient(circle at 20% 20%, rgba(168,85,247,0.08), transparent 50%), radial-gradient(circle at 80% 0%, rgba(34,211,238,0.06), transparent 50%), radial-gradient(circle at 50% 100%, rgba(244,114,182,0.04), transparent 50%)",
      },
      boxShadow: {
        "neon-violet": "0 0 24px 0 rgba(168,85,247,0.35)",
        "neon-cyan": "0 0 24px 0 rgba(34,211,238,0.3)",
        "glow-violet": "0 0 40px -10px rgba(168,85,247,0.3)",
        "glow-cyan": "0 0 40px -10px rgba(34,211,238,0.3)",
        "glow-pink": "0 0 40px -10px rgba(244,114,182,0.3)",
        "glow-lime": "0 0 40px -10px rgba(163,230,53,0.3)",
        "glass-inner": "inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%": { transform: "translateY(-10px) rotate(0.5deg)" },
        },
        "float-reverse": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%": { transform: "translateY(10px) rotate(-0.5deg)" },
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
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-reverse": "float-reverse 7s ease-in-out infinite",
        "blob-pulse": "blob-pulse 10s ease-in-out infinite",
        "blob-pulse-slow": "blob-pulse-slow 14s ease-in-out infinite",
        "gradient-shift": "gradient-shift 6s ease infinite",
        "glow-pulse": "glow-pulse 5s ease-in-out infinite",
        shimmer: "shimmer 2.5s infinite",
        "pulse-subtle": "pulse-subtle 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
