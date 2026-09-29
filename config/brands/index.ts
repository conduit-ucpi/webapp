import { BrandConfig, BrandRegistry } from '@conduit-ucpi/whitelabel-sdk';
import snapshot from './snapshot.json';

/**
 * Brands are edited in the white-label service (../whitelabelservice), not here.
 * Our own brand is the `stabledrop` record there, in the same format as every
 * partner's.
 *
 * snapshot.json is a copy of those records bundled into the build, for two
 * reasons: the first paint needs no request, and the site keeps its branding if
 * the service is down. BrandProvider (with `remote`) fetches the live record on
 * top of it, so a stale snapshot shows an old brand for one request, not a
 * wrong one.
 *
 * Refresh it after changing a brand in the service:
 *
 *     WHITELABEL_URL=https://api.stabledrop.me WHITELABEL_ADMIN_KEY=… node scripts/brands/pull.mjs
 *
 * and push an edited snapshot back with scripts/brands/push.mjs.
 *
 * With `remote`, an id that is not here is still fetched, so a partner added
 * since the last build works without one. An id the service does not know
 * resolves to the default, so a forged `?b=` cannot produce a half-branded page.
 */
export const BRANDS: BrandRegistry = Object.fromEntries(
  Object.entries(snapshot.brands).map(([id, entry]) => [id, entry.config as BrandConfig])
);

export const DEFAULT_BRAND_ID = 'stabledrop';

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
  '/create-cobro': 'cobro',
};
