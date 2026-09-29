import type { Look } from './types';

/**
 * The app pages' look: the SDK's default palette (emerald accent, slate neutrals, generated
 * from tailwind.config.js), Inter, 8px corners.
 */
const app: Look = {
  name: 'app',

  // The SDK's default look for the app pages.
  // Colours are omitted on purpose: the SDK's defaults ARE this palette, so restating them
  // would be a second copy to keep in step.
  app: {
    radius: '0.5rem',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },

  // ⚠️ A FIRST DRAFT, unused until LANDING_PAGE_LOOK points here: the same palette read off the
  //    SDK's default ranges (slate-50 page, white cards, slate-200 borders, emerald-500 accent).
  //    Light only, like the app pages' default.
  landing: {
    bg: 'rgb(248 250 252)',
    fg: 'rgb(15 23 42)',
    muted: 'rgb(100 116 139)',
    card: '#ffffff',
    border: 'rgb(226 232 240)',
    accent: 'rgb(16 185 129)',
    accentFg: '#ffffff',
    accentSoft: 'rgb(236 253 245)',
    radius: '0.5rem',
    btnRadius: '0.5rem',
    font: 'Inter, system-ui, -apple-system, sans-serif',
    fontDisplay: 'Inter, system-ui, -apple-system, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },

  // Inter is loaded site-wide by styles/globals.css.
  fontsHref: undefined,
};

export default app;
