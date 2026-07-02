/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: "#ff9900",
        "primary-dark": "#ff6600",
        background: "#fffaf0",
        foreground: "#1a1a1a",
        "text-muted": "#555555",
        "border-color": "#ffe6cc",
      },
    },
  },
  plugins: [],
}
