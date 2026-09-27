import app from './app';
import landing from './landing';

export type { Look } from './types';

/** Every look the site has, in one place. */
export const LOOKS = { app, landing };

/*
 * ── Which part of the site wears which look ──────────────────────────────────────────────
 *
 * The switch. Point either line at any entry in LOOKS. Nothing else in the site names a look:
 * the landing page reads LANDING_PAGE_LOOK, and Stabledrop's brand config (config/brands/
 * stabledrop.ts) reads APP_PAGES_LOOK for every other page. Partner brands such as COBRO
 * keep their own themes and are not affected.
 */
export const LANDING_PAGE_LOOK = LOOKS.landing;
export const APP_PAGES_LOOK = LOOKS.landing;
