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

  theme: {
    // Their mint, as RGB triples. Only the accent ramp is supplied; the neutral
    // scale, radius and type come from the SDK defaults.
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
