import { BrandConfig } from './types';

/**
 * Resolving which brand a visitor should see.
 *
 * The white-label model is a redirect: a partner puts a button on their site
 * that sends the user to our domain, and we render their branding. Auth,
 * cookies and the escrow verification all stay on our origin, so the only thing
 * that has to travel is "which brand".
 *
 * It travels as a query parameter rather than the referrer. `document.referrer`
 * looks like the obvious signal and is wrong here: it is empty when the
 * partner's link carries rel="noopener noreferrer" (the common default for
 * outbound links), empty under Referrer-Policy: no-referrer, empty on a
 * bookmark or a hand-opened tab — and, fatally, it points at the identity
 * provider rather than the partner once the visitor has been through an OAuth
 * round-trip. The branding would vanish at exactly the wrong moment.
 *
 *     https://stabledrop.me/create?b=cobro
 *
 * The URL is authoritative: no parameter means our own brand. An earlier
 * version also held the brand in sessionStorage so it would survive an auth
 * round-trip, which turned out to be unnecessary and actively confusing — the
 * auth callback strips only `code`, `state` and `access_token` and preserves
 * everything else via history.replaceState, so `?b=` already survives sign-in,
 * and the wizard steps are client-side on one URL. All the stickiness achieved
 * was making a deliberately clean URL keep showing a partner.
 *
 * ⚠️ An id in a URL is trivially forged, so this is styling only and must never
 *    gate anything. Two things keep that honest: an unknown id falls back to the
 *    default rather than rendering a half-brand, and a payment page should
 *    prefer the partner recorded on the contract over anything in the URL,
 *    because the visitor cannot forge that.
 */

export type BrandRegistry = Record<string, BrandConfig>;

/** `?b=` is the short form; `?brand=` reads better in documentation. */
export const BRAND_QUERY_KEYS = ['b', 'brand'] as const;

/** Only still referenced so a previously stuck tab can be cleared. */
export const BRAND_STORAGE_KEY = 'wl:brand';

export type BrandSource = 'route' | 'query' | 'contract' | 'default';

export interface BrandResolution {
  id: string;
  source: BrandSource;
}

export interface ResolveBrandInput {
  /** `window.location.search`, or any query string. */
  search?: string;
  /** The partner recorded against the contract being viewed, if any. */
  contractBrandId?: string | null;
  /**
   * A brand fixed by the route itself, for pages that exist only to carry one
   * partner's branding (see WHITE_LABEL_ROUTES in config/brands).
   */
  routeBrandId?: string | null;
  registry: BrandRegistry;
  fallbackId: string;
}

function firstQueryValue(search: string | undefined): string | null {
  if (!search) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of BRAND_QUERY_KEYS) {
    const value = params.get(key);
    if (value) return value.trim().toLowerCase();
  }
  return null;
}

/**
 * Pure resolution, so the precedence is testable without a browser.
 *
 * Order: a route pinned to one brand, then the contract's own partner, then
 * the URL, then the default. The contract outranks the URL because it is the
 * one signal a visitor cannot edit — and on a payment page it is the only one
 * that is right, since the payer arrives from a link days later with nothing
 * else to go on. A pinned route outranks even that, because such a page exists
 * only to be that brand.
 */
export function resolveBrandId({
  search,
  contractBrandId,
  routeBrandId,
  registry,
  fallbackId,
}: ResolveBrandInput): BrandResolution {
  const known = (id: string | null | undefined): id is string =>
    !!id && Object.prototype.hasOwnProperty.call(registry, id);

  // A pinned route outranks everything, including the query. /create-cobro is
  // COBRO's page; `?b=stabledrop` on it would otherwise hand a partner's URL
  // back to us, which is the one thing a dedicated brand route must not do.
  if (known(routeBrandId)) return { id: routeBrandId, source: 'route' };

  if (known(contractBrandId)) return { id: contractBrandId, source: 'contract' };

  const fromQuery = firstQueryValue(search);
  if (known(fromQuery)) return { id: fromQuery, source: 'query' };

  return { id: fallbackId, source: 'default' };
}
