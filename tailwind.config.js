/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Royal Prussian blue - deep, muted, low-glare so it's comfortable
        // to stare at all day on a phone screen (the opposite of a bright/
        // saturated "brand" blue).
        brand: {
          50: "#eaf1fa",
          100: "#d2e3f5",
          200: "#a9c6e8",
          500: "#2c5f98",
          600: "#1b4d7e",
          700: "#123a63",
        },
        surface: "#f4f7fb",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
