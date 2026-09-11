import { defineBrand } from '@conduit-ucpi/whitelabel-sdk';

/**
 * Stabledrop's own brand, expressed in exactly the format a tenant would use.
 *
 * This is the dogfooding: the first-party app is configured through the same
 * contract we hand a white-label customer, so a gap in that contract shows up
 * here first rather than in a partner's integration.
 *
 * Colours are omitted on purpose — the SDK's defaults ARE this palette (they
 * are generated from tailwind.config.js), so restating them would be a second
 * copy to keep in step. A tenant supplies theirs here.
 */
const brand = defineBrand({
  id: 'stabledrop',
  name: 'Stabledrop.me',
  tagline: 'Escrow-backed payments',
  locale: 'en',

  // Mirrors NEXT_PUBLIC_API_BASE_URL: '' is same-origin for the box build, and
  // the API host for the static build.
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '',

  theme: {
    // Inherit the default ramps; override only what is genuinely ours.
    radius: '0.5rem',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },

  assets: {
    logo: '/icon-512.png',
    favicon: '/favicon.ico',
    ogImage: '/preview.png',
    logoHeight: '1.75rem',
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

export default brand;
