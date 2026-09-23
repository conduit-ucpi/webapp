import { BrandRegistry } from '@conduit-ucpi/whitelabel-sdk';
import stabledrop from './stabledrop';
import cobro from './cobro';

/**
 * Every brand this deployment will render, keyed by the id a partner puts in
 * their link (`?b=cobro`).
 *
 * This doubles as the allowlist. An id that is not here resolves to the
 * default, so a forged parameter cannot produce a half-branded page — which
 * matters, because anyone can put anything in a query string.
 */
export const BRANDS: BrandRegistry = {
  [stabledrop.id]: stabledrop,
  [cobro.id]: cobro,
};

export const DEFAULT_BRAND_ID = stabledrop.id;

/**
 * Routes that exist to carry one partner's branding, mapped to that brand.
 *
 * Two things read this, and they have to agree or the page is incoherent:
 * Layout drops our header and footer on these paths, and BrandProvider pins
 * the brand so the page is that partner's without needing `?b=`. Keeping both
 * off one map is what stops a route losing our chrome while still rendering
 * our colours.
 *
 * A pinned route beats the query string, so `/create-cobro?b=stabledrop`
 * stays COBRO's page.
 */
export const WHITE_LABEL_ROUTES: Record<string, string> = {
  '/create-cobro': cobro.id,
};

export { stabledrop, cobro };
