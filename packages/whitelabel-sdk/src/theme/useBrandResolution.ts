import { useEffect, useRef, useState } from 'react';
import Router from 'next/router';
import {
  BrandRegistry,
  BrandResolution,
  BRAND_STORAGE_KEY,
  resolveBrandId,
} from '../config/registry';
import { withBrandParam } from './brandedHref';

/**
 * Resolve the active brand from the URL on every page load.
 *
 * There is deliberately no persistence. An earlier version held the id in
 * sessionStorage so it would survive an auth round-trip; that turned out to be
 * unnecessary — the auth callback strips only `code`, `state` and
 * `access_token` and keeps the rest of the query string via replaceState, and
 * the wizard runs client-side on a single URL — and its only real effect was
 * that loading a clean /create kept showing the last partner until the tab was
 * closed. The URL says who you are; nothing else does.
 *
 * In-app navigation carries it, though. Once a partner's brand is showing — from
 * the query, a pinned route or the contract — a client-side move to a page whose
 * URL names no brand keeps that partner and writes `?b=` into the new URL, so the
 * whole app (dashboard, account pages, create, pay) stays theirs without every
 * link having to remember the parameter, and a refresh keeps it too. That is not
 * stickiness: it lives only as long as the page does, so a fresh load of a clean
 * URL is still ours.
 */

export interface UseBrandResolutionOptions {
  registry: BrandRegistry;
  fallbackId: string;
  /** The partner recorded on the contract being viewed, when there is one. */
  contractBrandId?: string | null;
  /** A brand fixed by the route, for pages dedicated to one partner. */
  routeBrandId?: string | null;
  /** See ResolveBrandInput.allowUnlisted. */
  allowUnlisted?: boolean;
  /** See ResolveBrandInput.hostBrands. */
  hostBrands?: Record<string, string>;
}

export function useBrandResolution({
  registry,
  fallbackId,
  contractBrandId,
  routeBrandId,
  allowUnlisted = false,
  hostBrands,
}: UseBrandResolutionOptions): BrandResolution & { settled: boolean } {
  // Starts at the fallback, matching what the server rendered, and only moves
  // after hydration.
  //
  // Resolving during this initializer instead would paint the right brand a
  // frame sooner, and is wrong: the pre-rendered HTML says "Stabledrop", the
  // first client render would say "COBRO", and React reports a hydration
  // mismatch and throws the tree away. The brand lives in the URL, which the
  // server never sees for a statically exported page, so the two CANNOT agree
  // on first paint — the only correct move is to agree with the server, then
  // update.
  const [resolution, setResolution] = useState<BrandResolution>({
    id: fallbackId,
    source: 'default',
  });
  // False until the URL has been read. Before that the id is the fallback only
  // because the server could not know better, so nothing should act on it —
  // fetching our brand on a partner's page, for one.
  const [settled, setSettled] = useState(false);
  // The partner in view, for carrying across in-app navigation. Never our own brand.
  const carried = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Clear the key the previous persisting version wrote, so a tab that is
    // already stuck on a partner recovers without having to be closed.
    try {
      window.sessionStorage.removeItem(BRAND_STORAGE_KEY);
    } catch {
      /* Storage unavailable — nothing to clear. */
    }

    const resolve = () => {
      const next = resolveBrandId({
        search: window.location.search,
        contractBrandId,
        routeBrandId,
        registry,
        fallbackId,
        allowUnlisted,
        hostname: window.location.hostname,
        hostBrands,
      });
      const partner = next.source !== 'default' && next.source !== 'host';
      if (!partner && carried.current) {
        // Arrived here in-app from a partner's page: keep the partner and put it in
        // the URL. The replace comes back through here and resolves from the query.
        // Resolution is left as it is meanwhile, so the page never flashes ours.
        const here = window.location.pathname + window.location.search + window.location.hash;
        try {
          void Router.replace(withBrandParam(here, carried.current), undefined, { shallow: true, scroll: false });
          return;
        } catch {
          // No Next router mounted (a host that isn't a Next app): nothing to carry with.
        }
      }
      carried.current = partner ? next.id : null;
      setResolution((prev) =>
        prev.id === next.id && prev.source === next.source ? prev : next
      );
      setSettled(true);
    };

    resolve();
    // The singleton, not useRouter(): the provider also runs outside a mounted Next router.
    Router?.events?.on('routeChangeComplete', resolve);
    return () => Router?.events?.off('routeChangeComplete', resolve);
  }, [registry, fallbackId, contractBrandId, routeBrandId, allowUnlisted, hostBrands]);

  return { ...resolution, settled };
}
