import { useEffect, useState } from 'react';
import {
  BrandRegistry,
  BrandResolution,
  BRAND_STORAGE_KEY,
  resolveBrandId,
} from '../config/registry';

/**
 * Resolve the active brand from the URL, then hold it for the session.
 *
 * Storage is sessionStorage rather than a cookie: the id is presentational, it
 * should not ride along on every API request, and it should not outlive the
 * tab. Every access is wrapped because storage throws outright in some contexts
 * (Safari private mode, embedded webviews, a page in an iframe with third-party
 * storage blocked) — and a partner's checkout inside an iframe is exactly the
 * case where that happens. Losing the brand there should downgrade to the
 * default, never take the page down.
 */

function readStored(): string | null {
  try {
    return window.sessionStorage.getItem(BRAND_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string): void {
  try {
    window.sessionStorage.setItem(BRAND_STORAGE_KEY, id);
  } catch {
    /* Storage unavailable — the brand simply will not survive navigation. */
  }
}

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
  // Resolving in this initializer instead would paint the right brand a frame
  // sooner, and it is wrong: the pre-rendered HTML says "Stabledrop", the first
  // client render would say "COBRO", and React reports a hydration mismatch and
  // throws the tree away. The brand lives in the URL, which the server never
  // sees for a statically exported page, so the two CANNOT agree on first paint
  // — the only correct move is to agree with the server, then update.
  //
  // The cost is one frame of default branding. Colours barely show it, because
  // the defaults are baked into :root and swap as variables rather than
  // repainting a component.
  const [resolution, setResolution] = useState<BrandResolution>({
    id: fallbackId,
    source: 'default',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const next = resolveBrandId({
      search: window.location.search,
      stored: readStored(),
      contractBrandId,
      registry,
      fallbackId,
    });

    // Persist anything that did not come from storage, so it survives the
    // navigation, the OAuth round-trip and the wizard steps that follow.
    if (next.source === 'query' || next.source === 'contract') {
      writeStored(next.id);
    }

    setResolution((prev) =>
      prev.id === next.id && prev.source === next.source ? prev : next
    );
  }, [registry, fallbackId, contractBrandId]);

  return resolution;
}
