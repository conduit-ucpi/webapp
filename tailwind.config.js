// Colour families themed through CSS variables, and the steps each defines.
const STOCK_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const PALETTE_STEPS = {
  gray: STOCK_STEPS, neutral: STOCK_STEPS, red: STOCK_STEPS, orange: STOCK_STEPS, amber: STOCK_STEPS,
  yellow: STOCK_STEPS, green: STOCK_STEPS, emerald: STOCK_STEPS, blue: STOCK_STEPS, indigo: STOCK_STEPS,
  purple: STOCK_STEPS, pink: STOCK_STEPS,
  success: [50, 500, 600], warning: [50, 500, 600], error: [50, 500, 600],
};
const themed = (name, steps) =>
  Object.fromEntries(steps.map((step) => [step, `rgb(var(--wl-${name}-${step}) / <alpha-value>)`]));

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
        // Every other colour family the components name, themed the same way. Defaults (Tailwind's
        // stock values) are in styles/globals.css; a look overrides any of them. success / warning /
        // error keep only the steps this config has always defined — see PaletteName in the SDK.
        ...Object.fromEntries(
          Object.entries(PALETTE_STEPS).map(([name, steps]) => [name, themed(name, steps)])
        ),
        white: 'rgb(var(--wl-white) / <alpha-value>)',
        black: 'rgb(var(--wl-black) / <alpha-value>)',
      },
      // The theme's fonts. Defaults (Inter, and Tailwind's stock mono stack) are in globals.css.
      fontFamily: {
        sans: ['var(--wl-font)'],
        mono: ['var(--wl-font-mono)'],
        heading: ['var(--wl-font-heading)'],
      },
      // Every rounding size follows the theme radius. The multipliers reproduce Tailwind's stock
      // sizes at the default 0.5rem exactly (rounded-lg = 0.5rem, rounded-md = 0.375rem …), so the
      // default look is unchanged and a look with a different radius rounds everything in proportion.
      borderRadius: {
        sm: 'calc(var(--wl-radius) * 0.25)',
        DEFAULT: 'calc(var(--wl-radius) * 0.5)',
        md: 'calc(var(--wl-radius) * 0.75)',
        lg: 'var(--wl-radius)',
        xl: 'calc(var(--wl-radius) * 1.5)',
        '2xl': 'calc(var(--wl-radius) * 2)',
        '3xl': 'calc(var(--wl-radius) * 3)',
      },
    },
  },
  plugins: [],
}
