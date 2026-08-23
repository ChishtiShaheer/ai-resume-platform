/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12141C",
        paper: "#F5F6F8",
        line: "#DDE1E6",
        slate: "#5B6472",
        signal: {
          DEFAULT: "#1D7874",
          light: "#E6F2F1",
        },
        coral: {
          DEFAULT: "#C1443A",
          light: "#FBEAE8",
        },
        amber: {
          DEFAULT: "#B8863C",
          light: "#F7EEDF",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "3px",
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};
