/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./{app,components,libs,pages,hooks}/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          // Chocolate brown from the BAGS handbag in the reference mockup
          brown: '#5B4436',
          carton: '#5B4436',
          cream: '#F4F2F1',
          blush: '#E8DFD4',
          nude: '#E8DFD4',
          sand: '#F4F2F1',
          purple: '#5B4436',
          pink: '#E8DFD4',
          coral: '#5B4436',
          yellow: '#F4F2F1',
          tan: '#5B4436',
          gold: '#5B4436',
          oxblood: '#5B4436',
          rose: '#5B4436',
          bag: '#5B4436',
          'bag-dark': '#47362C',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
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
