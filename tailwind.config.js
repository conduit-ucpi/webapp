/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './packages/*/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Themed through CSS custom properties so a tenant can restyle the app
        // without recompiling Tailwind — see packages/whitelabel-sdk/src/theme/
        // cssVars.ts. The <alpha-value> placeholder is what keeps `/50` opacity
        // modifiers working through a variable.
        //
        // Defaults live at :root in styles/globals.css, so the first paint is
        // correct before any JavaScript runs. BrandProvider applies only the
        // deltas a tenant config specifies.
        primary: {
          50: 'rgb(var(--wl-primary-50) / <alpha-value>)',
          100: 'rgb(var(--wl-primary-100) / <alpha-value>)',
          200: 'rgb(var(--wl-primary-200) / <alpha-value>)',
          300: 'rgb(var(--wl-primary-300) / <alpha-value>)',
          400: 'rgb(var(--wl-primary-400) / <alpha-value>)',
          500: 'rgb(var(--wl-primary-500) / <alpha-value>)',
          600: 'rgb(var(--wl-primary-600) / <alpha-value>)',
          700: 'rgb(var(--wl-primary-700) / <alpha-value>)',
          800: 'rgb(var(--wl-primary-800) / <alpha-value>)',
          900: 'rgb(var(--wl-primary-900) / <alpha-value>)',
        },
        secondary: {
          50: 'rgb(var(--wl-secondary-50) / <alpha-value>)',
          100: 'rgb(var(--wl-secondary-100) / <alpha-value>)',
          200: 'rgb(var(--wl-secondary-200) / <alpha-value>)',
          300: 'rgb(var(--wl-secondary-300) / <alpha-value>)',
          400: 'rgb(var(--wl-secondary-400) / <alpha-value>)',
          500: 'rgb(var(--wl-secondary-500) / <alpha-value>)',
          600: 'rgb(var(--wl-secondary-600) / <alpha-value>)',
          700: 'rgb(var(--wl-secondary-700) / <alpha-value>)',
          800: 'rgb(var(--wl-secondary-800) / <alpha-value>)',
          900: 'rgb(var(--wl-secondary-900) / <alpha-value>)',
        },
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}