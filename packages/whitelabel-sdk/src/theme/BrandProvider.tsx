import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BrandConfig, ResolvedBrand } from '../config/types';
import { BrandRegistry, BrandSource } from '../config/registry';
import { resolveBrand } from '../config/resolveBrand';
import { fetchBrand, BrandFetchResult } from '../config/remoteBrand';
import { brandToVars, applyVars } from './cssVars';
import { applyBrandHead } from './brandHead';
import { useBrandResolution } from './useBrandResolution';

/**
 * Holds the active brand and puts its theme variables on the document.
 *
 * Two forms:
 *
 *   <BrandProvider brand={config}>                    one fixed brand
 *   <BrandProvider brands={registry} defaultBrandId>  resolved per visitor
 *
 * The second is the white-label case: a partner links to us with `?b=<id>`, and
 * the brand is then held for the session. See config/registry.ts for why the
 * parameter carries it rather than the referrer.
 *
 * Variables are written in an effect because they touch the document element,
 * which is outside React's tree. The defaults are already present from
 * globals.css, so the pre-hydration paint is correct and this only applies the
 * active brand's deltas.
 *
 * With `remote`, the registry is the bundled snapshot of the white-label
 * service, and the active brand's live record is fetched on top of it:
 *
 *   - in the snapshot  → rendered at once, then replaced by the live record;
 *   - not in it        → the page is hidden (not unmounted) until the record
 *                        arrives, so a partner's payer never sees our brand;
 *   - service says 404 → our brand, unless the snapshot holds the id;
 *   - service down     → the snapshot, or our brand if the id is not in it.
 */

interface BrandContextValue {
  brand: ResolvedBrand;
  /** Where the brand came from. Useful when debugging a partner's link. */
  source: BrandSource;
}

const BrandContext = createContext<BrandContextValue | null>(null);

type BrandProviderProps = {
  children: React.ReactNode;
} & (
  | {
      brand: BrandConfig;
      brands?: never;
      defaultBrandId?: never;
      contractBrandId?: never;
      routeBrandId?: never;
    }
  | {
      brand?: never;
      brands: BrandRegistry;
      defaultBrandId: string;
      /** Partner recorded on the contract in view, when there is one. */
      contractBrandId?: string | null;
      /** Partner this route is dedicated to, when it is one. */
      routeBrandId?: string | null;
      /** Fetch the live record from the white-label service. `brands` is then the bundled snapshot. */
      remote?: boolean;
      /** Test seam for the fetch. */
      fetchBrandImpl?: typeof fetchBrand;
    }
);

/** What the service said about an id this session. */
type LiveEntry = Exclude<BrandFetchResult, { status: 'found' }> | { status: 'found'; config: BrandConfig };

export function BrandProvider(props: BrandProviderProps) {
  const { children } = props;

  // A registry is always passed to the hook so its call order never changes;
  // the single-brand form becomes a registry of one.
  const registry: BrandRegistry = useMemo(
    () => (props.brand ? { [props.brand.id]: props.brand } : props.brands),
    [props.brand, props.brands]
  );
  const fallbackId = props.brand ? props.brand.id : props.defaultBrandId;
  const remote = !props.brand && !!props.remote;
  const fetchImpl = (!props.brand && props.fetchBrandImpl) || fetchBrand;

  const { id, source, settled } = useBrandResolution({
    registry,
    fallbackId,
    contractBrandId: props.brand ? undefined : props.contractBrandId,
    routeBrandId: props.brand ? undefined : props.routeBrandId,
    allowUnlisted: remote,
  });

  const [live, setLive] = useState<Record<string, LiveEntry>>({});

  // Each id is asked about once per page load. The fallback is fetched only when
  // it is the brand in view, so a partner's page makes one request, not two.
  useEffect(() => {
    if (!remote || !settled || live[id]) return;
    let cancelled = false;
    fetchImpl(id).then((result) => {
      if (cancelled) return;
      const entry: LiveEntry =
        result.status === 'found' ? { status: 'found', config: result.config } : result;
      setLive((prev) => ({ ...prev, [id]: entry }));
    });
    return () => {
      cancelled = true;
    };
  }, [remote, settled, id, live, fetchImpl]);

  const entry = live[id];
  // Hidden while an id the snapshot does not hold is being fetched. Our own
  // brand is never waited on — it is always in the bundle.
  const loading = remote && !entry && !registry[id];

  const value = useMemo<BrandContextValue>(() => {
    const fallbackConfig = (() => {
      const f = live[fallbackId];
      return f?.status === 'found' ? f.config : registry[fallbackId];
    })();
    if (entry?.status === 'found') return { brand: resolveBrand(entry.config), source };
    // A 404 only overrules an id the snapshot does not hold. A brand we shipped
    // keeps its bundled copy until the snapshot is next refreshed, so a 404 from
    // a service that is not deployed yet (or a mis-route) cannot strip a live
    // partner of their branding.
    if (entry?.status === 'missing' && !registry[id]) {
      return { brand: resolveBrand(fallbackConfig), source: 'default' };
    }
    const config = registry[id];
    return config
      ? { brand: resolveBrand(config), source }
      : { brand: resolveBrand(fallbackConfig), source: 'default' };
  }, [registry, live, entry, id, fallbackId, source]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    applyVars(brandToVars(value.brand), document.documentElement);
    applyBrandHead(value.brand, document);
  }, [value.brand]);

  // Always the same wrapper, so toggling `loading` changes a style rather than
  // the tree: auth and wallet providers below must not remount. `display:
  // contents` keeps it out of layout; `visibility` is inherited through it.
  return (
    <BrandContext.Provider value={value}>
      <div
        data-wl-brand={value.brand.id}
        aria-busy={loading || undefined}
        style={{ display: 'contents', visibility: loading ? 'hidden' : undefined }}
      >
        {children}
      </div>
    </BrandContext.Provider>
  );
}

/**
 * The active brand.
 *
 * Throws outside the provider rather than returning a default: a component
 * silently rendering our colours inside a partner's page is the kind of bug
 * that ships, and a missing provider is trivially fixable.
 */
export function useBrand(): ResolvedBrand {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    throw new Error(
      'useBrand() was called outside <BrandProvider>. Wrap the app in BrandProvider ' +
        'and pass it a brand config or a registry.'
    );
  }
  return ctx.brand;
}

/** The brand if there is one, otherwise null. For chrome that is shared with non-SDK pages. */
export function useOptionalBrand(): ResolvedBrand | null {
  return useContext(BrandContext)?.brand ?? null;
}

/** Where the active brand came from — route, contract, query or default. */
export function useBrandSource(): BrandSource | null {
  return useContext(BrandContext)?.source ?? null;
}
