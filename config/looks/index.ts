import app from './app';
import landing from './landing';

export type { Look } from './types';

/** Every look the site has, in one place. */
export const LOOKS = { app, landing };

/*
 * ── Which part of the site wears which look ──────────────────────────────────────────────
 *
 * The landing page reads LANDING_PAGE_LOOK. Point it at any entry in LOOKS.
 *
 * The app pages no longer read a look: they wear the `stabledrop` brand record, which lives in
 * the white-label service alongside every partner's (see config/brands). To give the app pages
 * a look from here, copy its `app` theme (and `fontsHref` as `fonts.stylesheetHref`) into that
 * record.
 */
export const LANDING_PAGE_LOOK = LOOKS.landing;
