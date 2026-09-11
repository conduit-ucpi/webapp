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

export { stabledrop, cobro };
