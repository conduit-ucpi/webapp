import type { Look } from './types';

/** Bento's neutrals as a light-to-dark range: 50 is its off-white text, 900 its charcoal page. */
const WARM_NEUTRALS = {
  50: '245 245 242',
  100: '236 236 231',
  200: '224 224 218',
  300: '196 196 190',
  400: '154 154 148',
  500: '107 107 102',
  600: '68 68 63',
  700: '44 44 41',
  800: '29 29 27',
  900: '19 19 19',
  950: '12 12 12',
};

/**
 * The landing page's look ("Bento"): charcoal, one lime accent, Space Grotesk with JetBrains
 * Mono for code. Picked from landing-test-05; landing-test-06 onwards wear it too.
 */
const landing: Look = {
  name: 'landing',

  // What the landing page renders today. Moved here unchanged from components/landing-test/themes.ts.
  landing: {
    bg: '#131313',
    fg: '#f5f5f2',
    muted: '#9a9a94',
    card: '#1d1d1b',
    border: '#2c2c29',
    accent: '#c8ff3d',
    accentFg: '#131313',
    accentSoft: '#26291a',
    radius: '20px',
    btnRadius: '12px',
    font: "'Space Grotesk', Inter, system-ui, sans-serif",
    fontDisplay: "'Space Grotesk', Inter, system-ui, sans-serif",
    fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },

  // The same look for the app pages, in the SDK's format. Every colour family, the corners, the
  // fonts and the button follow it; the components themselves name only classes.
  //
  // Light/dark: components already pick lighter steps in light mode and darker ones in dark mode,
  // so one range serves both. The neutrals run from Bento's off-white (50) to its charcoal (900):
  // dark mode lands on Bento's own surfaces, light mode is the light version of it.
  app: {
    // Lime. 500 is Bento's accent; the deeper steps are darkened further than a plain mix so
    // accent-coloured text stays readable on light surfaces.
    primary: {
      50: '250 255 236',
      100: '244 255 216',
      200: '233 255 177',
      300: '222 255 139',
      400: '211 255 100',
      500: '200 255 61',
      600: '118 150 22',
      700: '89 113 17',
      800: '64 81 13',
      900: '42 53 9',
    },
    secondary: WARM_NEUTRALS,
    palettes: {
      // Tailwind's gray and neutral are used as neutrals too; they wear the same range so every
      // grey on a page is the same grey.
      gray: WARM_NEUTRALS,
      neutral: WARM_NEUTRALS,
      // Status colours (red, green, amber, yellow, blue…) keep their meanings and stock values.
    },
    radius: '20px',
    fontFamily: "'Space Grotesk', Inter, system-ui, sans-serif",
    headingFontFamily: "'Space Grotesk', Inter, system-ui, sans-serif",
    monoFontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    // The pages' serif accent lines wear the look's display face.
    accentFontFamily: "'Space Grotesk', Inter, system-ui, sans-serif",
    // Bento's call to action in both modes: filled lime, charcoal text, 12px corners.
    button: {
      radius: '12px',
      bg: 'rgb(200 255 61)',
      fg: 'rgb(19 19 19)',
      hoverBg: 'rgb(211 255 100)',
      darkBg: 'rgb(200 255 61)',
      darkFg: 'rgb(19 19 19)',
      darkHoverBg: 'rgb(211 255 100)',
    },
  },

  fontsHref:
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap',
};

export default landing;
