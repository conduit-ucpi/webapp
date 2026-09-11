import { useEffect, useState } from 'react';
import {
  BrandRegistry,
  BrandResolution,
  BRAND_STORAGE_KEY,
  resolveBrandId,
} from '../config/registry';

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
 * The consequence to know about: an in-app link that drops the parameter drops
 * the branding with it. The fix for that is to carry the parameter on those
 * links, or to read the partner off the contract, not to make the brand sticky.
 */

export interface UseBrandResolutionOptions {
  registry: BrandRegistry;
  fallbackId: string;
  /** The partner recorded on the contract being viewed, when there is one. */
  contractBrandId?: string | null;
}

export function useBrandResolution({
  registry,
  fallbackId,
  contractBrandId,
}: UseBrandResolutionOptions): BrandResolution {
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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Clear the key the previous persisting version wrote, so a tab that is
    // already stuck on a partner recovers without having to be closed.
    try {
      window.sessionStorage.removeItem(BRAND_STORAGE_KEY);
    } catch {
      /* Storage unavailable — nothing to clear. */
    }

    const next = resolveBrandId({
      search: window.location.search,
      contractBrandId,
      registry,
      fallbackId,
    });

    setResolution((prev) =>
      prev.id === next.id && prev.source === next.source ? prev : next
    );
  }, [registry, fallbackId, contractBrandId]);

  return resolution;
}
