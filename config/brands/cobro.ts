import { defineBrand } from '@conduit-ucpi/whitelabel-sdk';

/**
 * COBRO (payments.co.ve) — a partner brand.
 *
 * Reached as `?b=cobro`, which is what their "create payment request" button
 * links to. Everything else — auth, cookies, escrow verification — happens on
 * our origin exactly as it does for us; only the presentation changes.
 *
 * The wordmark is text because we hold no licensed copy of their logo. Drop a
 * supplied asset into public/ and set `assets.logo` to use the real one.
 */
const cobro = defineBrand({
  id: 'cobro',
  name: 'COBRO',
  tagline: 'Cobra con protección',
  locale: 'es',

  // Colours are RGB triples so Tailwind's `/50` alpha modifiers keep working
  // through the CSS custom properties. Radius, and every step not named here,
  // come from the SDK defaults.
  theme: {
    // Their near-black, a touch warmer than the default slate. Only the darkest
    // neutral step is overridden — body copy and borders read from the rest of
    // the SDK's ramp.
    secondary: {
      900: '17 17 17',
    },

    // Their typeface. The face itself is loaded by whoever renders the page;
    // the fallbacks carry it where it is not.
    fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif",

    // Their mint.
    primary: {
      50: '230 250 244',
      100: '196 243 228',
      200: '150 233 209',
      300: '94 220 186',
      400: '45 208 166',
      500: '0 200 150',
      600: '0 168 126',
      700: '0 133 100',
      800: '0 100 76',
      900: '0 72 55',
    },
  },

  copy: {
    operatorNote: 'Escrow contracts operated by Conduit UCPI on Base.',
  },

  links: {
    terms: '/terms-of-service',
    privacy: '/privacy-policy',
    arbitration: '/arbitration-policy',
  },
});

export default cobro;
