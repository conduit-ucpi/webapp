import landing from '@/config/looks/landing';

/**
 * The Bento look, under the names landing-test-05 onwards import. The values live in
 * config/looks/landing.ts, alongside the app pages' look; this file only keeps those
 * experiment pages' imports working.
 */
export const BENTO = landing.landing;

export const BENTO_FONTS_HREF = landing.fontsHref as string;
