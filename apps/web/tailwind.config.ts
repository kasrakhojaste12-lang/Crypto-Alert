import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#10b981',
          dark: '#059669',
        },
        // slate is CSS-variable-backed so a `.light` class on <html> can flip the
        // whole app (see globals.css — light mirrors the ramp, 50↔950). <alpha-value>
        // keeps opacity modifiers like bg-slate-900/60 working.
        slate: {
          50: 'rgb(var(--s-50) / <alpha-value>)',
          100: 'rgb(var(--s-100) / <alpha-value>)',
          200: 'rgb(var(--s-200) / <alpha-value>)',
          300: 'rgb(var(--s-300) / <alpha-value>)',
          400: 'rgb(var(--s-400) / <alpha-value>)',
          500: 'rgb(var(--s-500) / <alpha-value>)',
          600: 'rgb(var(--s-600) / <alpha-value>)',
          700: 'rgb(var(--s-700) / <alpha-value>)',
          800: 'rgb(var(--s-800) / <alpha-value>)',
          900: 'rgb(var(--s-900) / <alpha-value>)',
          950: 'rgb(var(--s-950) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
