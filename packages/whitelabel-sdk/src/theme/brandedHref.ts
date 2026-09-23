import { BRAND_QUERY_KEYS } from '../config/registry';

/**
 * Carry the active brand across a link.
 *
 * The brand lives in the URL and nothing persists it (see config/registry.ts
 * for why). The consequence is that any in-app link which drops `?b=` drops the
 * branding with it — a COBRO seller shares a payment link and their buyer opens
 * a Stabledrop page, which is the one thing a white-label must not do.
 *
 * So links that leave one of our pages for another go through here. It is a
 * pure string function, deliberately: the links being fixed are built in half a
 * dozen components, some inside callbacks and one inside a clipboard write, and
 * none of those are places to be calling hooks.
 *
 * An existing brand parameter is left alone. A caller that has already decided
 * which brand a link should carry — a payment page reading the partner off the
 * contract, say — knows better than the ambient one.
 */
export function withBrandParam(path: string, brandId: string | null | undefined): string {
  if (!brandId) return path;

  // Split the fragment off first: a parameter appended after '#' is part of the
  // fragment, not the query, and would silently do nothing.
  const hashAt = path.indexOf('#');
  const hash = hashAt === -1 ? '' : path.slice(hashAt);
  const withoutHash = hashAt === -1 ? path : path.slice(0, hashAt);

  const queryAt = withoutHash.indexOf('?');
  const base = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  const query = queryAt === -1 ? '' : withoutHash.slice(queryAt + 1);

  const params = new URLSearchParams(query);
  if (BRAND_QUERY_KEYS.some((key) => params.get(key))) return path;

  params.set(BRAND_QUERY_KEYS[0], brandId);
  return `${base}?${params.toString()}${hash}`;
}
