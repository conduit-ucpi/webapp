/**
 * Brand tokens for white-labelled surfaces.
 *
 * The app already white-labels by hostname (see getSiteNameFromDomain, which
 * maps a domain to Stabledrop.me / Instant Escrow / Conduit UCPI / USDCBAY) and
 * by PRODUCT_NAME for outgoing copy. That covers the name; it does not cover the
 * look. This adds the rest of it — accent, dark surface, typeface, wordmark —
 * so a partner-branded page can be a config entry rather than a forked page.
 *
 * A white-labelled route renders none of our own chrome. Layout drops the
 * header and footer for those paths, so the only branding on the page is the
 * brand's own.
 *
 * ⚠️ A brand entry here puts someone's name on a live payment flow. Only add a
 *    brand we own, or one whose owner has agreed to it — a visitor takes the
 *    name on a payments page as the party they are dealing with.
 */

export interface Brand {
  /** Key used in URLs and config. */
  id: string;
  /** Wordmark text shown in the page's own header. */
  name: string;
  /** Optional line under the wordmark. */
  tagline?: string;
  /** Primary action colour. */
  accent: string;
  /** Text colour on top of the accent — set for contrast, not taste. */
  accentText: string;
  /** Dark surface used for banners and panels. */
  ink: string;
  /** CSS font stack. */
  font: string;
  /** Shown in the white-label footer; keeps the operator legible. */
  operatorNote: string;
  /** Path to a supplied logo in public/. Falls back to the name as a wordmark. */
  logoSrc?: string;
}

export const DEFAULT_BRAND: Brand = {
  id: 'stabledrop',
  name: 'Stabledrop.me',
  tagline: 'Escrow-backed payments',
  accent: '#10b981',
  accentText: '#052e23',
  ink: '#0f172a',
  font: "'Manrope', ui-sans-serif, system-ui, sans-serif",
  operatorNote: 'Escrow contracts operated by Conduit UCPI on Base.',
};

/**
 * Partner brands.
 *
 * A brand here puts someone's name on a working payment flow, so an entry
 * should exist only for a brand we own or a partner who is expecting it.
 * `cobro` is a pitch demo built for COBRO to look at — hence noindex on the
 * page, and the operator note kept in the footer so who runs the escrow is
 * never in doubt.
 */
export const BRANDS: Record<string, Brand> = {
  stabledrop: DEFAULT_BRAND,

  // Demo for COBRO (payments.co.ve). Palette and treatment taken from their own
  // site so the pitch shows them their look, not ours.
  //
  // The wordmark is set as text rather than their logo file: we have no licensed
  // copy of the artwork. Drop a supplied asset into public/ and set `logoSrc` to
  // use the real thing.
  cobro: {
    id: 'cobro',
    name: 'COBRO',
    tagline: 'Cobra con protección',
    accent: '#00c896',
    accentText: '#08110e',
    ink: '#111111',
    font: "'Manrope', ui-sans-serif, system-ui, sans-serif",
    operatorNote: 'Escrow contracts operated by Conduit UCPI on Base.',
  },
};

export function getBrand(id: string | undefined): Brand {
  return (id && BRANDS[id]) || DEFAULT_BRAND;
}

/** Routes that render without our header and footer. */
export const WHITE_LABEL_ROUTES = new Set(['/create-cobro']);
