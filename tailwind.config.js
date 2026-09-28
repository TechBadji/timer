/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Figtree', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f6f7fb', 100: '#eceef6', 200: '#dde1ee', 300: '#c3c9dc', 400: '#8f98b5',
          500: '#616b8c', 600: '#465072', 700: '#2f3858', 800: '#1d2543', 900: '#131a33',
        },
        brand: {
          50: '#eef1ff', 100: '#dde3ff', 200: '#bfc9ff', 300: '#93a2f5', 400: '#5f74e0',
          500: '#3f55cc', 600: '#2c3fb0', 700: '#233291', 800: '#1d2873', 900: '#171f59',
        },
        marge: '#e2456f',
      },
      boxShadow: {
        card: '0 1px 0 rgba(19,26,51,.04), 0 0 0 1px rgba(19,26,51,.07)',
        pop: '0 16px 48px -16px rgba(19,26,51,.45)',
      },
      keyframes: {
        'slide-up': { '0%': { transform: 'translateY(12px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
      },
      animation: {
        'slide-up': 'slide-up .22s cubic-bezier(.16,1,.3,1)',
        'fade-in': 'fade-in .18s ease-out',
      },
    },
  },
  plugins: [],
}
