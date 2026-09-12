/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter var"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8',
          500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a',
        },
        brand: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8',
          500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.06), 0 8px 24px -12px rgba(15,23,42,.18)',
        pop: '0 12px 40px -12px rgba(15,23,42,.35)',
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
