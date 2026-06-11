/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./{app,components,libs,pages,hooks}/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          // Soft blush / nude palette
          brown: '#5A4234',   // deep espresso — primary text & buttons
          carton: '#A8826B',  // warm mocha taupe — secondary accent
          cream: '#FAF3EE',   // soft blush background
          blush: '#EDD7CA',   // signature blush (brand swatch)
          nude: '#E6D4C6',    // cooler blush edge
          sand: '#F7EDE6',    // pale blush tint
          purple: '#A8826B',  // alias of carton (legacy usage)
          pink: '#F3DBCF',    // soft blush pink
          coral: '#D98E73',   // muted terracotta
          yellow: '#FAF3EE',  // pale blush (legacy "yellow" tint)
          tan: '#8C6A52',     // deep taupe
          gold: '#C9A24B',    // champagne gold (matches logo)
          oxblood: '#9A4A36', // soft terracotta-red (sale/discount)
          rose: '#E3B9A6',    // dusty rose
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
      },
      animation: {
        'just-landed-scroll': 'just-landed-scroll 30s linear infinite',
        'marquee': 'marquee 30s linear infinite',
      },
      keyframes: {
        'just-landed-scroll': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
}

